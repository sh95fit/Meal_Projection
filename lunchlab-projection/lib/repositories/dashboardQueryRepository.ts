// ──────────────────────────────────────────────────────────────────
// lib/repositories/dashboardQueryRepository.ts
// LunchLab 대시보드 — 데이터 조회 리포지토리
// ──────────────────────────────────────────────────────────────────

import { queryMySQL } from "@/lib/mysql/client";
import { createClient } from "@/lib/supabase/server";
import { getToday, addDays, isBusinessDay } from "@/lib/utils/date";
import type {
  MergedOrder,
  OrdersByDateResult,
  RealtimeProduct,
  RealtimeResponse,
  TrendProduct,
  TrendRow,
  TrendResponse,
  DrilldownDetailResponse,
  ProductChip,
  WeekdayCaseClient,
  WeekdayCaseSummary,
  QuantityAnomalyClient,
  ClientChange,
  DowFlow,
  ClientChangeResponse,
} from "@/types/dashboard";

import { getProductColorMap } from "@/lib/repositories/productRepository";
import { PRESET_COLORS } from "@/lib/utils/color";

// ──────────────────────────────────────────────────────────────────
// 상수 정의
// ──────────────────────────────────────────────────────────────────

/** 앱 주문 이관 마감 시각 — 시(hour) */
const CUTOFF_HOUR = 14;

/** 앱 주문 이관 마감 시각 — 분(minute) */
const CUTOFF_MINUTE = 30;

/**
 * 수량 이상 감지 임계값.
 * 지난주 동일 요일 대비 |diff| >= 이 값이면 '특이'로 분류합니다.
 */
const QTY_ANOMALY_THRESHOLD = 3;

/**
 * 데이터 시작일.
 * MySQL 주문 테이블에서 이 날짜 이전 데이터는 조회하지 않습니다.
 */
const DATA_START_DATE = "2025-09-01";

/** 요일 약어 → 한글 매핑 */
const DOW_MAP: Record<string, string> = {
  sun: "일", mon: "월", tue: "화", wed: "수",
  thu: "목", fri: "금", sat: "토",
};

/**
 * JS Date.getDay() → 영문 요일 약어
 * getDay(): 0=일, 1=월, ..., 6=토
 */
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** 한글 요일 레이블 (Date.getDay() 인덱스 순) */
const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// ──────────────────────────────────────────────────────────────────
// 내부 유틸: resolveColor
// ──────────────────────────────────────────────────────────────────

/**
 * 상품명에 해당하는 색상을 반환합니다.
 * DB(productRepository)에 색상이 있으면 사용하고,
 * 없으면 PRESET_COLORS에서 인덱스 기반으로 폴백합니다.
 */
function resolveColor(
  productName: string,
  colorMap: Map<string, string>,
  fallbackIndex: number
): string {
  return (
    colorMap.get(productName) ||
    PRESET_COLORS[fallbackIndex % PRESET_COLORS.length]
  );
}

// ══════════════════════════════════════════════════════════════════
// 헬퍼 함수 #1: needsAppMenuMerge
// ══════════════════════════════════════════════════════════════════

/**
 * 주어진 배송일에 대해 앱 주문(selected_menus)을 별도 합산해야 하는지 판단합니다.
 *
 * ── 비즈니스 규칙 ──
 * 배송일 D의 주문 마감 시점 = D-1일(전날) 14:30 KST
 *
 * 즉, 3월 19일 배송 건의 마감은 3월 18일 14:30.
 *   - 마감 전 → selected_menus가 아직 orders로 이관되지 않았으므로 합산 필요 (true)
 *   - 마감 후 → orders에 이미 이관 완료되었으므로 orders만 사용 (false)
 *
 * @param dateStr  배송일 "YYYY-MM-DD"
 * @returns boolean — true면 앱 주문 합산 필요
 */
export function needsAppMenuMerge(dateStr: string): boolean {
  const now = new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  const deliveryDate = new Date(y, m - 1, d);

  const deadlineDate = new Date(deliveryDate);
  deadlineDate.setDate(deadlineDate.getDate() - 1);

  const deadlineUTC = Date.UTC(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate(),
    CUTOFF_HOUR - 9,
    CUTOFF_MINUTE,
    0
  );

  return now.getTime() < deadlineUTC;
}

// ══════════════════════════════════════════════════════════════════
// 헬퍼 함수 #2: getWebOrdersByDate
// ══════════════════════════════════════════════════════════════════

/**
 * 웹 주문(orders + order-details)에서 지정일의 주문을 조회합니다.
 * 체험 주문(trial, accounts.status='considering') 포함.
 *
 * @param dateStr  배송일 "YYYY-MM-DD"
 */
async function getWebOrdersByDate(dateStr: string): Promise<{
  accountId: number;
  accountName: string;
  externalProductId: string;
  quantity: number;
  totalQty: number;
  channel: "web" | "trial";
}[]> {
  const sql = `
    WITH trial_order_ids AS (
      SELECT DISTINCT tso.order_id
      FROM trial_schedules ts
      JOIN trial_schedule_orders tso ON tso.trial_schedule_id = ts.id
      JOIN lead_applications la ON la.id = ts.lead_application_id
      LEFT JOIN accounts a ON la.account_id = a.id
      WHERE ts.trial_at = ?
        AND ts.trial_at >= '${DATA_START_DATE}'
        AND ts.deleted_at IS NULL
        AND tso.deleted_at IS NULL
        AND (a.status = 'considering' OR a.status IS NULL)
    ),
    web AS (
      SELECT
        a.id AS account_id, a.name AS account_name,
        CAST(od.product_id AS CHAR) AS external_product_id,
        CAST(SUM(od.quantity) AS SIGNED) AS quantity,
        'web' AS channel
      FROM orders o
      JOIN \`order-details\` od ON od.order_id = o.id
      JOIN accounts a ON a.id = o.account_id
      WHERE o.delivery_date = ?
        AND o.delivery_date >= '${DATA_START_DATE}'
        AND o.deleted_at IS NULL AND od.deleted_at IS NULL
        AND o.id NOT IN (SELECT order_id FROM trial_order_ids)
      GROUP BY a.id, a.name, od.product_id
    ),
    trial AS (
      SELECT
        a.id AS account_id, a.name AS account_name,
        CAST(od.product_id AS CHAR) AS external_product_id,
        CAST(SUM(od.quantity) AS SIGNED) AS quantity,
        'trial' AS channel
      FROM trial_schedules ts
      JOIN trial_schedule_orders tso ON tso.trial_schedule_id = ts.id
      JOIN lead_applications la ON la.id = ts.lead_application_id
      LEFT JOIN accounts a ON la.account_id = a.id
      JOIN orders o ON o.id = tso.order_id
      JOIN \`order-details\` od ON od.order_id = o.id
      WHERE ts.trial_at = ?
        AND ts.trial_at >= '${DATA_START_DATE}'
        AND ts.deleted_at IS NULL AND tso.deleted_at IS NULL
        AND o.deleted_at IS NULL AND od.deleted_at IS NULL
        AND a.status = 'considering'
      GROUP BY a.id, a.name, od.product_id
    ),
    combined AS (
      SELECT * FROM web UNION ALL SELECT * FROM trial
    )
    SELECT c.account_id, c.account_name, c.external_product_id,
           c.quantity, c.channel,
           SUM(c.quantity) OVER (PARTITION BY c.account_id) AS total_qty
    FROM combined c
    ORDER BY c.account_id, c.external_product_id
  `;

  const rows = await queryMySQL(sql, [dateStr, dateStr, dateStr]);
  return (rows as Record<string, unknown>[]).map((r) => ({
    accountId: Number(r.account_id) || 0,
    accountName: String(r.account_name || ""),
    externalProductId: String(r.external_product_id || ""),
    quantity: Number(r.quantity) || 0,
    totalQty: Number(r.total_qty) || 0,
    channel: r.channel as "web" | "trial",
  }));
}

// ══════════════════════════════════════════════════════════════════
// 헬퍼 함수 #3: getAppOrdersByDate
// ══════════════════════════════════════════════════════════════════

/**
 * 앱 주문(selected_menus 체인)에서 지정일의 주문을 조회합니다.
 *
 * @param dateStr  배송일 "YYYY-MM-DD"
 */
async function getAppOrdersByDate(dateStr: string): Promise<{
  accountId: number;
  accountName: string;
  externalProductId: string;
  quantity: number;
  totalQty: number;
  minOrderQuantity: number;
}[]> {
  const sql = `
    SELECT
      a.id AS account_id, a.name AS account_name,
      CAST(sm2.product_id AS CHAR) AS external_product_id,
      CAST(COUNT(*) AS SIGNED) AS quantity,
      a.min_order_quantity,
      SUM(COUNT(*)) OVER (PARTITION BY a.id) AS total_qty
    FROM selected_menus sm
    JOIN scheduled_menus sm2 ON sm.scheduled_menu_id = sm2.id
    JOIN schedules s ON s.id = sm.schedule_id
    JOIN order_profiles op ON op.id = sm.order_profile_id
    JOIN accounts a ON a.record_id = op.company_id
    WHERE a.status = 'available'
      AND sm.is_skipped = 0
      AND s.delivery_on = ?
      AND s.delivery_on >= '${DATA_START_DATE}'
    GROUP BY a.id, a.name, sm2.product_id, a.min_order_quantity
    ORDER BY a.id, sm2.product_id
  `;

  const rows = await queryMySQL(sql, [dateStr]);
  return (rows as Record<string, unknown>[]).map((r) => ({
    accountId: Number(r.account_id) || 0,
    accountName: String(r.account_name || ""),
    externalProductId: String(r.external_product_id || ""),
    quantity: Number(r.quantity) || 0,
    totalQty: Number(r.total_qty) || 0,
    minOrderQuantity: Number(r.min_order_quantity) || 0,
  }));
}

// ══════════════════════════════════════════════════════════════════
// 헬퍼 함수 #4: mergeOrders
// ══════════════════════════════════════════════════════════════════

/**
 * 웹 주문과 앱 주문을 Supabase product_id_mappings를 이용해 합산합니다.
 *
 * @param webOrders  getWebOrdersByDate 반환값
 * @param appOrders  getAppOrdersByDate 반환값
 * @returns MergedOrder[] — 내부 productId 기준으로 합산된 주문 목록
 */
async function mergeOrders(
  webOrders: Awaited<ReturnType<typeof getWebOrdersByDate>>,
  appOrders: Awaited<ReturnType<typeof getAppOrdersByDate>>
): Promise<MergedOrder[]> {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, product_name, product_id_mappings(channel, external_id)")
    .is("deleted_at", null);

  if (!products || products.length === 0) return [];

  // 매핑 맵: "web:외부ID" | "app:외부ID" → { productId, productName }
  const mappingMap = new Map<string, { productId: number; productName: string }>();
  for (const p of products) {
    const raw = p as Record<string, unknown>;
    const mappings = (raw.product_id_mappings || []) as { channel: string; external_id: string }[];
    for (const m of mappings) {
      mappingMap.set(`${m.channel}:${m.external_id}`, {
        productId: Number(raw.id),
        productName: String(raw.product_name),
      });
    }
  }

  // 합산 맵: "accountId:productId" → 집계 데이터
  const merged = new Map<string, {
    accountId: number; accountName: string;
    productId: number; productName: string;
    quantity: number; totalQty: number;
    hasWeb: boolean; hasApp: boolean; isTrial: boolean;
  }>();

  function addToMerged(
    accountId: number, accountName: string,
    productId: number, productName: string,
    quantity: number, totalQty: number,
    source: "web" | "app" | "trial"
  ) {
    const key = `${accountId}:${productId}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.totalQty = Math.max(existing.totalQty, totalQty);
      if (source === "web") existing.hasWeb = true;
      if (source === "app") existing.hasApp = true;
      if (source === "trial") existing.isTrial = true;
    } else {
      merged.set(key, {
        accountId, accountName, productId, productName,
        quantity, totalQty,
        hasWeb: source === "web",
        hasApp: source === "app",
        isTrial: source === "trial",
      });
    }
  }

  for (const row of webOrders) {
    const mapped = mappingMap.get(`web:${row.externalProductId}`);
    if (!mapped) continue;
    addToMerged(
      row.accountId, row.accountName,
      mapped.productId, mapped.productName,
      row.quantity, row.totalQty, row.channel
    );
  }

  for (const row of appOrders) {
    const mapped = mappingMap.get(`app:${row.externalProductId}`);
    if (!mapped) continue;
    addToMerged(
      row.accountId, row.accountName,
      mapped.productId, mapped.productName,
      row.quantity, row.totalQty, "app"
    );
  }

  const result: MergedOrder[] = [];
  for (const v of merged.values()) {
    let channel: MergedOrder["channel"];
    if (v.isTrial) channel = "trial";
    else if (v.hasWeb && v.hasApp) channel = "both";
    else if (v.hasApp) channel = "app";
    else channel = "web";
    result.push({
      accountId: v.accountId, accountName: v.accountName,
      productId: v.productId, productName: v.productName,
      quantity: v.quantity, totalQty: v.totalQty, channel,
    });
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════
// 헬퍼 함수 #5: getOrdersByDate (진입점)
// ══════════════════════════════════════════════════════════════════

/**
 * 지정 배송일의 전체 주문을 조회합니다.
 * needsAppMenuMerge()로 분기 판단 후, 웹만 또는 웹+앱을 합산합니다.
 *
 * @param dateStr  배송일 "YYYY-MM-DD"
 */
export async function getOrdersByDate(dateStr: string): Promise<OrdersByDateResult> {
  const webOrders = await getWebOrdersByDate(dateStr);
  if (needsAppMenuMerge(dateStr)) {
    const appOrders = await getAppOrdersByDate(dateStr);
    const orders = await mergeOrders(webOrders, appOrders);
    return { orders, appOrdersMerged: true };
  } else {
    const orders = await mergeOrders(webOrders, []);
    return { orders, appOrdersMerged: false };
  }
}

// ══════════════════════════════════════════════════════════════════
// 헬퍼 함수 #6: formatDayLabel
// ══════════════════════════════════════════════════════════════════

/**
 * 날짜 문자열을 "MM/DD(요일)" 형태의 차트 레이블로 변환합니다.
 */
function formatDayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  const [y2, m2, d2] = dateStr.split("-").map(Number);
  const dateObj = new Date(y2, m2 - 1, d2);
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}(${DOW_LABELS[dateObj.getDay()]})`;
}

// ══════════════════════════════════════════════════════════════════
// 헬퍼 함수 #7: parseOrderDayField
// ══════════════════════════════════════════════════════════════════

/**
 * MySQL accounts.order_day 필드를 파싱하여 요일 약어 배열을 반환합니다.
 *
 * order_day 컬럼 형식:
 *   - JSON 배열 문자열: '["mon","tue","wed","thu","fri"]'
 *   - null 또는 빈 문자열
 *
 * @param raw  MySQL에서 가져온 order_day 값
 * @returns string[] — ["mon","tue",...] 형태의 요일 약어 배열
 */
function parseOrderDayField(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed.map((d: string) => d.toLowerCase().trim());
    }
  } catch {
    // 파싱 실패 시 빈 배열
  }
  return [];
}

// ══════════════════════════════════════════════════════════════════
// 메인 쿼리 #1: getRealtimeData
// ══════════════════════════════════════════════════════════════════

/**
 * 실시간 현황 데이터를 조회합니다.
 *
 * 처리 흐름:
 *   1) getOrdersByDate(deliveryDate) → 해당일 주문 (분기 로직 내장)
 *   2) getOrdersByDate(lastWeekDate) → 지난주 같은 요일 주문 (비교용)
 *   3) Supabase order_forecasts에서 deliveryDate의 예측값 조회
 *      → 예측 레코드가 없으면 이전 같은 요일 4주 평균을 fallback으로 사용
 *   4) 상품별 집계: todayQty, lastWeekQty, forecastQty, progress, diff
 *   5) 마감까지 남은 분 계산 (배송일 전날 14:30 기준)
 *
 * @param targetDate  조회 기준일 "YYYY-MM-DD" (배송일)
 */
export async function getRealtimeData(
  targetDate?: string
): Promise<RealtimeResponse> {
  const deliveryDate = targetDate || getToday();
  const lastWeekDate = addDays(deliveryDate, -7);

  const [todayResult, lastWeekResult] = await Promise.all([
    getOrdersByDate(deliveryDate),
    getOrdersByDate(lastWeekDate),
  ]);

  // ─── Supabase 예측값 조회 ───
  const supabase = await createClient();
  const { data: forecasts } = await supabase
    .from("order_forecasts")
    .select("product_id, forecast_qty, confirmed_order_qty, additional_forecast_qty, buffer_qty")
    .eq("delivery_date", deliveryDate);

  const forecastMap = new Map<number, {
    forecastQty: number; confirmedQty: number;
    additionalQty: number; bufferQty: number;
  }>();
  for (const f of forecasts || []) {
    forecastMap.set(Number(f.product_id), {
      forecastQty: Number(f.forecast_qty) || 0,
      confirmedQty: Number(f.confirmed_order_qty) || 0,
      additionalQty: Number(f.additional_forecast_qty) || 0,
      bufferQty: Number(f.buffer_qty) || 0,
    });
  }

  // ─── forecast fallback: 최근 4주 같은 요일 평균 ───
  const hasForecast = forecastMap.size > 0;
  const fallbackMap = new Map<number, number>();

  if (!hasForecast) {
    const recentResults: OrdersByDateResult[] = [];
    for (let i = 1; i <= 4; i++) {
      recentResults.push(await getOrdersByDate(addDays(deliveryDate, -7 * i)));
    }
    const productTotals = new Map<number, { total: number; count: number }>();
    for (const result of recentResults) {
      const dateProductMap = new Map<number, number>();
      for (const o of result.orders) {
        dateProductMap.set(
          o.productId,
          (dateProductMap.get(o.productId) || 0) + o.quantity
        );
      }
      for (const [pid, qty] of dateProductMap) {
        const existing = productTotals.get(pid);
        if (existing) {
          existing.total += qty;
          existing.count += 1;
        } else {
          productTotals.set(pid, { total: qty, count: 1 });
        }
      }
    }
    for (const [pid, data] of productTotals) {
      fallbackMap.set(pid, Math.round(data.total / data.count));
    }
  }

  // ─── 상품별 집계 ───
  const todayByProduct = new Map<number, { name: string; qty: number }>();
  for (const o of todayResult.orders) {
    const existing = todayByProduct.get(o.productId);
    if (existing) existing.qty += o.quantity;
    else todayByProduct.set(o.productId, { name: o.productName, qty: o.quantity });
  }

  const lastWeekByProduct = new Map<number, number>();
  for (const o of lastWeekResult.orders) {
    lastWeekByProduct.set(
      o.productId,
      (lastWeekByProduct.get(o.productId) || 0) + o.quantity
    );
  }

  const { data: allProducts } = await supabase
    .from("products")
    .select("id, product_name")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const products: RealtimeProduct[] = (allProducts || []).map((p) => {
    const pid = Number(p.id);
    const todayQty = todayByProduct.get(pid)?.qty || 0;
    const lastWeekQty = lastWeekByProduct.get(pid) || 0;
    const forecast = forecastMap.get(pid);
    const fallbackQty = fallbackMap.get(pid) || 0;
    const forecastQty = forecast && forecast.forecastQty > 0
      ? forecast.forecastQty
      : fallbackQty > 0
        ? fallbackQty
        : 0;

    return {
      productId: pid,
      productName: String(p.product_name),
      todayQty,
      lastWeekQty,
      forecastQty,
      progress: forecastQty > 0 ? Math.round((todayQty / forecastQty) * 100) : 0,
      diff: todayQty - lastWeekQty,
    };
  });

  // ─── 마감까지 남은 분 ───
  const [tty, ttm, ttd] = deliveryDate.split("-").map(Number);
  const deadlineDay = new Date(tty, ttm - 1, ttd);
  deadlineDay.setDate(deadlineDay.getDate() - 1);
  const deadlineUTC = Date.UTC(
    deadlineDay.getFullYear(),
    deadlineDay.getMonth(),
    deadlineDay.getDate(),
    CUTOFF_HOUR - 9,
    CUTOFF_MINUTE,
    0
  );
  const minutesUntilCutoff = Math.floor((deadlineUTC - Date.now()) / (1000 * 60));

  return {
    targetDate: deliveryDate,
    minutesUntilCutoff,
    appOrdersMerged: todayResult.appOrdersMerged,
    products,
  };
}

// ══════════════════════════════════════════════════════════════════
// 메인 쿼리 #2: getTrendData
// ══════════════════════════════════════════════════════════════════

/**
 * 추이 차트 데이터를 조회합니다.
 *
 * @param startDate  시작일 "YYYY-MM-DD"
 * @param endDate    종료일 "YYYY-MM-DD"
 */
export async function getTrendData(
  startDate: string,
  endDate: string
): Promise<TrendResponse> {
  // ── 상품 색상 맵 로드 (productRepository 경유) ──
  const colorMap = await getProductColorMap();

  // ── Supabase에서 상품 목록 조회 ──
  const supabase = await createClient();
  const { data: productRows } = await supabase
    .from("products")
    .select("id, product_name")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  // ── 상품 목록 구성 (DB 기준, 색상은 colorMap에서 조회) ──
  const productList: TrendProduct[] = (productRows || []).map((p, idx) => ({
    productId: Number(p.id),
    productName: String(p.product_name),
    color: resolveColor(String(p.product_name), colorMap, idx),
  }));

  // ── 날짜 배열 생성 ──
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  // ── 일별 주문 조회 ──
  const orderResults = await Promise.all(
    dates.map((d) => getOrdersByDate(d))
  );

  // ── 행(row) 데이터 구성 ──
  const rows: TrendRow[] = dates.map((date, idx) => {
    const { orders } = orderResults[idx];

    // 상품별 수량 집계
    const byProduct = new Map<number, number>();
    for (const o of orders) {
      byProduct.set(o.productId, (byProduct.get(o.productId) || 0) + o.quantity);
    }

    const row: TrendRow = { date, dayLabel: formatDayLabel(date) };
    let total = 0;
    for (const pl of productList) {
      const qty = byProduct.get(pl.productId) || 0;
      row[pl.productName] = qty;
      total += qty;
    }
    row._total = total;
    return row;
  });

  return { productList, rows };
}

// ══════════════════════════════════════════════════════════════════
// 메인 쿼리 #3: getDrilldownDetailData
// ══════════════════════════════════════════════════════════════════

/**
 * 드릴다운 상세 분석 데이터를 조회합니다.
 * 해당 날짜의 주문만으로 분석하며, 차트 데이터는 포함하지 않습니다.
 *
 *   [1] 요약 카드 — 주문/미주문 고객사 수, 총 수량, 신규/이탈 수
 *   [2] 상품별 배지 — 상품명 + 수량 + 색상
 *   [3] 요일 기준 특이 고객사 (전주 동일 요일 비교)
 *       - 이탈(lapsed): 전주 O → 금주 X
 *       - 신규(new): 전주 X → 금주 O
 *       - 미지정(unassigned): accounts.order_day에 해당 요일 미포함인데 주문 존재
 *   [4] 수량 기준 특이 고객사 (전주 대비 ±3 이상 변동)
 *
 * @param targetDate  기준일 "YYYY-MM-DD"
 */
export async function getDrilldownDetailData(
  targetDate: string
): Promise<DrilldownDetailResponse> {
  // ── 상품 색상 맵 로드 (productRepository 경유) ──
  const colorMap = await getProductColorMap();

  // ── 요일 계산 ──
  const [ty, tm, td] = targetDate.split("-").map(Number);
  const targetDateObj = new Date(ty, tm - 1, td);
  const dowIndex = targetDateObj.getDay();
  const dow = DOW_LABELS[dowIndex];
  const dowName = DAY_NAMES[dowIndex]; // "mon", "tue", ...

  // ── 금주 & 전주 동일 요일 주문 조회 ──
  const lastWeekDate = addDays(targetDate, -7);
  const [thisWeekResult, lastWeekResult] = await Promise.all([
    getOrdersByDate(targetDate),
    getOrdersByDate(lastWeekDate),
  ]);
  const thisWeekOrders = thisWeekResult.orders;
  const lastWeekOrders = lastWeekResult.orders;

  // ──────────────────────────────────────────────────────────
  // [1] 요약 카드
  // ──────────────────────────────────────────────────────────

  // 전체 활성 거래처 수 (MySQL accounts 기준)
  const accountCountRows = await queryMySQL(
    `SELECT COUNT(*) AS cnt FROM accounts WHERE status = 'available'`,
    []
  );
  const totalAccounts =
    Number((accountCountRows as Record<string, unknown>[])[0]?.cnt) || 0;

  // 금주 고객사별 집계
  const thisWeekByAccount: Record<
    number,
    { name: string; qty: number; products: Map<string, number> }
  > = {};
  for (const o of thisWeekOrders) {
    if (!thisWeekByAccount[o.accountId]) {
      thisWeekByAccount[o.accountId] = {
        name: o.accountName,
        qty: 0,
        products: new Map(),
      };
    }
    thisWeekByAccount[o.accountId].qty += o.quantity;
    const prev =
      thisWeekByAccount[o.accountId].products.get(o.productName) || 0;
    thisWeekByAccount[o.accountId].products.set(o.productName, prev + o.quantity);
  }

  // 전주 고객사별 집계
  const lastWeekByAccount: Record<
    number,
    { name: string; qty: number; products: Map<string, number> }
  > = {};
  for (const o of lastWeekOrders) {
    if (!lastWeekByAccount[o.accountId]) {
      lastWeekByAccount[o.accountId] = {
        name: o.accountName,
        qty: 0,
        products: new Map(),
      };
    }
    lastWeekByAccount[o.accountId].qty += o.quantity;
    const prev =
      lastWeekByAccount[o.accountId].products.get(o.productName) || 0;
    lastWeekByAccount[o.accountId].products.set(
      o.productName,
      prev + o.quantity
    );
  }

  const orderedAccountIds = new Set(
    Object.keys(thisWeekByAccount).map(Number)
  );
  const orderedCount = orderedAccountIds.size;
  const unorderedCount = totalAccounts - orderedCount;

  let totalQty = 0;
  for (const acct of Object.values(thisWeekByAccount)) {
    totalQty += acct.qty;
  }

  // ──────────────────────────────────────────────────────────
  // [2] 상품별 배지 (productRepository 색상 사용)
  // ──────────────────────────────────────────────────────────

  const supabase = await createClient();
  const { data: productRows } = await supabase
    .from("products")
    .select("id, product_name")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  // 금주 주문의 상품별 수량 집계
  const productQtyMap = new Map<number, { productName: string; qty: number }>();
  for (const o of thisWeekOrders) {
    const existing = productQtyMap.get(o.productId);
    if (existing) existing.qty += o.quantity;
    else
      productQtyMap.set(o.productId, {
        productName: o.productName,
        qty: o.quantity,
      });
  }

  const productChips: ProductChip[] = (productRows || [])
    .map((p, idx) => {
      const pid = Number(p.id);
      const info = productQtyMap.get(pid);
      return {
        productId: pid,
        productName: String(p.product_name),
        qty: info?.qty || 0,
        color: resolveColor(String(p.product_name), colorMap, idx),
      };
    })
    .filter((c) => c.qty > 0);

  // ──────────────────────────────────────────────────────────
  // [3] 요일 기준 특이 고객사
  // ──────────────────────────────────────────────────────────

  // ★ subscription_at 조회
  const subscriptionRows = await queryMySQL(
    `SELECT id, order_day, subscription_at, status FROM accounts`,
    []
  );

  const accountOrderDaysMap = new Map<number, string[]>();
  const accountSubscriptionMap = new Map<number, string | null>();
  const accountStatusMap = new Map<number, string>(); 
  for (const row of subscriptionRows as Record<string, unknown>[]) {
    const aid = Number(row.id);
    accountOrderDaysMap.set(aid, parseOrderDayField(row.order_day));
    accountStatusMap.set(aid, String(row.status || "unknown"));

    const subAt = row.subscription_at;
    if (!subAt) {
      accountSubscriptionMap.set(aid, null);
    } else if (subAt instanceof Date) {
      const y = subAt.getFullYear();
      const m = String(subAt.getMonth() + 1).padStart(2, "0");
      const d = String(subAt.getDate()).padStart(2, "0");
      accountSubscriptionMap.set(aid, `${y}-${m}-${d}`);
    } else {
      // ISO 문자열("2026-03-21T00:00:00.000Z")인 경우
      const str = String(subAt);
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        accountSubscriptionMap.set(aid, str.slice(0, 10));
      } else {
        // 그 외 형식 → Date 파싱 후 변환
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) {
          const y = parsed.getFullYear();
          const m = String(parsed.getMonth() + 1).padStart(2, "0");
          const d = String(parsed.getDate()).padStart(2, "0");
          accountSubscriptionMap.set(aid, `${y}-${m}-${d}`);
        } else {
          accountSubscriptionMap.set(aid, null);
        }
      }
    }
  }

  // ★ 해당 요일 총 주문횟수 조회
  // DAYOFWEEK: 1=일, 2=월, ..., 7=토 → JS getDay()와 +1 관계
  const mysqlDow = dowIndex + 1;
  const dowCountRows = await queryMySQL(
    `SELECT o.account_id, COUNT(DISTINCT o.delivery_date) AS cnt
     FROM orders o
     JOIN accounts a ON a.id = o.account_id
     WHERE o.deleted_at IS NULL
       AND o.delivery_date <= ?
       AND DAYOFWEEK(o.delivery_date) = ?
       AND (a.subscription_at IS NULL OR o.delivery_date >= a.subscription_at)
     GROUP BY o.account_id`,
    [targetDate, mysqlDow]
  );
  const dowCountMap = new Map<number, number>();
  for (const row of dowCountRows as Record<string, unknown>[]) {
    dowCountMap.set(Number(row.account_id), Number(row.cnt) || 0);
  }

  const weekdayClients: WeekdayCaseClient[] = [];

  // 이탈(lapsed): 전주 O → 금주 X
  for (const [aid, info] of Object.entries(lastWeekByAccount)) {
    const accountId = Number(aid);
    if (!thisWeekByAccount[accountId]) {
      weekdayClients.push({
        case: "lapsed",
        accountId,
        accountName: info.name,
        accountStatus: accountStatusMap.get(accountId) ?? "unknown",
        subscriptionAt: accountSubscriptionMap.get(accountId) ?? null,
        dowOrderCount: dowCountMap.get(accountId) ?? 0,
        lastWeekQty: info.qty,
        thisWeekQty: 0,
        diff: -info.qty,
        changeRate: -100,
        products: Array.from(info.products.entries()).map(([name, qty]) => ({
          productName: name,
          qty,
        })),
      });
    }
  }

  // 신규(new): 전주 X → 금주 O
  for (const [aid, info] of Object.entries(thisWeekByAccount)) {
    const accountId = Number(aid);
    if (!lastWeekByAccount[accountId]) {
      weekdayClients.push({
        case: "new",
        accountId,
        accountName: info.name,
        accountStatus: accountStatusMap.get(accountId) ?? "unknown",
        subscriptionAt: accountSubscriptionMap.get(accountId) ?? null,
        dowOrderCount: dowCountMap.get(accountId) ?? 0,
        lastWeekQty: 0,
        thisWeekQty: info.qty,
        diff: info.qty,
        changeRate: null,
        products: Array.from(info.products.entries()).map(([name, qty]) => ({
          productName: name,
          qty,
        })),
      });
    }
  }

  // 미지정(unassigned)
  for (const [aid, info] of Object.entries(thisWeekByAccount)) {
    const accountId = Number(aid);
    if (weekdayClients.some((c) => c.accountId === accountId)) continue;
    const orderDays = accountOrderDaysMap.get(accountId) || [];
    if (orderDays.includes(dowName)) continue;

    const lastWeek = lastWeekByAccount[accountId];
    const lastQty = lastWeek?.qty || 0;
    const diff = info.qty - lastQty;

    weekdayClients.push({
      case: "unassigned",
      accountId,
      accountName: info.name,
      accountStatus: accountStatusMap.get(accountId) ?? "unknown",
      subscriptionAt: accountSubscriptionMap.get(accountId) ?? null,
      dowOrderCount: dowCountMap.get(accountId) ?? 0,
      lastWeekQty: lastQty,
      thisWeekQty: info.qty,
      diff,
      changeRate: lastQty > 0 ? Math.round((diff / lastQty) * 100) : null,
      products: Array.from(info.products.entries()).map(([name, qty]) => ({
        productName: name,
        qty,
      })),
    });
  }

  const lapsedCount = weekdayClients.filter((c) => c.case === "lapsed").length;
  const newCount = weekdayClients.filter((c) => c.case === "new").length;

  const weekdaySummary: WeekdayCaseSummary = {
    lapsed: lapsedCount,
    new: newCount,
    unassigned: weekdayClients.filter((c) => c.case === "unassigned").length,
    total: weekdayClients.length,
  };

  // ──────────────────────────────────────────────────────────
  // [4] 수량 기준 특이 고객사 (±3 이상 변동)
  // ──────────────────────────────────────────────────────────

  const quantityClients: QuantityAnomalyClient[] = [];

  const allAccountIds = new Set([
    ...Object.keys(thisWeekByAccount).map(Number),
    ...Object.keys(lastWeekByAccount).map(Number),
  ]);

  for (const accountId of allAccountIds) {
    const tw = thisWeekByAccount[accountId];
    const lw = lastWeekByAccount[accountId];
    if (!tw && !lw) continue;

    const thisQty = tw?.qty || 0;
    const lastQty = lw?.qty || 0;
    const diff = thisQty - lastQty;

    if (Math.abs(diff) >= QTY_ANOMALY_THRESHOLD) {
      const twProducts = tw?.products || new Map<string, number>();
      const lwProducts = lw?.products || new Map<string, number>();
      const allProductNames = new Set([
        ...twProducts.keys(),
        ...lwProducts.keys(),
      ]);

      quantityClients.push({
        accountId,
        accountName: tw?.name || lw?.name || "",
        accountStatus: accountStatusMap.get(accountId) ?? "unknown",
        subscriptionAt: accountSubscriptionMap.get(accountId) ?? null,
        dowOrderCount: dowCountMap.get(accountId) ?? 0,
        lastWeekQty: lastQty,
        thisWeekQty: thisQty,
        diff,
        changeRate:
          lastQty > 0
            ? Math.round((diff / lastQty) * 100)
            : thisQty > 0
              ? 100
              : 0,
        direction: diff > 0 ? "up" : "down",
        products: Array.from(allProductNames).map((pName) => ({
          productName: pName,
          thisWeek: twProducts.get(pName) || 0,
          lastWeek: lwProducts.get(pName) || 0,
          diff: (twProducts.get(pName) || 0) - (lwProducts.get(pName) || 0),
        })),
      });
    }
  }

  quantityClients.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return {
    targetDate,
    dow,
    orderedCount,
    unorderedCount,
    totalQty,
    newCount,
    lapsedCount,
    productChips,
    weekdayClients,
    weekdaySummary,
    quantityClients,
  };
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
// 메인 쿼리 #4: getClientChangeData (전체 교체)
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
 * @param startDate    현재 기간 시작일
 * @param endDate      현재 기간 종료일
 * @param prevStartDate 이전 기간 시작일
 * @param prevEndDate   이전 기간 종료일
 */
export async function getClientChangeData(
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string,
): Promise<ClientChangeResponse> {

  // ═══════════════════════════════════════
  // 1) 현재 기간 이탈/신규/전환예정 조회
  // ═══════════════════════════════════════

  const churnedRows = await queryMySQL(
    `SELECT a.id, a.name, a.status, a.terminate_at,
            a.subscription_at, a.order_day
     FROM accounts a
     WHERE a.status = 'disabled'
       AND a.terminate_at IS NOT NULL
       AND a.terminate_at >= ?
       AND a.terminate_at <= ?
       AND a.subscription_at is not null`,
    [startDate, endDate]
  ) as Record<string, unknown>[];

  const newRows = await queryMySQL(
    `SELECT a.id, a.name, a.status, a.subscription_at, a.order_day
     FROM accounts a
     WHERE a.status = 'available'
       AND a.subscription_at >= ?
       AND a.subscription_at <= ?`,
    [startDate, endDate]
  ) as Record<string, unknown>[];

  const convertedRows = await queryMySQL(
    `SELECT a.id, a.name, a.status,
            a.subscription_scheduled_at, a.order_day
     FROM accounts a
     WHERE a.status = 'scheduled'
       AND a.subscription_scheduled_at >= ?
       AND a.subscription_scheduled_at <= ?`,
    [startDate, endDate]
  ) as Record<string, unknown>[];

  // ═══════════════════════════════════════
  // 2) 이전 기간 카운트 (증감 비교용)
  // ═══════════════════════════════════════

  const prevChurnedRows = await queryMySQL(
    `SELECT COUNT(*) AS cnt FROM accounts
    WHERE status = 'disabled'
      AND subscription_at IS NOT NULL
      AND terminate_at IS NOT NULL
      AND terminate_at >= ? AND terminate_at <= ?`,
    [prevStartDate, prevEndDate]
  ) as Record<string, unknown>[];

  const prevNewRows = await queryMySQL(
    `SELECT COUNT(*) AS cnt FROM accounts
     WHERE status = 'available'
       AND subscription_at >= ? AND subscription_at <= ?`,
    [prevStartDate, prevEndDate]
  ) as Record<string, unknown>[];

  const prevConvertedRows = await queryMySQL(
    `SELECT COUNT(*) AS cnt FROM accounts
     WHERE status = 'scheduled'
       AND subscription_scheduled_at >= ? AND subscription_scheduled_at <= ?`,
    [prevStartDate, prevEndDate]
  ) as Record<string, unknown>[];

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
    const statsRows = await queryMySQL(
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
    ) as Record<string, unknown>[];

    for (const row of statsRows) {
      orderStatsMap.set(Number(row.account_id), {
        avgQty: Number(row.avg_qty) || 0,
        mainProduct: "",
        lastOrderDate: row.last_order_date
          ? String(row.last_order_date).slice(0, 10)
          : "",
        productAvgs: [],
      });
    }

    // 상품별 일평균 수량 계산
    const productAvgRows = await queryMySQL(
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
    ) as Record<string, unknown>[];

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
    });
  }

  // ═══════════════════════════════════════
  // 5) 요일별 순변화 (dowFlows)
  // ═══════════════════════════════════════

  const dowFlows: DowFlow[] = [];

  // 평일만 (월~금)
  const weekdayIndices = [1, 2, 3, 4, 5]; // mon=1, tue=2, wed=3, thu=4, fri=5

  for (const dayIdx of weekdayIndices) {
    const dowName = DAY_NAMES[dayIdx]; // "mon", "tue", ...
    const dowLabel = DOW_LABELS[dayIdx]; // "월", "화", ...

    // 이탈 고객 중 해당 요일에 주문하던 고객 수
    const churnedOnDay = churnedRows.filter((r) => {
      const orderDays = parseOrderDayField(r.order_day);
      return orderDays.includes(dowName);
    }).length;

    // 신규 고객 중 해당 요일에 주문하는 고객 수
    const newOnDay = newRows.filter((r) => {
      const orderDays = parseOrderDayField(r.order_day);
      return orderDays.includes(dowName);
    }).length;

    dowFlows.push({
      dow: dowName,
      dowLabel,
      churned: churnedOnDay,
      newCount: newOnDay,
      net: newOnDay - churnedOnDay,
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