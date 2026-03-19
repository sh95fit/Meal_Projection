// app/api/dashboard/clients/modal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getOrdersByDate } from "@/lib/repositories/dashboardQueryRepository";
import { getProductColorMap } from "@/lib/repositories/productRepository";
import { PRESET_COLORS } from "@/lib/utils/color";
import { getToday, addDays } from "@/lib/utils/date";
import { queryMySQL } from "@/lib/mysql/client";
import { createClient } from "@/lib/supabase/server";

const DOW_KR: Record<string, string> = {
  sun: "일", mon: "월", tue: "화", wed: "수",
  thu: "목", fri: "금", sat: "토",
};

function toDateStr(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

function parseOrderDay(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed
        .map((d: string) => DOW_KR[d.toLowerCase().trim()] || d)
        .filter(Boolean);
    }
  } catch { /* ignore */ }
  return [];
}

function median(arr: number[]): number {
  const n = arr.length;
  if (n === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return n % 2 === 0
    ? Math.round(((sorted[n / 2 - 1] + sorted[n / 2]) / 2) * 10) / 10
    : sorted[Math.floor(n / 2)];
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const accountIdStr = searchParams.get("accountId");
    if (!accountIdStr) {
      return NextResponse.json(
        { error: "accountId 파라미터가 필요합니다." },
        { status: 400 }
      );
    }
    const accountId = Number(accountIdStr);
    const clientType = searchParams.get("type") || "churned";

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
    const orderDays = parseOrderDay(acct.order_day);

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
        ? Math.round((allQtyList.reduce((s, q) => s + q, 0) / allQtyList.length) * 10) / 10
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
      const mappings = (raw.product_id_mappings || []) as { channel: string; external_id: string }[];
      for (const m of mappings) {
        if (m.channel === "web") {
          extIdToName.set(String(m.external_id), String(raw.product_name));
        }
      }
    }

    // ══════════════════════════════════════════
    // 7) 상품별 평균 / 중간값 (전체 기간)
    // ══════════════════════════════════════════
    // product_id(MySQL) → productName별 일별 수량 수집
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
          ? Math.round((qtyArr.reduce((s, q) => s + q, 0) / qtyArr.length) * 10) / 10
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
      if (dow >= 1 && dow <= 6) allDates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    const recentDates = allDates.slice(-30);

    const dailyResults = await Promise.all(
      recentDates.map(async (d) => {
        const { orders } = await getOrdersByDate(d);
        const acctOrders = orders.filter((o) => o.accountId === accountId);
        const totalQty = acctOrders.reduce((s, o) => s + o.quantity, 0);
        return { date: d, qty: totalQty, orders: acctOrders };
      })
    );

    const recentTrend = recentDates.map((d) => {
      const found = dailyResults.find((r) => r.date === d);
      const row: Record<string, string | number> = {
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
      dbAccountName || orderedDays[0]?.orders[0]?.accountName || `고객사 #${accountId}`;

    // ══════════════════════════════════════════
    // 응답
    // ══════════════════════════════════════════
    return NextResponse.json({
      accountId,
      accountName,
      clientType,
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
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
