// lib/repositories/clientRepository.ts
// ──────────────────────────────────────────────────────────────────
// 고객사 데이터 조회 리포지토리
// - 고객사 상세 모달 데이터 (getClientModalData)
// - 고객 변동 현황 조회 (getClientChangeData)
// ──────────────────────────────────────────────────────────────────

import { queryMySQL } from "@/lib/mysql/client";
import { createClient } from "@/lib/supabase/server";
import { getToday, addDays } from "@/lib/utils/date";
import { getOrdersByDate } from "@/lib/repositories/dashboardQueryRepository";
import { getProductColorMap } from "@/lib/repositories/productRepository";
import { PRESET_COLORS } from "@/lib/utils/color";
import { toDateStr, parseOrderDay, median } from "@/lib/utils/format";
import type {
  ClientModalData,
  MergedOrder,
  ClientChange,
  DowFlow,
  DowFlowProductDetail,
  ClientChangeResponse,
} from "@/types/dashboard";

// ──────────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────────

/** 데이터 시작일 — 이전 데이터 제외 */
const DATA_START_DATE = "2025-09-01";

/**
 * JS Date.getDay() → 영문 요일 약어
 * getDay(): 0=일, 1=월, ..., 6=토
 */
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** 한글 요일 레이블 (Date.getDay() 인덱스 순) */
const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// ──────────────────────────────────────────────────────────────────
// 내부 유틸
// ──────────────────────────────────────────────────────────────────

/**
 * 숫자 배열의 중간값을 반환합니다.
 * format.ts의 median과 달리, 이 함수는 dowFlows 계산 전용 내부 헬퍼입니다.
 */
function medianOf(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

// ══════════════════════════════════════════════════════════════════
// 내부 유틸: groupByCompany
// ══════════════════════════════════════════════════════════════════

/**
 * MergedOrder[]를 고객사별로 그룹핑하여 요약 통계를 계산합니다.
 */
interface CompanySummary {
  accountId: number;
  accountName: string;
  totalQty: number;
  orderCount: number;
  avgQty: number;
  lastOrderDate: string;
  mainProduct: string;
  productQtyMap: Map<string, number>;
}

function groupByCompany(
  dailyOrders: { date: string; orders: MergedOrder[] }[]
): Map<number, CompanySummary> {
  const map = new Map<number, CompanySummary>();

  for (const { date, orders } of dailyOrders) {
    const dateAccounts = new Set<number>();
    for (const o of orders) {
      dateAccounts.add(o.accountId);
      const existing = map.get(o.accountId);
      if (existing) {
        existing.totalQty += o.quantity;
        if (date > existing.lastOrderDate) existing.lastOrderDate = date;
        existing.productQtyMap.set(
          o.productName,
          (existing.productQtyMap.get(o.productName) || 0) + o.quantity
        );
      } else {
        const productQtyMap = new Map<string, number>();
        productQtyMap.set(o.productName, o.quantity);
        map.set(o.accountId, {
          accountId: o.accountId,
          accountName: o.accountName,
          totalQty: o.quantity,
          orderCount: 0,
          avgQty: 0,
          lastOrderDate: date,
          mainProduct: "",
          productQtyMap,
        });
      }
    }
    for (const acctId of dateAccounts) {
      const summary = map.get(acctId);
      if (summary) summary.orderCount += 1;
    }
  }

  for (const summary of map.values()) {
    summary.avgQty =
      summary.orderCount > 0
        ? Math.round((summary.totalQty / summary.orderCount) * 10) / 10
        : 0;
    let maxQty = 0;
    for (const [pname, qty] of summary.productQtyMap) {
      if (qty > maxQty) {
        maxQty = qty;
        summary.mainProduct = pname;
      }
    }
  }
  return map;
}

// ══════════════════════════════════════════════════════════════════
// 고객사 상세 모달 데이터 조회
// ══════════════════════════════════════════════════════════════════

/**
 * 고객사 상세 모달에 필요한 전체 데이터를 조회합니다.
 *
 * 조회 항목:
 *   1) 계정 기본 정보 (이름, 주문요일, 구독/종료/전환 날짜)
 *   2) 첫/마지막 주문일, 총 주문 횟수
 *   3) 서비스 이용일 계산
 *   4) 전체 기간 일별 수량 → 평균/중간값
 *   5) 전체 기간 상품별 일별 수량 → 상품별 평균/중간값
 *   6) 상품 목록 + 색상
 *   7) 최근 30영업일 추이 데이터 (차트용)
 *
 * @param accountId   accounts.id
 * @param clientType  "churned" | "new" | "converted"
 */
export async function getClientModalData(
  accountId: number,
  clientType: string = "churned"
): Promise<ClientModalData> {
  // ══════════════════════════════════════════
  // 1) 계정 정보 조회
  // ══════════════════════════════════════════
  const accountRows = (await queryMySQL(
    `SELECT name, order_day, subscription_at, terminate_at, subscription_scheduled_at
     FROM accounts WHERE id = ?`,
    [accountId]
  )) as Record<string, unknown>[];

  const acct = accountRows[0] || {};
  const subscriptionAt = toDateStr(acct.subscription_at);
  const terminateAt = toDateStr(acct.terminate_at);
  const subscriptionScheduledAt = toDateStr(acct.subscription_scheduled_at);
  const dbAccountName = acct.name ? String(acct.name) : null;
  const orderDays = parseOrderDay(acct.order_day, true); // 한글 변환

  // ══════════════════════════════════════════
  // 2) 첫/마지막 주문일 + 총 주문 횟수
  // ══════════════════════════════════════════
  const dateRows = (await queryMySQL(
    `SELECT MIN(o.delivery_date) AS first_date,
            MAX(o.delivery_date) AS last_date,
            COUNT(DISTINCT o.delivery_date) AS total_orders
     FROM orders o
     WHERE o.account_id = ? AND o.deleted_at IS NULL`,
    [accountId]
  )) as Record<string, unknown>[];

  const firstOrderDate = toDateStr(dateRows[0]?.first_date);
  const lastOrderDate = toDateStr(dateRows[0]?.last_date);
  const totalOrders = Number(dateRows[0]?.total_orders) || 0;

  // ══════════════════════════════════════════
  // 3) 총 서비스 이용일 계산
  // ══════════════════════════════════════════
  let serviceDays: number | null = null;
  if (clientType === "churned" && subscriptionAt && terminateAt) {
    serviceDays = Math.round(
      (new Date(terminateAt).getTime() - new Date(subscriptionAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );
  } else if (clientType === "new" && subscriptionAt) {
    serviceDays = Math.round(
      (new Date(getToday()).getTime() - new Date(subscriptionAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );
  }

  // ══════════════════════════════════════════
  // 4) 전체 기간 일별 수량 (전체 평균/중간값 산출용)
  // ══════════════════════════════════════════
  const allDailyRows = (await queryMySQL(
    `SELECT o.delivery_date,
            CAST(SUM(od.quantity) AS SIGNED) AS day_qty
     FROM orders o
     JOIN \`order-details\` od ON od.order_id = o.id
     WHERE o.account_id = ?
       AND o.deleted_at IS NULL AND od.deleted_at IS NULL
     GROUP BY o.delivery_date
     ORDER BY o.delivery_date`,
    [accountId]
  )) as Record<string, unknown>[];

  const allQtyList = allDailyRows
    .map((r) => Number(r.day_qty) || 0)
    .filter((q) => q > 0)
    .sort((a, b) => a - b);

  const avgQty =
    allQtyList.length > 0
      ? Math.round(
          (allQtyList.reduce((s, q) => s + q, 0) / allQtyList.length) * 10
        ) / 10
      : 0;
  const medianQty = median(allQtyList);

  // ══════════════════════════════════════════
  // 5) 전체 기간 상품별 일별 수량 (상품별 평균/중간값 산출용)
  // ══════════════════════════════════════════
  const allProductDailyRows = (await queryMySQL(
    `SELECT o.delivery_date,
            od.product_id,
            CAST(SUM(od.quantity) AS SIGNED) AS day_qty
     FROM orders o
     JOIN \`order-details\` od ON od.order_id = o.id
     WHERE o.account_id = ?
       AND o.deleted_at IS NULL AND od.deleted_at IS NULL
     GROUP BY o.delivery_date, od.product_id
     ORDER BY o.delivery_date, od.product_id`,
    [accountId]
  )) as Record<string, unknown>[];

  // ══════════════════════════════════════════
  // 6) 상품 목록 + 색상
  // ══════════════════════════════════════════
  const colorMap = await getProductColorMap();
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, product_name, product_id_mappings(channel, external_id)")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const productList = (products || []).map((p, idx) => {
    const name = String(p.product_name);
    return {
      productName: name,
      color: colorMap.get(name) || PRESET_COLORS[idx % PRESET_COLORS.length],
    };
  });

  // external_id → productName 매핑 (web 채널 기준)
  const extIdToName = new Map<string, string>();
  for (const p of products || []) {
    const raw = p as Record<string, unknown>;
    const mappings = (raw.product_id_mappings || []) as {
      channel: string;
      external_id: string;
    }[];
    for (const m of mappings) {
      if (m.channel === "web") {
        extIdToName.set(String(m.external_id), String(raw.product_name));
      }
    }
  }

  // ══════════════════════════════════════════
  // 7) 상품별 평균 / 중간값 (전체 기간)
  // ══════════════════════════════════════════
  const productDailyMap = new Map<string, number[]>();
  for (const row of allProductDailyRows) {
    const extId = String(row.product_id);
    const pName = extIdToName.get(extId);
    if (!pName) continue;
    const qty = Number(row.day_qty) || 0;
    if (qty <= 0) continue;
    if (!productDailyMap.has(pName)) productDailyMap.set(pName, []);
    productDailyMap.get(pName)!.push(qty);
  }

  const productStats = productList.map((pl) => {
    const qtyArr = productDailyMap.get(pl.productName) || [];
    const avg =
      qtyArr.length > 0
        ? Math.round(
            (qtyArr.reduce((s, q) => s + q, 0) / qtyArr.length) * 10
          ) / 10
        : 0;
    return { productName: pl.productName, avg, median: median(qtyArr) };
  });

  // ══════════════════════════════════════════
  // 8) 최근 30영업일 추이 데이터 (차트용)
  // ══════════════════════════════════════════
  const today = getToday();
  const allDates: string[] = [];
  let cursor = addDays(today, -45);
  while (cursor <= today) {
    const [y, m, d] = cursor.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dow = dateObj.getDay();
    if (dow >= 1 && dow <= 6) allDates.push(cursor); // 월~토
    cursor = addDays(cursor, 1);
  }
  const recentDates = allDates.slice(-30);

  const dailyResults = await Promise.all(
    recentDates.map(async (d) => {
      const { orders } = await getOrdersByDate(d);
      const acctOrders = orders.filter((o) => o.accountId === accountId);
      const totalQtyDay = acctOrders.reduce((s, o) => s + o.quantity, 0);
      return { date: d, qty: totalQtyDay, orders: acctOrders };
    })
  );

  const recentTrend: ClientModalData["recentTrend"] = recentDates.map((d) => {
    const found = dailyResults.find((r) => r.date === d);
    const row: ClientModalData["recentTrend"][number] = {
      date: d,
      qty: found?.qty || 0,
    };
    for (const pl of productList) {
      row[pl.productName] = (found?.orders || [])
        .filter((o) => o.productName === pl.productName)
        .reduce((s, o) => s + o.quantity, 0);
    }
    return row;
  });

  // ══════════════════════════════════════════
  // 9) 고객사명
  // ══════════════════════════════════════════
  const orderedDays = dailyResults.filter((d) => d.qty > 0);
  const accountName =
    dbAccountName ||
    orderedDays[0]?.orders[0]?.accountName ||
    `고객사 #${accountId}`;

  // ══════════════════════════════════════════
  // 응답
  // ══════════════════════════════════════════
  return {
    accountId,
    accountName,
    clientType: clientType as "churned" | "new" | "converted",
    orderDays,
    terminateAt,
    subscriptionAt,
    subscriptionScheduledAt,
    firstOrderDate,
    lastOrderDate,
    serviceDays,
    totalOrders,
    avgQty,
    medianQty,
    productStats,
    productList,
    recentTrend,
  };
}

// ══════════════════════════════════════════════════════════════════
// 고객 변동 현황 조회
// ══════════════════════════════════════════════════════════════════

/**
 * 고객 변동 현황을 조회합니다.
 *
 * 분류 기준 (accounts 테이블 기반):
 *   - 이탈(churned): status='disabled' AND terminate_at이 현재 기간 내
 *   - 신규(new): status='available' AND subscription_at이 현재 기간 내
 *   - 전환예정(converted): status='scheduled' AND subscription_scheduled_at이 현재 기간 내
 *
 * 전기 대비 증감: prevStart~prevEnd 기간의 동일 조건 카운트와 비교
 *
 * @param startDate     현재 기간 시작일
 * @param endDate       현재 기간 종료일
 * @param prevStartDate 이전 기간 시작일
 * @param prevEndDate   이전 기간 종료일
 */
export async function getClientChangeData(
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string
): Promise<ClientChangeResponse> {
  // ═══════════════════════════════════════
  // 1) 현재 기간 이탈/신규/전환예정 조회
  // ═══════════════════════════════════════

  const churnedRows = (await queryMySQL(
    `SELECT a.id, a.name, a.status, a.terminate_at,
            a.subscription_at, a.order_day
     FROM accounts a
     WHERE a.status = 'disabled'
       AND a.terminate_at IS NOT NULL
       AND a.terminate_at >= ?
       AND a.terminate_at <= ?
       AND a.subscription_at IS NOT NULL`,
    [startDate, endDate]
  )) as Record<string, unknown>[];

  const newRows = (await queryMySQL(
    `SELECT a.id, a.name, a.status, a.subscription_at, a.order_day
     FROM accounts a
     WHERE a.status = 'available'
       AND a.subscription_at >= ?
       AND a.subscription_at <= ?`,
    [startDate, endDate]
  )) as Record<string, unknown>[];

  const convertedRows = (await queryMySQL(
    `SELECT a.id, a.name, a.status,
            a.subscription_scheduled_at, a.order_day
     FROM accounts a
     WHERE a.status = 'scheduled'
       AND a.subscription_scheduled_at >= ?
       AND a.subscription_scheduled_at <= ?`,
    [startDate, endDate]
  )) as Record<string, unknown>[];

  // ═══════════════════════════════════════
  // 2) 이전 기간 카운트 (증감 비교용)
  // ═══════════════════════════════════════

  const prevChurnedRows = (await queryMySQL(
    `SELECT COUNT(*) AS cnt FROM accounts
     WHERE status = 'disabled'
       AND subscription_at IS NOT NULL
       AND terminate_at IS NOT NULL
       AND terminate_at >= ? AND terminate_at <= ?`,
    [prevStartDate, prevEndDate]
  )) as Record<string, unknown>[];

  const prevNewRows = (await queryMySQL(
    `SELECT COUNT(*) AS cnt FROM accounts
     WHERE status = 'available'
       AND subscription_at >= ? AND subscription_at <= ?`,
    [prevStartDate, prevEndDate]
  )) as Record<string, unknown>[];

  const prevConvertedRows = (await queryMySQL(
    `SELECT COUNT(*) AS cnt FROM accounts
     WHERE status = 'scheduled'
       AND subscription_scheduled_at >= ? AND subscription_scheduled_at <= ?`,
    [prevStartDate, prevEndDate]
  )) as Record<string, unknown>[];

  // ═══════════════════════════════════════
  // 3) 각 고객사의 주문 통계 보강
  // ═══════════════════════════════════════

  const allAccountIds = [
    ...churnedRows.map((r) => Number(r.id)),
    ...newRows.map((r) => Number(r.id)),
    ...convertedRows.map((r) => Number(r.id)),
  ];

  const orderStatsMap = new Map<
    number,
    {
      avgQty: number;
      mainProduct: string;
      lastOrderDate: string;
      productAvgs: { productName: string; avg: number }[];
    }
  >();

  if (allAccountIds.length > 0) {
    const placeholders = allAccountIds.map(() => "?").join(",");

    // 평균 수량 & 마지막 주문일
    const statsRows = (await queryMySQL(
      `SELECT daily.account_id,
              ROUND(AVG(daily.day_total), 1) AS avg_qty,
              MAX(daily.delivery_date) AS last_order_date
       FROM (
         SELECT o.account_id, o.delivery_date,
                SUM(od.quantity) AS day_total
         FROM orders o
         JOIN \`order-details\` od ON od.order_id = o.id
         WHERE o.account_id IN (${placeholders})
           AND o.deleted_at IS NULL AND od.deleted_at IS NULL
           AND o.delivery_date >= '${DATA_START_DATE}'
           AND od.product_id <> 21
         GROUP BY o.account_id, o.delivery_date
       ) AS daily
       GROUP BY daily.account_id`,
      allAccountIds
    )) as Record<string, unknown>[];

    for (const row of statsRows) {
      orderStatsMap.set(Number(row.account_id), {
        avgQty: Number(row.avg_qty) || 0,
        mainProduct: "",
        lastOrderDate: toDateStr(row.last_order_date) ?? "",
        productAvgs: [],
      });
    }

    // 상품별 일평균 수량 계산
    const productAvgRows = (await queryMySQL(
      `SELECT daily.account_id, daily.product_name,
              ROUND(AVG(daily.day_total), 1) AS avg_qty
       FROM (
         SELECT o.account_id, od.product_name, o.delivery_date,
                SUM(od.quantity) AS day_total
         FROM orders o
         JOIN \`order-details\` od ON od.order_id = o.id
         WHERE o.account_id IN (${placeholders})
           AND o.deleted_at IS NULL AND od.deleted_at IS NULL
           AND o.delivery_date >= '${DATA_START_DATE}'
           AND od.product_id <> 21
         GROUP BY o.account_id, od.product_name, o.delivery_date
       ) AS daily
       GROUP BY daily.account_id, daily.product_name
       ORDER BY daily.account_id, avg_qty DESC`,
      allAccountIds
    )) as Record<string, unknown>[];

    // 고객사별 상품 평균 배열 구성 + 주력 상품(1위) 설정
    const tempMap = new Map<number, { productName: string; avg: number }[]>();
    for (const row of productAvgRows) {
      const aid = Number(row.account_id);
      if (!tempMap.has(aid)) tempMap.set(aid, []);
      tempMap.get(aid)!.push({
        productName: String(row.product_name || ""),
        avg: Number(row.avg_qty) || 0,
      });
    }

    for (const [aid, products] of tempMap) {
      const existing = orderStatsMap.get(aid);
      if (existing) {
        existing.productAvgs = products;
        if (products.length > 0) {
          existing.mainProduct = products[0].productName;
        }
      }
    }
  }

  // ═══════════════════════════════════════
  // 4) changes 배열 구성
  // ═══════════════════════════════════════

  const changes: ClientChange[] = [];

  for (const row of churnedRows) {
    const aid = Number(row.id);
    const stats = orderStatsMap.get(aid);
    changes.push({
      type: "churned",
      accountId: aid,
      accountName: String(row.name || ""),
      previousAvg: stats?.avgQty ?? 0,
      currentAvg: 0,
      mainProduct: stats?.mainProduct ?? "",
      lastOrderDate: stats?.lastOrderDate ?? null,
      productAvgs: stats?.productAvgs ?? [],
      terminateAt: toDateStr(row.terminate_at),
      subscriptionAt: toDateStr(row.subscription_at),
      subscriptionScheduledAt: null,
    });
  }

  for (const row of newRows) {
    const aid = Number(row.id);
    const stats = orderStatsMap.get(aid);
    changes.push({
      type: "new",
      accountId: aid,
      accountName: String(row.name || ""),
      previousAvg: 0,
      currentAvg: stats?.avgQty ?? 0,
      mainProduct: stats?.mainProduct ?? "",
      lastOrderDate: stats?.lastOrderDate ?? null,
      productAvgs: stats?.productAvgs ?? [],
      terminateAt: null,
      subscriptionAt: toDateStr(row.subscription_at),
      subscriptionScheduledAt: null,
    });
  }

  for (const row of convertedRows) {
    const aid = Number(row.id);
    const stats = orderStatsMap.get(aid);
    changes.push({
      type: "converted",
      accountId: aid,
      accountName: String(row.name || ""),
      previousAvg: 0,
      currentAvg: stats?.avgQty ?? 0,
      mainProduct: stats?.mainProduct ?? "",
      lastOrderDate: stats?.lastOrderDate ?? null,
      productAvgs: stats?.productAvgs ?? [],
      terminateAt: null,
      subscriptionAt: null,
      subscriptionScheduledAt: toDateStr(row.subscription_scheduled_at),
    });
  }

  // ═══════════════════════════════════════
  // 5) 요일별 순변화 (dowFlows) — 평균/중간값 식수 합계
  // ═══════════════════════════════════════

  const dowFlows: DowFlow[] = [];

  // 토요일 포함: 월(1)~토(6)
  const weekdayIndices = [1, 2, 3, 4, 5, 6];

  for (const dayIdx of weekdayIndices) {
    const dowName = DAY_NAMES[dayIdx]; // "mon", "tue", ...
    const dowLabel = DOW_LABELS[dayIdx]; // "월", "화", ...

    // ── 이탈 고객 중 해당 요일이 order_day에 포함된 고객사 ──
    const churnedOnDay = churnedRows.filter((r) => {
      const days = parseOrderDay(r.order_day);
      return days.includes(dowName);
    });

    // ── 신규 고객 중 해당 요일이 order_day에 포함된 고객사 ──
    const newOnDay = newRows.filter((r) => {
      const days = parseOrderDay(r.order_day);
      return days.includes(dowName);
    });

    // 이탈 - 전체 평균/중간값 식수 합계
    const churnedAvgs = churnedOnDay.map(
      (r) => orderStatsMap.get(Number(r.id))?.avgQty ?? 0
    );
    const churnedAvgSum =
      Math.round(churnedAvgs.reduce((s, v) => s + v, 0) * 10) / 10;
    const churnedMedianSum =
      churnedAvgs.length > 0
        ? Math.round(medianOf(churnedAvgs) * churnedAvgs.length * 10) / 10
        : 0;

    // 신규 - 전체 평균/중간값 식수 합계
    const newAvgs = newOnDay.map(
      (r) => orderStatsMap.get(Number(r.id))?.avgQty ?? 0
    );
    const newAvgSum =
      Math.round(newAvgs.reduce((s, v) => s + v, 0) * 10) / 10;
    const newMedianSum =
      newAvgs.length > 0
        ? Math.round(medianOf(newAvgs) * newAvgs.length * 10) / 10
        : 0;

    // ── 상품별 집계 ──
    const productMap = new Map<
      string,
      { churnedAvgs: number[]; newAvgs: number[] }
    >();

    for (const r of churnedOnDay) {
      const stats = orderStatsMap.get(Number(r.id));
      for (const pa of stats?.productAvgs ?? []) {
        if (!productMap.has(pa.productName)) {
          productMap.set(pa.productName, { churnedAvgs: [], newAvgs: [] });
        }
        productMap.get(pa.productName)!.churnedAvgs.push(pa.avg);
      }
    }

    for (const r of newOnDay) {
      const stats = orderStatsMap.get(Number(r.id));
      for (const pa of stats?.productAvgs ?? []) {
        if (!productMap.has(pa.productName)) {
          productMap.set(pa.productName, { churnedAvgs: [], newAvgs: [] });
        }
        productMap.get(pa.productName)!.newAvgs.push(pa.avg);
      }
    }

    const products: DowFlowProductDetail[] = Array.from(
      productMap.entries()
    ).map(([name, data]) => ({
      productName: name,
      churnedAvgSum:
        Math.round(data.churnedAvgs.reduce((s, v) => s + v, 0) * 10) / 10,
      churnedMedianSum:
        data.churnedAvgs.length > 0
          ? Math.round(
              medianOf(data.churnedAvgs) * data.churnedAvgs.length * 10
            ) / 10
          : 0,
      newAvgSum:
        Math.round(data.newAvgs.reduce((s, v) => s + v, 0) * 10) / 10,
      newMedianSum:
        data.newAvgs.length > 0
          ? Math.round(
              medianOf(data.newAvgs) * data.newAvgs.length * 10
            ) / 10
          : 0,
    }));

    dowFlows.push({
      dow: dowName,
      dowLabel,
      churnedAvgSum,
      churnedMedianSum,
      newAvgSum,
      newMedianSum,
      netAvg: Math.round((newAvgSum - churnedAvgSum) * 10) / 10,
      netMedian: Math.round((newMedianSum - churnedMedianSum) * 10) / 10,
      products,
    });
  }

  // ═══════════════════════════════════════
  // 6) summary (증감 포함)
  // ═══════════════════════════════════════

  const churnedCount = churnedRows.length;
  const newCount = newRows.length;
  const convertedCount = convertedRows.length;

  const prevChurnedCount = Number(prevChurnedRows[0]?.cnt ?? 0);
  const prevNewCount = Number(prevNewRows[0]?.cnt ?? 0);
  const prevConvertedCount = Number(prevConvertedRows[0]?.cnt ?? 0);

  return {
    startDate,
    endDate,
    changes,
    summary: {
      churned: churnedCount,
      new: newCount,
      converted: convertedCount,
      netFlow: newCount + convertedCount - churnedCount,
      churnedDelta: churnedCount - prevChurnedCount,
      newDelta: newCount - prevNewCount,
      convertedDelta: convertedCount - prevConvertedCount,
      prevChurned: prevChurnedCount,
      prevNew: prevNewCount,
      prevConverted: prevConvertedCount,
    },
    dowFlows,
  };
}
