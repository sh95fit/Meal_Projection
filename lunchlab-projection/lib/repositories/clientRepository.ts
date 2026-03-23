// lib/repositories/clientRepository.ts
// ──────────────────────────────────────────────────────────────────
// 고객사 데이터 조회 리포지토리
// - 고객사 상세 모달 데이터 (getClientModalData)
// - 고객 변동 현황 조회 (getClientChangeData)
//
// [리팩토링 변경사항]
// - 상수 → lib/constants/dashboard.ts에서 import (중복 제거)
// - medianOf 삭제 → format.ts의 median 헬퍼로 대체
// - getClientChangeData: 직렬 MySQL 쿼리 → Promise.all 병렬화
// - dowFlows: 고객사별 전체 평균/중간 + 상품별 평균/중간을 요일별 합산
// - 토요일: saturday_available = false 상품 제외
// - getClientModalData: 30영업일 추이 벌크 쿼리화 (30회 → 1회)
//
// [최적화 변경사항]
// #1: getClientModalData 내부 쿼리 병렬화
// #5: lastOrderDate 선형탐색 → 1회 순회 Map 구축
// A-1: Supabase 이중 호출 제거 → getAllProducts + getProductColorMap 캐시 활용
// B-1: getClientModalData 결과 서버 캐시 (2분 TTL)
// A-3: 이전 기간 3개 COUNT → 단일 CASE WHEN 쿼리
// A-4: 현재 기간 + 이전 기간 쿼리를 1회 Promise.all로 완전 병렬화
// ──────────────────────────────────────────────────────────────────

import { queryMySQL } from "@/lib/mysql/client";
import { createClient } from "@/lib/supabase/server";
import { getToday, addDays } from "@/lib/utils/date";
import { getProductColorMap, getAllProducts } from "@/lib/repositories/productRepository";
import { PRESET_COLORS } from "@/lib/utils/color";
import { toDateStr, parseOrderDay, median } from "@/lib/utils/format";
import {
  DATA_START_DATE,
  DAY_NAMES,
  DOW_LABELS,
} from "@/lib/constants/dashboard";
import { cached } from "@/lib/cache";
import type {
  ClientModalData,
  MergedOrder,
  ClientChange,
  DowFlow,
  DowFlowProductDetail,
  ClientChangeResponse,
} from "@/types/dashboard";

// ══════════════════════════════════════════════════════════════════
// 내부 타입
// ══════════════════════════════════════════════════════════════════

interface AccountOrderStats {
  avgQty: number;
  medianQty: number;
  mainProduct: string;
  lastOrderDate: string;
  productAvgs: { productName: string; avg: number; median: number }[];
}

// ══════════════════════════════════════════════════════════════════
// ★ B-1: 고객사 상세 모달 데이터 조회 — 서버 캐시 래핑 (2분)
// ══════════════════════════════════════════════════════════════════

export async function getClientModalData(
  accountId: number,
  clientType: string = "churned"
): Promise<ClientModalData> {
  return cached(
    `clientModal:${accountId}:${clientType}`,
    2 * 60 * 1000,
    () => _getClientModalDataImpl(accountId, clientType)
  );
}

async function _getClientModalDataImpl(
  accountId: number,
  clientType: string
): Promise<ClientModalData> {
  // ═══════════════════════════════════════
  // ★ A-1: getAllProducts + getProductColorMap 캐시 활용
  //   기존: createClient() → supabase.from("products") 직접 호출
  //   개선: 이미 캐시된 getAllProducts()로 제품 목록 확보,
  //         매핑 정보만 별도 Supabase 1회 조회
  // ═══════════════════════════════════════
  const [
    accountRows,
    dateRows,
    allDailyRows,
    allProductDailyRows,
    allProducts,
    colorMap,
    mappingRows,
  ] = await Promise.all([
    // 1) 계정 정보
    queryMySQL(
      `SELECT name, order_day, subscription_at, terminate_at, subscription_scheduled_at
       FROM accounts WHERE id = ?`,
      [accountId]
    ) as Promise<Record<string, unknown>[]>,

    // 2) 첫/마지막 주문일 + 총 주문 횟수
    queryMySQL(
      `SELECT MIN(o.delivery_date) AS first_date,
              MAX(o.delivery_date) AS last_date,
              COUNT(DISTINCT o.delivery_date) AS total_orders
       FROM orders o
       WHERE o.account_id = ? AND o.deleted_at IS NULL`,
      [accountId]
    ) as Promise<Record<string, unknown>[]>,

    // 3) 전체 기간 일별 수량
    queryMySQL(
      `SELECT o.delivery_date,
              CAST(SUM(od.quantity) AS SIGNED) AS day_qty
       FROM orders o
       JOIN \`order-details\` od ON od.order_id = o.id
       WHERE o.account_id = ?
         AND o.deleted_at IS NULL AND od.deleted_at IS NULL
       GROUP BY o.delivery_date
       ORDER BY o.delivery_date`,
      [accountId]
    ) as Promise<Record<string, unknown>[]>,

    // 4) 전체 기간 상품별 일별 수량
    queryMySQL(
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
    ) as Promise<Record<string, unknown>[]>,

    // ★ A-1: 캐시된 제품 목록 (Supabase 직접 호출 없이)
    getAllProducts(),

    // ★ A-1: 캐시된 색상 맵
    getProductColorMap(),

    // 매핑 정보만 Supabase에서 조회 (제품 목록 자체는 캐시 활용)
    (async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("product_id_mappings")
        .select("product_id, channel, external_id");
      return data || [];
    })(),
  ]);

  // ═══════════════════════════════════════
  // 1) 계정 정보 파싱
  // ═══════════════════════════════════════
  const acct = accountRows[0] || {};
  const subscriptionAt = toDateStr(acct.subscription_at);
  const terminateAt = toDateStr(acct.terminate_at);
  const subscriptionScheduledAt = toDateStr(acct.subscription_scheduled_at);
  const dbAccountName = acct.name ? String(acct.name) : null;
  const orderDays = parseOrderDay(acct.order_day, true);

  // ═══════════════════════════════════════
  // 2) 첫/마지막 주문일
  // ═══════════════════════════════════════
  const firstOrderDate = toDateStr(dateRows[0]?.first_date);
  const lastOrderDate = toDateStr(dateRows[0]?.last_date);
  const totalOrders = Number(dateRows[0]?.total_orders) || 0;

  // ═══════════════════════════════════════
  // 3) 총 서비스 이용일 계산
  // ═══════════════════════════════════════
  let serviceDays: number | null = null;
  if (clientType === "churned" && subscriptionAt && terminateAt) {
    serviceDays = Math.round(
      (new Date(terminateAt).getTime() -
        new Date(subscriptionAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );
  } else if (clientType === "new" && subscriptionAt) {
    serviceDays = Math.round(
      (new Date(getToday()).getTime() -
        new Date(subscriptionAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );
  }

  // ═══════════════════════════════════════
  // 4) 전체 평균 / 중간값
  // ═══════════════════════════════════════
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

  // ═══════════════════════════════════════
  // 5) ★ A-1: 상품 목록 + 매핑 구축 (캐시 활용)
  // ═══════════════════════════════════════

  // product_id → product_name 맵 (Supabase products 캐시에서)
  const productIdToName = new Map<number, string>();
  for (const p of allProducts) {
    productIdToName.set(Number(p.id), String(p.product_name));
  }

  // extId(web) → productName 맵 (매핑 테이블에서)
  const extIdToName = new Map<string, string>();
  for (const m of mappingRows) {
    if ((m as Record<string, unknown>).channel === "web") {
      const pName = productIdToName.get(Number((m as Record<string, unknown>).product_id));
      if (pName) {
        extIdToName.set(String((m as Record<string, unknown>).external_id), pName);
      }
    }
  }

  const productList = allProducts.map((p, idx) => {
    const name = String(p.product_name);
    return {
      productName: name,
      color:
        colorMap.get(name) || PRESET_COLORS[idx % PRESET_COLORS.length],
    };
  });

  // ═══════════════════════════════════════
  // 6) 상품별 평균 / 중간값
  // ═══════════════════════════════════════
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

  // ═══════════════════════════════════════
  // 7) 최근 30영업일 추이 데이터 — 벌크 쿼리
  // ═══════════════════════════════════════
  const today = getToday();
  const allDates: string[] = [];
  let cursor = addDays(today, -45);
  while (cursor <= today) {
    const [y, m, d] = cursor.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 6) allDates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  const recentDates = allDates.slice(-30);

  let recentTrend: ClientModalData["recentTrend"] = [];

  if (recentDates.length > 0) {
    const datePlaceholders = recentDates.map(() => "?").join(",");

    const recentOrderRows = (await queryMySQL(
      `SELECT DATE_FORMAT(o.delivery_date, '%Y-%m-%d') AS delivery_date,
              od.product_id,
              CAST(SUM(od.quantity) AS SIGNED) AS qty
       FROM orders o
       JOIN \`order-details\` od ON od.order_id = o.id
       WHERE o.account_id = ?
         AND o.deleted_at IS NULL AND od.deleted_at IS NULL
         AND o.delivery_date IN (${datePlaceholders})
       GROUP BY o.delivery_date, od.product_id
       ORDER BY o.delivery_date`,
      [accountId, ...recentDates]
    )) as { delivery_date: string; product_id: number; qty: number }[];

    const recentDataMap = new Map<string, Map<string, number>>();
    const recentTotalMap = new Map<string, number>();

    for (const row of recentOrderRows) {
      const date = row.delivery_date;
      const pName = extIdToName.get(String(row.product_id));
      const qty = Number(row.qty) || 0;

      if (!recentDataMap.has(date)) recentDataMap.set(date, new Map());
      if (pName) {
        const dayMap = recentDataMap.get(date)!;
        dayMap.set(pName, (dayMap.get(pName) || 0) + qty);
      }
      recentTotalMap.set(date, (recentTotalMap.get(date) || 0) + qty);
    }

    recentTrend = recentDates.map((d) => {
      const dayProductMap = recentDataMap.get(d);
      const row: ClientModalData["recentTrend"][number] = {
        date: d,
        qty: recentTotalMap.get(d) || 0,
      };
      for (const pl of productList) {
        row[pl.productName] = dayProductMap?.get(pl.productName) || 0;
      }
      return row;
    });
  }

  // ═══════════════════════════════════════
  // 8) 고객사명
  // ═══════════════════════════════════════
  const accountName = dbAccountName || `고객사 #${accountId}`;

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

export async function getClientChangeData(
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string
): Promise<ClientChangeResponse> {
  // ═══════════════════════════════════════
  // ★ A-4: 현재 기간 3쿼리 + A-3: 이전 기간 통합 1쿼리 → 총 4쿼리 1회 Promise.all
  // ═══════════════════════════════════════
  const [churnedRows, newRows, convertedRows, prevCountRows] = (await Promise.all([
    queryMySQL(
      `SELECT a.id, a.name, a.status, a.terminate_at,
              a.subscription_at, a.order_day
       FROM accounts a
       WHERE a.status = 'disabled'
         AND a.terminate_at IS NOT NULL
         AND a.terminate_at >= ?
         AND a.terminate_at <= ?
         AND a.subscription_at IS NOT NULL`,
      [startDate, endDate]
    ),
    queryMySQL(
      `SELECT a.id, a.name, a.status, a.subscription_at, a.order_day
       FROM accounts a
       WHERE a.status = 'available'
         AND a.subscription_at >= ?
         AND a.subscription_at <= ?`,
      [startDate, endDate]
    ),
    queryMySQL(
      `SELECT a.id, a.name, a.status,
              a.subscription_scheduled_at, a.order_day
       FROM accounts a
       WHERE a.status = 'scheduled'
         AND a.subscription_scheduled_at >= ?
         AND a.subscription_scheduled_at <= ?`,
      [startDate, endDate]
    ),
    // ★ A-3: 이전 기간 3개 COUNT → 단일 CASE WHEN
    queryMySQL(
      `SELECT
         SUM(CASE WHEN status = 'disabled'
                   AND subscription_at IS NOT NULL
                   AND terminate_at IS NOT NULL
                   AND terminate_at >= ? AND terminate_at <= ?
              THEN 1 ELSE 0 END) AS prev_churned,
         SUM(CASE WHEN status = 'available'
                   AND subscription_at >= ? AND subscription_at <= ?
              THEN 1 ELSE 0 END) AS prev_new,
         SUM(CASE WHEN status = 'scheduled'
                   AND subscription_scheduled_at >= ? AND subscription_scheduled_at <= ?
              THEN 1 ELSE 0 END) AS prev_converted
       FROM accounts
       WHERE status IN ('disabled', 'available', 'scheduled')`,
      [prevStartDate, prevEndDate, prevStartDate, prevEndDate, prevStartDate, prevEndDate]
    ),
  ])) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]];

  const prevChurnedCount = Number(prevCountRows[0]?.prev_churned ?? 0);
  const prevNewCount = Number(prevCountRows[0]?.prev_new ?? 0);
  const prevConvertedCount = Number(prevCountRows[0]?.prev_converted ?? 0);

  // ═══════════════════════════════════════
  // 3) 각 고객사의 주문 통계 (중간값 포함)
  // ═══════════════════════════════════════
  const allAccountIds = [
    ...churnedRows.map((r) => Number(r.id)),
    ...newRows.map((r) => Number(r.id)),
    ...convertedRows.map((r) => Number(r.id)),
  ];

  const orderStatsMap = new Map<number, AccountOrderStats>();

  if (allAccountIds.length > 0) {
    const placeholders = allAccountIds.map(() => "?").join(",");

    const [dailyRawRows, productDailyRawRows] = (await Promise.all([
      queryMySQL(
        `SELECT o.account_id, o.delivery_date,
                CAST(SUM(od.quantity) AS SIGNED) AS day_total
         FROM orders o
         JOIN \`order-details\` od ON od.order_id = o.id
         WHERE o.account_id IN (${placeholders})
           AND o.deleted_at IS NULL AND od.deleted_at IS NULL
           AND o.delivery_date >= '${DATA_START_DATE}'
           AND od.product_id <> 21
         GROUP BY o.account_id, o.delivery_date
         ORDER BY o.account_id, o.delivery_date`,
        allAccountIds
      ),
      queryMySQL(
        `SELECT o.account_id, od.product_name, o.delivery_date,
                CAST(SUM(od.quantity) AS SIGNED) AS day_total
         FROM orders o
         JOIN \`order-details\` od ON od.order_id = o.id
         WHERE o.account_id IN (${placeholders})
           AND o.deleted_at IS NULL AND od.deleted_at IS NULL
           AND o.delivery_date >= '${DATA_START_DATE}'
           AND od.product_id <> 21
         GROUP BY o.account_id, od.product_name, o.delivery_date
         ORDER BY o.account_id, od.product_name, o.delivery_date`,
        allAccountIds
      ),
    ])) as [Record<string, unknown>[], Record<string, unknown>[]];

    // ★ #5: lastOrderDate를 1회 순회 Map으로 수집
    const dailyByAccount = new Map<number, number[]>();
    const lastOrderDateMap = new Map<number, string>();

    for (const row of dailyRawRows) {
      const aid = Number(row.account_id);
      const qty = Number(row.day_total) || 0;
      const dateStr = toDateStr(row.delivery_date) ?? "";

      if (qty > 0) {
        if (!dailyByAccount.has(aid)) dailyByAccount.set(aid, []);
        dailyByAccount.get(aid)!.push(qty);
      }

      const existing = lastOrderDateMap.get(aid);
      if (!existing || dateStr > existing) {
        lastOrderDateMap.set(aid, dateStr);
      }
    }

    for (const aid of allAccountIds) {
      const qtyArr = dailyByAccount.get(aid) || [];
      const avgQty =
        qtyArr.length > 0
          ? Math.round((qtyArr.reduce((s, q) => s + q, 0) / qtyArr.length) * 10) / 10
          : 0;
      const medianQty = median(qtyArr);

      orderStatsMap.set(aid, {
        avgQty,
        medianQty,
        mainProduct: "",
        lastOrderDate: lastOrderDateMap.get(aid) ?? "",
        productAvgs: [],
      });
    }

    // 상품별 통계
    const productDailyByAccount = new Map<number, Map<string, number[]>>();
    for (const row of productDailyRawRows) {
      const aid = Number(row.account_id);
      const pName = String(row.product_name || "");
      const qty = Number(row.day_total) || 0;
      if (qty <= 0 || !pName) continue;
      if (!productDailyByAccount.has(aid)) productDailyByAccount.set(aid, new Map());
      const pMap = productDailyByAccount.get(aid)!;
      if (!pMap.has(pName)) pMap.set(pName, []);
      pMap.get(pName)!.push(qty);
    }

    for (const [aid, pMap] of productDailyByAccount) {
      const stats = orderStatsMap.get(aid);
      if (!stats) continue;

      const prodArr: { productName: string; avg: number; median: number }[] = [];
      let maxAvg = 0;
      let mainProduct = "";

      for (const [pName, qtyArr] of pMap) {
        const avg =
          qtyArr.length > 0
            ? Math.round((qtyArr.reduce((s, q) => s + q, 0) / qtyArr.length) * 10) / 10
            : 0;
        const med = median(qtyArr);
        prodArr.push({ productName: pName, avg, median: med });
        if (avg > maxAvg) {
          maxAvg = avg;
          mainProduct = pName;
        }
      }

      prodArr.sort((a, b) => b.avg - a.avg);
      stats.productAvgs = prodArr;
      stats.mainProduct = mainProduct;
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
      productAvgs: (stats?.productAvgs ?? []).map((pa) => ({
        productName: pa.productName,
        avg: pa.avg,
      })),
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
      productAvgs: (stats?.productAvgs ?? []).map((pa) => ({
        productName: pa.productName,
        avg: pa.avg,
      })),
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
      productAvgs: (stats?.productAvgs ?? []).map((pa) => ({
        productName: pa.productName,
        avg: pa.avg,
      })),
      terminateAt: null,
      subscriptionAt: null,
      subscriptionScheduledAt: toDateStr(row.subscription_scheduled_at),
    });
  }

  // ═══════════════════════════════════════
  // 5) 요일별 순변화 (dowFlows)
  // ═══════════════════════════════════════
  const allProducts = await getAllProducts();
  const saturdayAvailableMap = new Map<string, boolean>();
  for (const p of allProducts) {
    saturdayAvailableMap.set(p.product_name, p.saturday_available);
  }

  const dowFlows: DowFlow[] = [];
  const weekdayIndices = [1, 2, 3, 4, 5, 6];

  for (const dayIdx of weekdayIndices) {
    const dowName = DAY_NAMES[dayIdx];
    const dowLabel = DOW_LABELS[dayIdx];
    const isSaturday = dayIdx === 6;

    const churnedOnDay = churnedRows.filter((r) => {
      const days = parseOrderDay(r.order_day);
      return days.includes(dowName);
    });

    const newOnDay = newRows.filter((r) => {
      const days = parseOrderDay(r.order_day);
      return days.includes(dowName);
    });

    let churnedAvgSum = 0;
    let churnedMedianSum = 0;
    for (const r of churnedOnDay) {
      const stats = orderStatsMap.get(Number(r.id));
      if (!stats) continue;
      churnedAvgSum += stats.avgQty;
      churnedMedianSum += stats.medianQty;
    }
    churnedAvgSum = Math.round(churnedAvgSum * 10) / 10;
    churnedMedianSum = Math.round(churnedMedianSum * 10) / 10;

    let newAvgSum = 0;
    let newMedianSum = 0;
    for (const r of newOnDay) {
      const stats = orderStatsMap.get(Number(r.id));
      if (!stats) continue;
      newAvgSum += stats.avgQty;
      newMedianSum += stats.medianQty;
    }
    newAvgSum = Math.round(newAvgSum * 10) / 10;
    newMedianSum = Math.round(newMedianSum * 10) / 10;

    const productMap = new Map<
      string,
      { churnedAvgSum: number; churnedMedianSum: number; newAvgSum: number; newMedianSum: number }
    >();

    for (const r of churnedOnDay) {
      const stats = orderStatsMap.get(Number(r.id));
      if (!stats) continue;
      for (const pa of stats.productAvgs) {
        if (isSaturday && saturdayAvailableMap.get(pa.productName) === false) continue;
        if (!productMap.has(pa.productName)) {
          productMap.set(pa.productName, { churnedAvgSum: 0, churnedMedianSum: 0, newAvgSum: 0, newMedianSum: 0 });
        }
        const entry = productMap.get(pa.productName)!;
        entry.churnedAvgSum += pa.avg;
        entry.churnedMedianSum += pa.median;
      }
    }

    for (const r of newOnDay) {
      const stats = orderStatsMap.get(Number(r.id));
      if (!stats) continue;
      for (const pa of stats.productAvgs) {
        if (isSaturday && saturdayAvailableMap.get(pa.productName) === false) continue;
        if (!productMap.has(pa.productName)) {
          productMap.set(pa.productName, { churnedAvgSum: 0, churnedMedianSum: 0, newAvgSum: 0, newMedianSum: 0 });
        }
        const entry = productMap.get(pa.productName)!;
        entry.newAvgSum += pa.avg;
        entry.newMedianSum += pa.median;
      }
    }

    if (isSaturday) {
      churnedAvgSum = 0;
      churnedMedianSum = 0;
      newAvgSum = 0;
      newMedianSum = 0;

      for (const r of churnedOnDay) {
        const stats = orderStatsMap.get(Number(r.id));
        if (!stats) continue;
        for (const pa of stats.productAvgs) {
          if (saturdayAvailableMap.get(pa.productName) === false) continue;
          churnedAvgSum += pa.avg;
          churnedMedianSum += pa.median;
        }
      }
      for (const r of newOnDay) {
        const stats = orderStatsMap.get(Number(r.id));
        if (!stats) continue;
        for (const pa of stats.productAvgs) {
          if (saturdayAvailableMap.get(pa.productName) === false) continue;
          newAvgSum += pa.avg;
          newMedianSum += pa.median;
        }
      }

      churnedAvgSum = Math.round(churnedAvgSum * 10) / 10;
      churnedMedianSum = Math.round(churnedMedianSum * 10) / 10;
      newAvgSum = Math.round(newAvgSum * 10) / 10;
      newMedianSum = Math.round(newMedianSum * 10) / 10;
    }

    const productsArr: DowFlowProductDetail[] = Array.from(productMap.entries()).map(([name, data]) => ({
      productName: name,
      churnedAvgSum: Math.round(data.churnedAvgSum * 10) / 10,
      churnedMedianSum: Math.round(data.churnedMedianSum * 10) / 10,
      newAvgSum: Math.round(data.newAvgSum * 10) / 10,
      newMedianSum: Math.round(data.newMedianSum * 10) / 10,
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
      products: productsArr,
    });
  }

  // ═══════════════════════════════════════
  // 6) summary
  // ═══════════════════════════════════════
  const churnedCount = churnedRows.length;
  const newCount = newRows.length;
  const convertedCount = convertedRows.length;

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