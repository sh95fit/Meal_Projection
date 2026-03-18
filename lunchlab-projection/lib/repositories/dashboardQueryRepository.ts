// ──────────────────────────────────────────────────────────────────
// lib/repositories/dashboardQueryRepository.ts
// LunchLab 대시보드 — 데이터 조회 리포지토리
// ──────────────────────────────────────────────────────────────────

import { queryMySQL } from "@/lib/mysql/client";
import { createClient } from "@/lib/supabase/server";
import { getToday, addDays } from "@/lib/utils/date";
import type {
  MergedOrder,
  OrdersByDateResult,
  RealtimeProduct,
  RealtimeResponse,
  TrendProduct,
  TrendRow,
  TrendResponse,
  WeekdayAnomaly,
  QuantityAnomaly,
  DrilldownResponse,
  ClientChange,
  DowFlow,
  ClientChangeResponse,
} from "@/types/dashboard";

// ──────────────────────────────────────────────────────────────────
// 상수 정의
// ──────────────────────────────────────────────────────────────────

/** 앱 주문 이관 마감 시각 — 시(hour) */
const CUTOFF_HOUR = 14;

/** 앱 주문 이관 마감 시각 — 분(minute) */
const CUTOFF_MINUTE = 30;

/**
 * 수량 이상 감지 임계값.
 * 최근 4주 해당 요일 평균 대비 |diff| >= 이 값이면 '특이'로 분류합니다.
 */
const QTY_ANOMALY_THRESHOLD = 3;

/**
 * 데이터 시작일.
 * MySQL 주문 테이블에서 이 날짜 이전 데이터는 조회하지 않습니다.
 * (기존 orderQueryRepository.ts의 필터와 동일)
 */
const DATA_START_DATE = "2025-09-01";

/**
 * 추이 차트 상품별 색상 팔레트.
 * products 테이블 순서대로 순환 할당합니다.
 */
const COLORS = [
  "#818cf8", "#34d399", "#fbbf24", "#f87171",
  "#fb923c", "#a78bfa", "#38bdf8", "#f472b6",
];

/**
 * 요일 약어 → 한글 매핑
 */
const DOW_MAP: Record<string, string> = {
  sun: "일", mon: "월", tue: "화", wed: "수",
  thu: "목", fri: "금", sat: "토",
};

/**
 * JS Date.getDay() → 영문 요일 약어
 * getDay(): 0=일, 1=월, ..., 6=토
 */
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// ══════════════════════════════════════════════════════════════════
// 헬퍼 함수 #1: needsAppMenuMerge
// ══════════════════════════════════════════════════════════════════

/**
 * 주어진 배송일에 대해 앱 주문(selected_menus)을 별도 합산해야 하는지 판단합니다.
 *
 * 판단 로직:
 *   1) 배송일이 과거 → false (이미 이관 완료)
 *   2) 배송일이 미래 → true  (아직 이관 전)
 *   3) 배송일이 오늘:
 *      a) 현재 시각 < 14:30 KST → true  (아직 이관 전)
 *      b) 현재 시각 >= 14:30 KST → false (이관 완료)
 *
 * @param dateStr  배송일 "YYYY-MM-DD"
 * @returns boolean
 */
export function needsAppMenuMerge(dateStr: string): boolean {
  // 현재 시각을 KST(UTC+9)로 계산
  const now = new Date();
  const kstOffset = 9 * 60; // +9시간 (분 단위)
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const kstMinutes = utcMinutes + kstOffset;
  // KST 기준 시/분 (24시 넘어가면 다음날이지만, 자정~새벽 케이스는 드물므로 단순 처리)
  const kstHour = Math.floor(kstMinutes / 60) % 24;
  const kstMin = kstMinutes % 60;

  // KST 기준 오늘 날짜 문자열 생성
  const kstNow = new Date(now.getTime() + kstOffset * 60 * 1000);
  const todayStr = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(kstNow.getUTCDate()).padStart(2, "0")}`;

  if (dateStr < todayStr) {
    // 과거 날짜 → 이미 이관 완료
    return false;
  }

  if (dateStr > todayStr) {
    // 미래 날짜 → 아직 이관 안 됨
    return true;
  }

  // 오늘 날짜 → 14:30 이전인지 확인
  const cutoffMinutes = CUTOFF_HOUR * 60 + CUTOFF_MINUTE; // 870
  const currentMinutes = kstHour * 60 + kstMin;

  return currentMinutes < cutoffMinutes;
}

// ══════════════════════════════════════════════════════════════════
// 헬퍼 함수 #2: getWebOrdersByDate
// ══════════════════════════════════════════════════════════════════

/**
 * 웹 주문(orders + order-details)에서 지정일의 주문을 조회합니다.
 * 체험 주문(trial, accounts.status='considering') 포함.
 *
 * 반환값: 고객사×상품 단위 집계 행
 *   { accountId, accountName, externalProductId, quantity, totalQty, channel }
 *
 * 중요: product_id는 MySQL 외부 ID입니다. Supabase 내부 ID로의 매핑은
 * 호출측(mergeOrders 등)에서 수행합니다.
 *
 * @param dateStr  배송일 "YYYY-MM-DD"
 */
async function getWebOrdersByDate(dateStr: string): Promise<{
  accountId: number;
  accountName: string;
  externalProductId: string;
  quantity: number;
  totalQty: number;
  channel: 'web' | 'trial';
}[]> {
  const sql = `
    /* ────────────────────────────────────────────────────
       웹 주문 + 체험 주문 조회
       - orders.delivery_date 기준 (웹 주문 테이블)
       - 소프트 삭제 필터 적용 (deleted_at IS NULL)
       - 체험 주문은 trial_schedules 경로로 별도 UNION
       ──────────────────────────────────────────────────── */

    -- CTE 1: considering 상태의 체험 주문 order_id 목록
    --         일반 웹 집계에서 중복 제외하기 위해 사용
    WITH trial_order_ids AS (
      SELECT DISTINCT tso.order_id
      FROM trial_schedules ts
      JOIN trial_schedule_orders tso ON tso.trial_schedule_id = ts.id
      JOIN lead_applications la ON la.id = ts.lead_application_id
      LEFT JOIN accounts a ON la.account_id = a.id
      WHERE ts.trial_at = ?                 -- param[0]: 배송일
        AND ts.trial_at >= '${DATA_START_DATE}'
        AND ts.deleted_at IS NULL
        AND tso.deleted_at IS NULL
        AND (a.status = 'considering' OR a.status IS NULL)
    ),

    -- CTE 2: 일반 웹 주문 (고객사×상품 그룹)
    web AS (
      SELECT
        a.id                          AS account_id,
        a.name                        AS account_name,
        CAST(od.product_id AS CHAR)   AS external_product_id,
        CAST(SUM(od.quantity) AS SIGNED) AS quantity,
        'web'                         AS channel
      FROM orders o
      JOIN \`order-details\` od ON od.order_id = o.id
      JOIN accounts a ON a.id = o.account_id
      WHERE o.delivery_date = ?             -- param[1]: 배송일
        AND o.delivery_date >= '${DATA_START_DATE}'
        AND o.deleted_at IS NULL
        AND od.deleted_at IS NULL
        AND o.id NOT IN (SELECT order_id FROM trial_order_ids)
      GROUP BY a.id, a.name, od.product_id
    ),

    -- CTE 3: 체험 주문 (considering 고객만)
    trial AS (
      SELECT
        a.id                          AS account_id,
        a.name                        AS account_name,
        CAST(od.product_id AS CHAR)   AS external_product_id,
        CAST(SUM(od.quantity) AS SIGNED) AS quantity,
        'trial'                       AS channel
      FROM trial_schedules ts
      JOIN trial_schedule_orders tso ON tso.trial_schedule_id = ts.id
      JOIN lead_applications la ON la.id = ts.lead_application_id
      LEFT JOIN accounts a ON la.account_id = a.id
      JOIN orders o ON o.id = tso.order_id
      JOIN \`order-details\` od ON od.order_id = o.id
      WHERE ts.trial_at = ?                 -- param[2]: 배송일
        AND ts.trial_at >= '${DATA_START_DATE}'
        AND ts.deleted_at IS NULL
        AND tso.deleted_at IS NULL
        AND o.deleted_at IS NULL
        AND od.deleted_at IS NULL
        AND a.status = 'considering'
      GROUP BY a.id, a.name, od.product_id
    ),

    -- CTE 4: UNION → 고객사별 전체 수량 계산
    combined AS (
      SELECT * FROM web
      UNION ALL
      SELECT * FROM trial
    )

    SELECT
      c.account_id,
      c.account_name,
      c.external_product_id,
      c.quantity,
      c.channel,
      -- 같은 고객사의 전체 주문 수량 (윈도우 함수)
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
    channel: r.channel as 'web' | 'trial',
  }));
}

// ══════════════════════════════════════════════════════════════════
// 헬퍼 함수 #3: getAppOrdersByDate
// ══════════════════════════════════════════════════════════════════

/**
 * 앱 주문(selected_menus 체인)에서 지정일의 주문을 조회합니다.
 *
 * 조인 체인:
 *   selected_menus → scheduled_menus (상품)
 *   selected_menus → schedules       (배송일)
 *   selected_menus → order_profiles  (회사)
 *   order_profiles.company_id → accounts.record_id
 *
 * 조건:
 *   - accounts.status = 'available' (활성 고객만)
 *   - selected_menus.is_skipped = 0 (건너뛴 메뉴 제외)
 *   - schedules.delivery_on = ? (배송일 매칭)
 *
 * 반환값: 고객사×앱상품 단위 집계 행
 *   앱은 메뉴 선택 1건 = 수량 1이므로 COUNT(*)로 집계합니다.
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
    /* ────────────────────────────────────────────────────
       앱 주문 조회 (selected_menus 체인)
       - schedules.delivery_on 기준 (앱 주문 테이블)
       - 앱은 선택 1건 = 수량 1 (COUNT)
       ──────────────────────────────────────────────────── */
    SELECT
      a.id                                AS account_id,
      a.name                              AS account_name,
      CAST(sm2.product_id AS CHAR)        AS external_product_id,
      CAST(COUNT(*) AS SIGNED)            AS quantity,
      a.min_order_quantity,
      -- 같은 고객사의 전체 앱 주문 수량
      SUM(COUNT(*)) OVER (PARTITION BY a.id) AS total_qty
    FROM selected_menus sm
    JOIN scheduled_menus sm2 ON sm.scheduled_menu_id = sm2.id    -- 상품 정보
    JOIN schedules s         ON s.id = sm.schedule_id            -- 배송일
    JOIN order_profiles op   ON op.id = sm.order_profile_id      -- 회사 프로필
    JOIN accounts a          ON a.record_id = op.company_id      -- 고객사 매핑
    WHERE a.status = 'available'                                 -- 활성 고객만
      AND sm.is_skipped = 0                                      -- 건너뛴 메뉴 제외
      AND s.delivery_on = ?                                      -- 배송일
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
 * 처리 흐름:
 *   1) Supabase에서 전체 products + product_id_mappings 조회
 *   2) 외부 ID → 내부 ID 매핑 맵 생성 (web/app 각각)
 *   3) 웹 행의 externalProductId → 내부 productId 변환
 *   4) 앱 행의 externalProductId → 내부 productId 변환
 *   5) 같은 (accountId, productId) 키로 수량 합산
 *   6) 채널 결정: 웹만 있으면 'web', 앱만 있으면 'app', 둘 다 있으면 'both'
 *   7) min_order_quantity 조건 확인은 이 함수 범위 밖 (필요 시 호출측에서 처리)
 *
 * @param webOrders  getWebOrdersByDate 반환값
 * @param appOrders  getAppOrdersByDate 반환값
 * @returns MergedOrder[] — 내부 productId 기준으로 합산된 주문 목록
 */
async function mergeOrders(
  webOrders: Awaited<ReturnType<typeof getWebOrdersByDate>>,
  appOrders: Awaited<ReturnType<typeof getAppOrdersByDate>>
): Promise<MergedOrder[]> {
  // ─── Supabase에서 상품 + 매핑 조회 ───
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, product_name, product_id_mappings(channel, external_id)")
    .is("deleted_at", null);

  if (!products || products.length === 0) return [];

  // ─── 매핑 맵 생성 ───
  // key: "web:외부ID" 또는 "app:외부ID" → value: { productId, productName }
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

  // ─── 합산 맵: key = "accountId:productId" ───
  const merged = new Map<string, {
    accountId: number;
    accountName: string;
    productId: number;
    productName: string;
    quantity: number;
    totalQty: number;
    hasWeb: boolean;
    hasApp: boolean;
    isTrial: boolean;
  }>();

  /**
   * 합산 맵에 행을 추가하거나 기존 행에 수량을 더하는 내부 헬퍼
   */
  function addToMerged(
    accountId: number,
    accountName: string,
    productId: number,
    productName: string,
    quantity: number,
    totalQty: number,
    source: 'web' | 'app' | 'trial'
  ) {
    const key = `${accountId}:${productId}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.totalQty = Math.max(existing.totalQty, totalQty); // 전체 수량은 max
      if (source === 'web') existing.hasWeb = true;
      if (source === 'app') existing.hasApp = true;
      if (source === 'trial') existing.isTrial = true;
    } else {
      merged.set(key, {
        accountId,
        accountName,
        productId,
        productName,
        quantity,
        totalQty,
        hasWeb: source === 'web',
        hasApp: source === 'app',
        isTrial: source === 'trial',
      });
    }
  }

  // ─── 웹 주문 처리 ───
  for (const row of webOrders) {
    const mapped = mappingMap.get(`web:${row.externalProductId}`);
    if (!mapped) continue; // 매핑 없는 상품은 건너뜀

    addToMerged(
      row.accountId,
      row.accountName,
      mapped.productId,
      mapped.productName,
      row.quantity,
      row.totalQty,
      row.channel // 'web' | 'trial'
    );
  }

  // ─── 앱 주문 처리 ───
  for (const row of appOrders) {
    const mapped = mappingMap.get(`app:${row.externalProductId}`);
    if (!mapped) continue; // 매핑 없는 상품은 건너뜀

    addToMerged(
      row.accountId,
      row.accountName,
      mapped.productId,
      mapped.productName,
      row.quantity,
      row.totalQty,
      'app'
    );
  }

  // ─── 채널 결정 & MergedOrder 변환 ───
  const result: MergedOrder[] = [];
  for (const v of merged.values()) {
    let channel: MergedOrder['channel'];
    if (v.isTrial) channel = 'trial';
    else if (v.hasWeb && v.hasApp) channel = 'both';
    else if (v.hasApp) channel = 'app';
    else channel = 'web';

    result.push({
      accountId: v.accountId,
      accountName: v.accountName,
      productId: v.productId,
      productName: v.productName,
      quantity: v.quantity,
      totalQty: v.totalQty,
      channel,
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
 * 이 함수가 리포지토리 내 모든 메인 쿼리 함수에서 공통으로 호출되는 진입점입니다.
 *
 * @param dateStr  배송일 "YYYY-MM-DD"
 * @returns { orders: MergedOrder[], appOrdersMerged: boolean }
 */
export async function getOrdersByDate(dateStr: string): Promise<OrdersByDateResult> {
  const webOrders = await getWebOrdersByDate(dateStr);

  // 앱 분기 판단
  if (needsAppMenuMerge(dateStr)) {
    // ── 앱 주문 별도 합산 필요 ──
    const appOrders = await getAppOrdersByDate(dateStr);
    const orders = await mergeOrders(webOrders, appOrders);
    return { orders, appOrdersMerged: true };
  } else {
    // ── 웹만 사용 (이관 완료) ──
    const orders = await mergeOrders(webOrders, []);
    return { orders, appOrdersMerged: false };
  }
}

// ══════════════════════════════════════════════════════════════════
// 메인 쿼리 #1: getRealtimeData
// ══════════════════════════════════════════════════════════════════

/**
 * 실시간 현황 데이터를 조회합니다.
 *
 * 처리 흐름:
 *   1) getOrdersByDate(targetDate)로 오늘 주문 조회 (분기 로직 내장)
 *   2) getOrdersByDate(yesterday)로 어제 주문 조회 (비교용)
 *   3) Supabase order_forecasts에서 targetDate의 예측값 조회
 *   4) 상품별로 집계: todayQty, yesterdayQty, forecastQty, progress, diff
 *   5) 마감까지 남은 분 계산
 *
 * @param targetDate  조회 기준일 "YYYY-MM-DD" (기본: 오늘)
 */
export async function getRealtimeData(
  targetDate?: string
): Promise<RealtimeResponse> {
  const today = targetDate || getToday();
  const yesterday = addDays(today, -1);

  // ─── 오늘 & 어제 주문 동시 조회 ───
  const [todayResult, yesterdayResult] = await Promise.all([
    getOrdersByDate(today),
    getOrdersByDate(yesterday),
  ]);

  // ─── Supabase 예측값 조회 ───
  const supabase = await createClient();
  const { data: forecasts } = await supabase
    .from("order_forecasts")
    .select("product_id, forecast_qty")
    .eq("delivery_date", today);

  // 예측값 맵: productId → forecastQty
  const forecastMap = new Map<number, number>();
  for (const f of (forecasts || [])) {
    forecastMap.set(Number(f.product_id), Number(f.forecast_qty) || 0);
  }

  // ─── 상품별 오늘 수량 집계 ───
  const todayByProduct = new Map<number, { name: string; qty: number }>();
  for (const o of todayResult.orders) {
    const existing = todayByProduct.get(o.productId);
    if (existing) {
      existing.qty += o.quantity;
    } else {
      todayByProduct.set(o.productId, { name: o.productName, qty: o.quantity });
    }
  }

  // ─── 상품별 어제 수량 집계 ───
  const yesterdayByProduct = new Map<number, number>();
  for (const o of yesterdayResult.orders) {
    yesterdayByProduct.set(
      o.productId,
      (yesterdayByProduct.get(o.productId) || 0) + o.quantity
    );
  }

  // ─── 상품 목록 (Supabase products 기준) ───
  const { data: allProducts } = await supabase
    .from("products")
    .select("id, product_name")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  // ─── RealtimeProduct 배열 생성 ───
  const products: RealtimeProduct[] = (allProducts || []).map((p) => {
    const pid = Number(p.id);
    const todayQty = todayByProduct.get(pid)?.qty || 0;
    const yesterdayQty = yesterdayByProduct.get(pid) || 0;
    const forecastQty = forecastMap.get(pid) || 0;

    return {
      productId: pid,
      productName: String(p.product_name),
      todayQty,
      yesterdayQty,
      forecastQty,
      progress: forecastQty > 0 ? Math.round((todayQty / forecastQty) * 100) : 0,
      diff: todayQty - yesterdayQty,
    };
  });

  // ─── 마감까지 남은 분 계산 ───
  const now = new Date();
  const kstOffset = 9 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const kstMinutes = utcMinutes + kstOffset;
  const cutoffMinutes = CUTOFF_HOUR * 60 + CUTOFF_MINUTE;
  const minutesUntilCutoff = cutoffMinutes - (kstMinutes % (24 * 60));

  return {
    targetDate: today,
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
 * 처리 흐름:
 *   1) startDate ~ endDate 범위의 각 날짜에 대해 getOrdersByDate() 호출
 *      (분기 로직이 날짜별로 자동 적용됨)
 *   2) Supabase products에서 상품 목록 + 색상 할당
 *   3) 날짜×상품 매트릭스 구성 → TrendRow[] 생성
 *
 * 성능 참고: 날짜 범위가 넓으면 (예: 90일) 90번의 getOrdersByDate 호출이 발생합니다.
 * 프로덕션에서는 단일 SQL로 기간 조회 후 날짜별 분배하는 최적화를 권장합니다.
 * 여기서는 분기 로직의 정확성과 코드 일관성을 우선합니다.
 *
 * @param startDate  시작일 "YYYY-MM-DD"
 * @param endDate    종료일 "YYYY-MM-DD"
 */
export async function getTrendData(
  startDate: string,
  endDate: string
): Promise<TrendResponse> {
  // ─── 상품 목록 (범례) ───
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, product_name")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const productList: TrendProduct[] = (products || []).map((p, idx) => ({
    productId: Number(p.id),
    productName: String(p.product_name),
    color: COLORS[idx % COLORS.length],
  }));

  // ─── 날짜 목록 생성 ───
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  // ─── 날짜별 주문 조회 (병렬 처리) ───
  const orderResults = await Promise.all(
    dates.map((d) => getOrdersByDate(d))
  );

  // ─── TrendRow 생성 ───
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const rows: TrendRow[] = dates.map((date, idx) => {
    const { orders } = orderResults[idx];

    // 상품별 수량 집계
    const byProduct = new Map<number, number>();
    for (const o of orders) {
      byProduct.set(o.productId, (byProduct.get(o.productId) || 0) + o.quantity);
    }

    // 행 구성
    const [y, m, d] = date.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayLabel = `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}(${dayNames[dateObj.getDay()]})`;

    const row: TrendRow = { date, dayLabel };
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
// 메인 쿼리 #3: getDrilldownData
// ══════════════════════════════════════════════════════════════════

/**
 * 특이 고객사 드릴다운 데이터를 조회합니다.
 *
 * [A] 요일 기준 분류:
 *   - '이탈(lapsed)' : 해당 요일에 주문 설정이 있으나 오늘 주문 없음
 *   - '신규(new)'    : 해당 요일에 주문 설정이 없으나 오늘 주문 있음
 *   - '미지정(unassigned)' : order_day가 없거나 빈 문자열인데 오늘 주문 있음
 *
 * [B] 수량 기준:
 *   - 최근 4주 해당 요일 평균 대비 |diff| >= QTY_ANOMALY_THRESHOLD 인 고객사
 *
 * @param targetDate  기준일 "YYYY-MM-DD"
 * @param dow         요일 약어 (예: 'wed') — 없으면 targetDate에서 자동 계산
 */
export async function getDrilldownData(
  targetDate: string,
  dow?: string
): Promise<DrilldownResponse> {
  // ─── 요일 결정 ───
  const [y, m, d] = targetDate.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const actualDow = dow || DAY_NAMES[dateObj.getDay()];

  // ─── 오늘 주문 조회 (분기 로직 내장) ───
  const { orders: todayOrders } = await getOrdersByDate(targetDate);

  // 오늘 주문이 있는 고객사 ID → 수량 집계
  const todayAccountMap = new Map<number, {
    name: string;
    totalQty: number;
    products: Map<string, number>;
  }>();

  for (const o of todayOrders) {
    const existing = todayAccountMap.get(o.accountId);
    if (existing) {
      existing.totalQty += o.quantity;
      existing.products.set(
        o.productName,
        (existing.products.get(o.productName) || 0) + o.quantity
      );
    } else {
      const products = new Map<string, number>();
      products.set(o.productName, o.quantity);
      todayAccountMap.set(o.accountId, {
        name: o.accountName,
        totalQty: o.quantity,
        products,
      });
    }
  }

  // ─── 전체 활성 고객사 조회 (MySQL accounts) ───
  const accountRows = await queryMySQL(`
    SELECT id, name, order_day
    FROM accounts
    WHERE status = 'available'
  `, []);

  const allAccounts = (accountRows as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    name: String(r.name || ""),
    orderDay: String(r.order_day || ""),
  }));

  // ─── [A] 요일 기준 분류 ───
  const weekdayAnomalies: WeekdayAnomaly[] = [];

  for (const acct of allAccounts) {
    const hasOrderToday = todayAccountMap.has(acct.id);
    const orderDays = acct.orderDay.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    const isAssignedDay = orderDays.includes(actualDow);
    const hasNoDayConfig = orderDays.length === 0 || acct.orderDay === "";

    if (isAssignedDay && !hasOrderToday) {
      // 이탈: 해당 요일에 주문이 설정되어 있지만 오늘 주문 없음
      // 마지막 주문일 조회
      const lastRows = await queryMySQL(`
        SELECT MAX(o.delivery_date) AS last_date
        FROM orders o
        WHERE o.account_id = ?
          AND o.deleted_at IS NULL
          AND DAYOFWEEK(o.delivery_date) = DAYOFWEEK(?)
          AND o.delivery_date >= '${DATA_START_DATE}'
      `, [acct.id, targetDate]);
      const lastDate = (lastRows as Record<string, unknown>[])[0]?.last_date;

      weekdayAnomalies.push({
        type: 'lapsed',
        accountId: acct.id,
        accountName: acct.name,
        orderDay: acct.orderDay,
        lastOrderDate: lastDate ? String(lastDate) : null,
      });
    } else if (!isAssignedDay && !hasNoDayConfig && hasOrderToday) {
      // 신규: 해당 요일에 설정이 없지만 오늘 주문함
      weekdayAnomalies.push({
        type: 'new',
        accountId: acct.id,
        accountName: acct.name,
        orderDay: acct.orderDay,
        lastOrderDate: null,
      });
    } else if (hasNoDayConfig && hasOrderToday) {
      // 미지정: 주문 요일 설정 자체가 없는데 오늘 주문함
      weekdayAnomalies.push({
        type: 'unassigned',
        accountId: acct.id,
        accountName: acct.name,
        orderDay: null,
        lastOrderDate: null,
      });
    }
  }

  // ─── [B] 수량 기준 — 최근 4주 해당 요일 평균과 비교 ───
  const quantityAnomalies: QuantityAnomaly[] = [];

  // 최근 4주의 같은 요일 날짜 계산
  const recentDates: string[] = [];
  for (let i = 1; i <= 4; i++) {
    recentDates.push(addDays(targetDate, -7 * i));
  }

  // 최근 4주 데이터를 한 번에 조회 (웹 주문 기준, 과거이므로 앱 합산 불필요)
  const recentResults = await Promise.all(
    recentDates.map((d) => getOrdersByDate(d))
  );

  // 고객사별 최근 4주 평균 계산
  const recentAvgMap = new Map<number, {
    totalQty: number;
    count: number;
    products: Map<string, { total: number; count: number }>;
  }>();

  for (const result of recentResults) {
    // 날짜별 고객사 수량 집계
    const dateAccounts = new Map<number, {
      qty: number;
      products: Map<string, number>;
    }>();

    for (const o of result.orders) {
      const existing = dateAccounts.get(o.accountId);
      if (existing) {
        existing.qty += o.quantity;
        existing.products.set(
          o.productName,
          (existing.products.get(o.productName) || 0) + o.quantity
        );
      } else {
        const products = new Map<string, number>();
        products.set(o.productName, o.quantity);
        dateAccounts.set(o.accountId, { qty: o.quantity, products });
      }
    }

    for (const [acctId, data] of dateAccounts) {
      const existing = recentAvgMap.get(acctId);
      if (existing) {
        existing.totalQty += data.qty;
        existing.count += 1;
        for (const [pname, pqty] of data.products) {
          const pe = existing.products.get(pname);
          if (pe) {
            pe.total += pqty;
            pe.count += 1;
          } else {
            existing.products.set(pname, { total: pqty, count: 1 });
          }
        }
      } else {
        const products = new Map<string, { total: number; count: number }>();
        for (const [pname, pqty] of data.products) {
          products.set(pname, { total: pqty, count: 1 });
        }
        recentAvgMap.set(acctId, { totalQty: data.qty, count: 1, products });
      }
    }
  }

  // 오늘 주문이 있는 고객사에 대해 수량 이상 감지
  for (const [acctId, todayData] of todayAccountMap) {
    const recentData = recentAvgMap.get(acctId);
    if (!recentData || recentData.count === 0) continue; // 최근 데이터 없으면 비교 불가

    const avgQty = Math.round((recentData.totalQty / recentData.count) * 10) / 10;
    const diff = todayData.totalQty - avgQty;

    if (Math.abs(diff) >= QTY_ANOMALY_THRESHOLD) {
      // 상품별 비교 생성
      const productBreakdown: QuantityAnomaly['productBreakdown'] = [];
      const allProductNames = new Set<string>();
      for (const pname of todayData.products.keys()) allProductNames.add(pname);
      for (const pname of recentData.products.keys()) allProductNames.add(pname);

      for (const pname of allProductNames) {
        productBreakdown.push({
          productName: pname,
          today: todayData.products.get(pname) || 0,
          avg: recentData.products.has(pname)
            ? Math.round((recentData.products.get(pname)!.total / recentData.products.get(pname)!.count) * 10) / 10
            : 0,
        });
      }

      quantityAnomalies.push({
        accountId: acctId,
        accountName: todayData.name,
        todayQty: todayData.totalQty,
        avgQty,
        diff: Math.round(diff * 10) / 10,
        direction: diff > 0 ? 'up' : 'down',
        productBreakdown,
      });
    }
  }

  // diff 절대값 기준 내림차순 정렬
  quantityAnomalies.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return {
    targetDate,
    dow: actualDow,
    weekdayAnomalies,
    quantityAnomalies,
  };
}

// ══════════════════════════════════════════════════════════════════
// 내부 유틸: groupByCompany
// ══════════════════════════════════════════════════════════════════

/**
 * MergedOrder[]를 고객사별로 그룹핑하여 요약 통계를 계산합니다.
 *
 * @param orders  MergedOrder 배열
 * @returns Map<accountId, CompanySummary>
 */
interface CompanySummary {
  accountId: number;
  accountName: string;
  totalQty: number;
  orderCount: number;          // 해당 기간 내 주문 횟수 (날짜 수)
  avgQty: number;              // 일평균 주문량
  lastOrderDate: string;       // 마지막 주문일
  mainProduct: string;         // 가장 많이 주문한 상품명
  productQtyMap: Map<string, number>;  // 상품별 총 수량
}

function groupByCompany(
  dailyOrders: { date: string; orders: MergedOrder[] }[]
): Map<number, CompanySummary> {
  const map = new Map<number, CompanySummary>();

  for (const { date, orders } of dailyOrders) {
    // 해당 날짜에 주문한 고객사 ID 집합
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
          orderCount: 0, // 아래에서 날짜 단위로 카운트
          avgQty: 0,
          lastOrderDate: date,
          mainProduct: "",
          productQtyMap,
        });
      }
    }

    // 날짜 단위 주문 횟수 카운트
    for (const acctId of dateAccounts) {
      const summary = map.get(acctId);
      if (summary) summary.orderCount += 1;
    }
  }

  // 평균 및 주력 상품 계산
  for (const summary of map.values()) {
    summary.avgQty = summary.orderCount > 0
      ? Math.round((summary.totalQty / summary.orderCount) * 10) / 10
      : 0;

    // 가장 많이 주문한 상품
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
// 메인 쿼리 #4: getClientChangeData
// ══════════════════════════════════════════════════════════════════

/**
 * 고객 변동 현황 데이터를 조회합니다.
 *
 * 처리 흐름:
 *   1) 현재 기간(startDate ~ endDate)과 동일 길이의 이전 기간을 자동 계산
 *   2) 양쪽 기간의 일별 주문 조회 → groupByCompany로 요약
 *   3) 이탈(churned): 이전 기간에 있고 현재 기간에 없는 고객
 *      신규(new): 현재 기간에 있고 이전 기간에 없는 고객
 *      전환(converted): 양쪽 기간에 모두 있으나 일평균이 30% 이상 변동한 고객
 *   4) 요일별 순유입 계산
 *
 * @param startDate  현재 기간 시작일 "YYYY-MM-DD"
 * @param endDate    현재 기간 종료일 "YYYY-MM-DD"
 */
export async function getClientChangeData(
  startDate: string,
  endDate: string
): Promise<ClientChangeResponse> {
  // ─── 기간 길이 & 이전 기간 계산 ───
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const startObj = new Date(sy, sm - 1, sd);
  const endObj = new Date(ey, em - 1, ed);
  const periodDays = Math.round((endObj.getTime() - startObj.getTime()) / (86400000)) + 1;

  const prevEndDate = addDays(startDate, -1);
  const prevStartDate = addDays(startDate, -periodDays);

  // ─── 현재 기간 일별 주문 조회 ───
  const currentDates: string[] = [];
  let cur = startDate;
  while (cur <= endDate) {
    currentDates.push(cur);
    cur = addDays(cur, 1);
  }

  const currentOrderResults = await Promise.all(
    currentDates.map((d) => getOrdersByDate(d).then((r) => ({ date: d, orders: r.orders })))
  );

  // ─── 이전 기간 일별 주문 조회 ───
  const prevDates: string[] = [];
  cur = prevStartDate;
  while (cur <= prevEndDate) {
    prevDates.push(cur);
    cur = addDays(cur, 1);
  }

  const prevOrderResults = await Promise.all(
    prevDates.map((d) => getOrdersByDate(d).then((r) => ({ date: d, orders: r.orders })))
  );

  // ─── 고객사별 요약 생성 ───
  const currentSummary = groupByCompany(currentOrderResults);
  const prevSummary = groupByCompany(prevOrderResults);

  // ─── 변동 분류 ───
  const changes: ClientChange[] = [];

  // 이탈: 이전에 있고 현재에 없음
  for (const [acctId, prev] of prevSummary) {
    if (!currentSummary.has(acctId)) {
      changes.push({
        type: 'churned',
        accountId: prev.accountId,
        accountName: prev.accountName,
        previousAvg: prev.avgQty,
        currentAvg: 0,
        lastOrderDate: prev.lastOrderDate,
        mainProduct: prev.mainProduct,
      });
    }
  }

  // 신규: 현재에 있고 이전에 없음
  for (const [acctId, current] of currentSummary) {
    if (!prevSummary.has(acctId)) {
      changes.push({
        type: 'new',
        accountId: current.accountId,
        accountName: current.accountName,
        previousAvg: 0,
        currentAvg: current.avgQty,
        lastOrderDate: current.lastOrderDate,
        mainProduct: current.mainProduct,
      });
    }
  }

  // 전환: 양쪽에 모두 있으나 일평균 30% 이상 변동
  for (const [acctId, current] of currentSummary) {
    const prev = prevSummary.get(acctId);
    if (!prev) continue; // 이미 '신규'로 처리됨

    const changeRate = prev.avgQty > 0
      ? ((current.avgQty - prev.avgQty) / prev.avgQty) * 100
      : 0;

    if (Math.abs(changeRate) >= 30) {
      changes.push({
        type: 'converted',
        accountId: current.accountId,
        accountName: current.accountName,
        previousAvg: prev.avgQty,
        currentAvg: current.avgQty,
        lastOrderDate: current.lastOrderDate,
        mainProduct: current.mainProduct,
      });
    }
  }

  // ─── 요약 통계 ───
  const summary = {
    churned: changes.filter((c) => c.type === 'churned').length,
    new: changes.filter((c) => c.type === 'new').length,
    converted: changes.filter((c) => c.type === 'converted').length,
    netFlow: changes.filter((c) => c.type === 'new').length
           - changes.filter((c) => c.type === 'churned').length,
  };

  // ─── 요일별 순유입 (현재 기간 기준) ───
  const dowFlows: DowFlow[] = [];
  const dowKeys = ["mon", "tue", "wed", "thu", "fri"];

  for (const dowKey of dowKeys) {
    // 해당 요일에 주문한 현재 기간 고객사
    const currentDow = new Set<number>();
    for (const { date, orders } of currentOrderResults) {
      const [yy, mm, dd] = date.split("-").map(Number);
      const dateObj2 = new Date(yy, mm - 1, dd);
      if (DAY_NAMES[dateObj2.getDay()] === dowKey) {
        for (const o of orders) currentDow.add(o.accountId);
      }
    }

    // 해당 요일에 주문한 이전 기간 고객사
    const prevDow = new Set<number>();
    for (const { date, orders } of prevOrderResults) {
      const [yy, mm, dd] = date.split("-").map(Number);
      const dateObj2 = new Date(yy, mm - 1, dd);
      if (DAY_NAMES[dateObj2.getDay()] === dowKey) {
        for (const o of orders) prevDow.add(o.accountId);
      }
    }

    // 이탈: 이전에 있고 현재에 없음
    let churned = 0;
    for (const id of prevDow) {
      if (!currentDow.has(id)) churned++;
    }

    // 신규: 현재에 있고 이전에 없음
    let newCount = 0;
    for (const id of currentDow) {
      if (!prevDow.has(id)) newCount++;
    }

    dowFlows.push({
      dow: dowKey,
      dowLabel: DOW_MAP[dowKey] || dowKey,
      churned,
      newCount,
      net: newCount - churned,
    });
  }

  return {
    startDate,
    endDate,
    changes,
    summary,
    dowFlows,
  };
}