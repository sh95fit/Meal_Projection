// ──────────────────────────────────────────────────────────────────
// lib/repositories/dashboardQueryRepository.ts
// LunchLab 대시보드 — 데이터 조회 리포지토리
//
// [리팩토링 변경사항]
// - getClientChangeData, groupByCompany → clientRepository.ts로 이관 완료
// - 상수 → lib/constants/dashboard.ts로 통합
// - 미사용 DOW_MAP 제거
// - needsAppMenuMerge → 내부 전용 (export 제거)
// - mergeOrders: productMappings 캐싱 지원 (loadProductMappingMap)
// - getDrilldownDetailData: Supabase 중복 호출 통합
// - formatDayLabel: 중복 파싱 제거
//
// [최적화 변경사항]
// #3: getDrilldownDetailData — accounts 전체 스캔 → 관련 ID만 + 병렬화
// #6: getDrilldownDetailData — products Supabase 직접 → getAllProducts() 캐시
// #8: getTrendData — 벌크 쿼리에 trial 제외 조건 추가
// 
// ──────────────────────────────────────────────────────────────────

import { queryMySQL } from "@/lib/mysql/client";
import { createClient } from "@/lib/supabase/server";
import { getToday, addDays, isHoliday } from "@/lib/utils/date";
import { parseOrderDay, toDateStr } from "@/lib/utils/format";
import {
  CUTOFF_HOUR,
  CUTOFF_MINUTE,
  QTY_ANOMALY_THRESHOLD,
  DATA_START_DATE,
  DAY_NAMES,
  DOW_LABELS,
} from "@/lib/constants/dashboard";
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
} from "@/types/dashboard";
import { getProductColorMap, getAllProducts } from "@/lib/repositories/productRepository";
import { PRESET_COLORS } from "@/lib/utils/color";
import { cached } from "@/lib/cache";

// ──────────────────────────────────────────────────────────────────
// 내부 타입
// ──────────────────────────────────────────────────────────────────

interface ProductMappingInfo {
  productId: number;
  productName: string;
}

type ProductMappingMap = Map<string, ProductMappingInfo>;

// ──────────────────────────────────────────────────────────────────
// 내부 유틸
// ──────────────────────────────────────────────────────────────────

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
// loadProductMappingMap
// ══════════════════════════════════════════════════════════════════

async function loadProductMappingMap(): Promise<ProductMappingMap> {
  return cached("productMappingMap", 5 * 60 * 1000, async () => {
    const supabase = await createClient();
    const { data: products } = await supabase
      .from("products")
      .select("id, product_name, product_id_mappings(channel, external_id)")
      .is("deleted_at", null);

    const map: ProductMappingMap = new Map();
    if (!products || products.length === 0) return map;

    for (const p of products) {
      const raw = p as Record<string, unknown>;
      const mappings = (raw.product_id_mappings || []) as {
        channel: string;
        external_id: string;
      }[];
      for (const m of mappings) {
        map.set(`${m.channel}:${m.external_id}`, {
          productId: Number(raw.id),
          productName: String(raw.product_name),
        });
      }
    }
    return map;
  });
}

// ══════════════════════════════════════════════════════════════════
// needsAppMenuMerge
// ══════════════════════════════════════════════════════════════════

const mergeCheckCache = new Map<string, { result: boolean; ts: number }>();

function needsAppMenuMerge(dateStr: string): boolean {
  const now = Date.now();

  // 캐시 확인 (60초 TTL)
  const entry = mergeCheckCache.get(dateStr);
  if (entry && now - entry.ts < 60_000) {
    return entry.result;
  }

  const nowDate = new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  const deliveryDate = new Date(y, m - 1, d);

  const deadlineDate = new Date(deliveryDate);
  deadlineDate.setDate(deadlineDate.getDate() - 1);

  while (deadlineDate.getDay() === 0 || deadlineDate.getDay() === 6) {
    deadlineDate.setDate(deadlineDate.getDate() - 1);
  }

  let deadlineDateStr = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, "0")}-${String(deadlineDate.getDate()).padStart(2, "0")}`;
  while (isHoliday(deadlineDateStr)) {
    deadlineDate.setDate(deadlineDate.getDate() - 1);
    while (deadlineDate.getDay() === 0 || deadlineDate.getDay() === 6) {
      deadlineDate.setDate(deadlineDate.getDate() - 1);
    }
    deadlineDateStr = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, "0")}-${String(deadlineDate.getDate()).padStart(2, "0")}`;
  }

  const deadlineUTC = Date.UTC(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate(),
    CUTOFF_HOUR - 9,
    CUTOFF_MINUTE,
    0
  );

  const result = nowDate.getTime() < deadlineUTC;
  mergeCheckCache.set(dateStr, { result, ts: now });

  // 100개 초과 시 오래된 항목 정리
  if (mergeCheckCache.size > 100) {
    for (const [key, val] of mergeCheckCache) {
      if (now - val.ts > 60_000) mergeCheckCache.delete(key);
    }
  }

  return result;
}

// ══════════════════════════════════════════════════════════════════
// getWebOrdersByDate
// ══════════════════════════════════════════════════════════════════

async function getWebOrdersByDate(dateStr: string): Promise<
  {
    accountId: number;
    accountName: string;
    externalProductId: string;
    quantity: number;
    totalQty: number;
    channel: "web" | "trial";
  }[]
> {
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
// getAppOrdersByDate
// ══════════════════════════════════════════════════════════════════

async function getAppOrdersByDate(dateStr: string): Promise<
  {
    accountId: number;
    accountName: string;
    externalProductId: string;
    quantity: number;
    totalQty: number;
    minOrderQuantity: number;
  }[]
> {
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
// mergeOrders
// ══════════════════════════════════════════════════════════════════

async function mergeOrders(
  webOrders: Awaited<ReturnType<typeof getWebOrdersByDate>>,
  appOrders: Awaited<ReturnType<typeof getAppOrdersByDate>>,
  mappingMap?: ProductMappingMap
): Promise<MergedOrder[]> {
  const resolvedMap = mappingMap ?? (await loadProductMappingMap());
  if (resolvedMap.size === 0) return [];

  const merged = new Map<
    string,
    {
      accountId: number;
      accountName: string;
      productId: number;
      productName: string;
      quantity: number;
      totalQty: number;
      hasWeb: boolean;
      hasApp: boolean;
      isTrial: boolean;
    }
  >();

  function addToMerged(
    accountId: number,
    accountName: string,
    productId: number,
    productName: string,
    quantity: number,
    totalQty: number,
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
        accountId,
        accountName,
        productId,
        productName,
        quantity,
        totalQty,
        hasWeb: source === "web",
        hasApp: source === "app",
        isTrial: source === "trial",
      });
    }
  }

  for (const row of webOrders) {
    const mapped = resolvedMap.get(`web:${row.externalProductId}`);
    if (!mapped) continue;
    addToMerged(row.accountId, row.accountName, mapped.productId, mapped.productName, row.quantity, row.totalQty, row.channel);
  }

  for (const row of appOrders) {
    const mapped = resolvedMap.get(`app:${row.externalProductId}`);
    if (!mapped) continue;
    addToMerged(row.accountId, row.accountName, mapped.productId, mapped.productName, row.quantity, row.totalQty, "app");
  }

  const result: MergedOrder[] = [];
  for (const v of merged.values()) {
    let channel: MergedOrder["channel"];
    if (v.isTrial) channel = "trial";
    else if (v.hasWeb && v.hasApp) channel = "both";
    else if (v.hasApp) channel = "app";
    else channel = "web";
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
// getOrdersByDate (진입점)  — web/app 쿼리 병렬화
// ══════════════════════════════════════════════════════════════════

export async function getOrdersByDate(
  dateStr: string,
  mappingMap?: ProductMappingMap
): Promise<OrdersByDateResult> {
  const shouldMergeApp = needsAppMenuMerge(dateStr);

  // ★ A-2: 독립적인 web과 app 쿼리를 동시에 실행
  const [webOrders, appOrders] = await Promise.all([
    getWebOrdersByDate(dateStr),
    shouldMergeApp ? getAppOrdersByDate(dateStr) : Promise.resolve([]),
  ]);

  const orders = await mergeOrders(webOrders, appOrders, mappingMap);
  return { orders, appOrdersMerged: shouldMergeApp };
}

// ══════════════════════════════════════════════════════════════════
// formatDayLabel
// ══════════════════════════════════════════════════════════════════

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}(${DOW_LABELS[dateObj.getDay()]})`;
}

// ══════════════════════════════════════════════════════════════════
// getRealtimeData
// ══════════════════════════════════════════════════════════════════

export async function getRealtimeData(
  targetDate?: string
): Promise<RealtimeResponse> {
  const deliveryDate = targetDate || getToday();
  const lastWeekDate = addDays(deliveryDate, -7);

  const mappingMap = await loadProductMappingMap();

  const [todayResult, lastWeekResult] = await Promise.all([
    getOrdersByDate(deliveryDate, mappingMap),
    getOrdersByDate(lastWeekDate, mappingMap),
  ]);

  const supabase = await createClient();
  const { data: forecasts } = await supabase
    .from("order_forecasts")
    .select("product_id, forecast_qty, confirmed_order_qty, additional_forecast_qty, buffer_qty")
    .eq("delivery_date", deliveryDate);

  const forecastMap = new Map<number, { forecastQty: number; confirmedQty: number; additionalQty: number; bufferQty: number }>();
  for (const f of forecasts || []) {
    forecastMap.set(Number(f.product_id), {
      forecastQty: Number(f.forecast_qty) || 0,
      confirmedQty: Number(f.confirmed_order_qty) || 0,
      additionalQty: Number(f.additional_forecast_qty) || 0,
      bufferQty: Number(f.buffer_qty) || 0,
    });
  }

  const todayByProduct = new Map<number, { name: string; qty: number }>();
  for (const o of todayResult.orders) {
    const existing = todayByProduct.get(o.productId);
    if (existing) existing.qty += o.quantity;
    else todayByProduct.set(o.productId, { name: o.productName, qty: o.quantity });
  }

  const lastWeekByProduct = new Map<number, number>();
  for (const o of lastWeekResult.orders) {
    lastWeekByProduct.set(o.productId, (lastWeekByProduct.get(o.productId) || 0) + o.quantity);
  }

  // ★ #6 패턴: getAllProducts() 캐시 사용
  const allProductsList = await getAllProducts();

  const products: RealtimeProduct[] = allProductsList.map((p) => {
    const pid = Number(p.id);
    const todayQty = todayByProduct.get(pid)?.qty || 0;
    const lastWeekQty = lastWeekByProduct.get(pid) || 0;
    const forecast = forecastMap.get(pid);
    const forecastQty = forecast?.forecastQty ?? 0;

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
// ★ #8: getTrendData — trial 제외 조건 추가
// ══════════════════════════════════════════════════════════════════

export async function getTrendData(
  startDate: string,
  endDate: string
): Promise<TrendResponse> {
  const [colorMap, mappingMap, allProductsList] = await Promise.all([
    getProductColorMap(),
    loadProductMappingMap(),
    getAllProducts(),
  ]);

  const productList: TrendProduct[] = allProductsList.map((p, idx) => ({
    productId: Number(p.id),
    productName: String(p.product_name),
    color: resolveColor(String(p.product_name), colorMap, idx),
  }));

  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const closedDates: string[] = [];
  const pendingDates: string[] = [];
  for (const d of dates) {
    if (needsAppMenuMerge(d)) {
      pendingDates.push(d);
    } else {
      closedDates.push(d);
    }
  }

  const dateProductMap = new Map<string, Map<number, number>>();

  // ★ #8: 마감 완료 날짜 벌크 쿼리에 trial 주문 제외
  if (closedDates.length > 0) {
    const bulkRows = (await queryMySQL(
      `SELECT DATE_FORMAT(o.delivery_date, '%Y-%m-%d') AS delivery_date,
              CAST(od.product_id AS CHAR) AS external_product_id,
              CAST(SUM(od.quantity) AS SIGNED) AS quantity
       FROM orders o
       JOIN \`order-details\` od ON od.order_id = o.id
       WHERE o.delivery_date >= ? AND o.delivery_date <= ?
         AND o.delivery_date >= '${DATA_START_DATE}'
         AND o.deleted_at IS NULL AND od.deleted_at IS NULL
         AND o.id NOT IN (
           SELECT tso.order_id
           FROM trial_schedule_orders tso
           JOIN trial_schedules ts ON ts.id = tso.trial_schedule_id
           WHERE ts.deleted_at IS NULL AND tso.deleted_at IS NULL
         )
       GROUP BY o.delivery_date, od.product_id
       ORDER BY o.delivery_date`,
      [closedDates[0], closedDates[closedDates.length - 1]]
    )) as Record<string, unknown>[];

    for (const row of bulkRows) {
      const date = toDateStr(row.delivery_date) ?? "";
      if (!date) continue;
      const extId = String(row.external_product_id || "");
      const mapped = mappingMap.get(`web:${extId}`);
      if (!mapped) continue;

      if (!dateProductMap.has(date)) dateProductMap.set(date, new Map());
      const pMap = dateProductMap.get(date)!;
      pMap.set(mapped.productId, (pMap.get(mapped.productId) || 0) + (Number(row.quantity) || 0));
    }
  }

  if (pendingDates.length > 0) {
    const pendingResults = await Promise.all(
      pendingDates.map((d) => getOrdersByDate(d, mappingMap))
    );
    pendingDates.forEach((date, idx) => {
      const pMap = new Map<number, number>();
      for (const o of pendingResults[idx].orders) {
        pMap.set(o.productId, (pMap.get(o.productId) || 0) + o.quantity);
      }
      dateProductMap.set(date, pMap);
    });
  }

  const rows: TrendRow[] = dates.map((date) => {
    const byProduct = dateProductMap.get(date) || new Map();
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
// ★ #3 + #6: getDrilldownDetailData
// ══════════════════════════════════════════════════════════════════

export async function getDrilldownDetailData(
  targetDate: string
): Promise<DrilldownDetailResponse> {
  const [ty, tm, td] = targetDate.split("-").map(Number);
  const targetDateObj = new Date(ty, tm - 1, td);
  const dowIndex = targetDateObj.getDay();
  const dow = DOW_LABELS[dowIndex];
  const dowName = DAY_NAMES[dowIndex];

  // ★ 공통 리소스 병렬 1회 로드 + #6: getAllProducts 캐시 사용
  const [mappingMap, colorMap, allProductsList] = await Promise.all([
    loadProductMappingMap(),
    getProductColorMap(),
    getAllProducts(),
  ]);

  // 금주 & 전주 주문 조회
  const lastWeekDate = addDays(targetDate, -7);
  const [thisWeekResult, lastWeekResult] = await Promise.all([
    getOrdersByDate(targetDate, mappingMap),
    getOrdersByDate(lastWeekDate, mappingMap),
  ]);
  const thisWeekOrders = thisWeekResult.orders;
  const lastWeekOrders = lastWeekResult.orders;

  // ──────────────────────────────────────────────────────────
  // [1] 요약 카드
  // ──────────────────────────────────────────────────────────

  const thisWeekByAccount: Record<number, { name: string; qty: number; products: Map<string, number> }> = {};
  for (const o of thisWeekOrders) {
    if (!thisWeekByAccount[o.accountId]) {
      thisWeekByAccount[o.accountId] = { name: o.accountName, qty: 0, products: new Map() };
    }
    thisWeekByAccount[o.accountId].qty += o.quantity;
    const prev = thisWeekByAccount[o.accountId].products.get(o.productName) || 0;
    thisWeekByAccount[o.accountId].products.set(o.productName, prev + o.quantity);
  }

  const lastWeekByAccount: Record<number, { name: string; qty: number; products: Map<string, number> }> = {};
  for (const o of lastWeekOrders) {
    if (!lastWeekByAccount[o.accountId]) {
      lastWeekByAccount[o.accountId] = { name: o.accountName, qty: 0, products: new Map() };
    }
    lastWeekByAccount[o.accountId].qty += o.quantity;
    const prev = lastWeekByAccount[o.accountId].products.get(o.productName) || 0;
    lastWeekByAccount[o.accountId].products.set(o.productName, prev + o.quantity);
  }

  // ★ #3: 관련 account ID만 수집
  const relevantAccountIds = Array.from(new Set([
    ...Object.keys(thisWeekByAccount).map(Number),
    ...Object.keys(lastWeekByAccount).map(Number),
  ]));

  // ★ #3: accounts 전체 스캔 → 관련 ID만 + 병렬화
  const mysqlDow = dowIndex + 1;

  let totalAccounts = 0;
  const accountOrderDaysMap = new Map<number, string[]>();
  const accountSubscriptionMap = new Map<number, string | null>();
  const accountStatusMap = new Map<number, string>();
  const dowCountMap = new Map<number, number>();

  if (relevantAccountIds.length > 0) {
    const placeholders = relevantAccountIds.map(() => "?").join(",");

    const [accountCountRows, subscriptionRows, dowCountRows] = await Promise.all([
      // 전체 available 계정 수 (변경 없음 — 이건 전체 카운트 필요)
      queryMySQL(`SELECT COUNT(*) AS cnt FROM accounts WHERE status = 'available'`, []),

      // ★ 관련 ID만 조회
      queryMySQL(
        `SELECT id, order_day, subscription_at, status FROM accounts WHERE id IN (${placeholders})`,
        relevantAccountIds
      ),

      // ★ 관련 ID만 + 병렬
      queryMySQL(
        `SELECT o.account_id, COUNT(DISTINCT o.delivery_date) AS cnt
         FROM orders o
         WHERE o.deleted_at IS NULL
           AND o.delivery_date <= ?
           AND DAYOFWEEK(o.delivery_date) = ?
           AND o.account_id IN (${placeholders})
         GROUP BY o.account_id`,
        [targetDate, mysqlDow, ...relevantAccountIds]
      ),
    ]) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]];

    totalAccounts = Number(accountCountRows[0]?.cnt) || 0;

    for (const row of subscriptionRows) {
      const aid = Number(row.id);
      accountOrderDaysMap.set(aid, parseOrderDay(row.order_day));
      accountStatusMap.set(aid, String(row.status || "unknown"));

      const subAt = row.subscription_at;
      if (!subAt) {
        accountSubscriptionMap.set(aid, null);
      } else if (subAt instanceof Date) {
        accountSubscriptionMap.set(aid, toDateStr(subAt));
      } else {
        const str = String(subAt);
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
          accountSubscriptionMap.set(aid, str.slice(0, 10));
        } else {
          const parsed = new Date(str);
          if (!isNaN(parsed.getTime())) {
            accountSubscriptionMap.set(aid, toDateStr(parsed));
          } else {
            accountSubscriptionMap.set(aid, null);
          }
        }
      }
    }

    for (const row of dowCountRows) {
      dowCountMap.set(Number(row.account_id), Number(row.cnt) || 0);
    }
  } else {
    const accountCountRows = (await queryMySQL(
      `SELECT COUNT(*) AS cnt FROM accounts WHERE status = 'available'`, []
    )) as Record<string, unknown>[];
    totalAccounts = Number(accountCountRows[0]?.cnt) || 0;
  }

  const orderedAccountIds = new Set(Object.keys(thisWeekByAccount).map(Number));
  const orderedCount = orderedAccountIds.size;
  const unorderedCount = totalAccounts - orderedCount;

  let totalQty = 0;
  for (const acct of Object.values(thisWeekByAccount)) {
    totalQty += acct.qty;
  }

  // ──────────────────────────────────────────────────────────
  // [2] 상품별 배지 — ★ #6: getAllProducts 캐시 사용
  // ──────────────────────────────────────────────────────────

  const productQtyMap = new Map<number, { productName: string; qty: number }>();
  for (const o of thisWeekOrders) {
    const existing = productQtyMap.get(o.productId);
    if (existing) existing.qty += o.quantity;
    else productQtyMap.set(o.productId, { productName: o.productName, qty: o.quantity });
  }

  const productChips: ProductChip[] = allProductsList
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

  const weekdayClients: WeekdayCaseClient[] = [];

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
        products: Array.from(info.products.entries()).map(([name, qty]) => ({ productName: name, qty })),
      });
    }
  }

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
        products: Array.from(info.products.entries()).map(([name, qty]) => ({ productName: name, qty })),
      });
    }
  }

  const weekdayClientIds = new Set(weekdayClients.map((c) => c.accountId));

  for (const [aid, info] of Object.entries(thisWeekByAccount)) {
    const accountId = Number(aid);
    if (weekdayClientIds.has(accountId)) continue;  // ★ O(1)
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
      products: Array.from(info.products.entries()).map(([name, qty]) => ({ productName: name, qty })),
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
  // [4] 수량 기준 특이 고객사
  // ──────────────────────────────────────────────────────────

  const quantityClients: QuantityAnomalyClient[] = [];

  for (const accountId of relevantAccountIds) {
    const tw = thisWeekByAccount[accountId];
    const lw = lastWeekByAccount[accountId];
    if (!tw && !lw) continue;

    const thisQty = tw?.qty || 0;
    const lastQty = lw?.qty || 0;
    const diff = thisQty - lastQty;

    if (Math.abs(diff) >= QTY_ANOMALY_THRESHOLD) {
      const twProducts = tw?.products || new Map<string, number>();
      const lwProducts = lw?.products || new Map<string, number>();
      const allProductNames = new Set([...twProducts.keys(), ...lwProducts.keys()]);

      quantityClients.push({
        accountId,
        accountName: tw?.name || lw?.name || "",
        accountStatus: accountStatusMap.get(accountId) ?? "unknown",
        subscriptionAt: accountSubscriptionMap.get(accountId) ?? null,
        dowOrderCount: dowCountMap.get(accountId) ?? 0,
        lastWeekQty: lastQty,
        thisWeekQty: thisQty,
        diff,
        changeRate: lastQty > 0 ? Math.round((diff / lastQty) * 100) : thisQty > 0 ? 100 : 0,
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