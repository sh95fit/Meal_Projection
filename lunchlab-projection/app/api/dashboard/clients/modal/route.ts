// app/api/dashboard/clients/modal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getOrdersByDate } from "@/lib/repositories/dashboardQueryRepository";
import { getProductColorMap } from "@/lib/repositories/productRepository";
import { PRESET_COLORS } from "@/lib/utils/color";
import { getToday, addDays } from "@/lib/utils/date";
import { queryMySQL } from "@/lib/mysql/client";
import { createClient } from "@/lib/supabase/server";

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

    // ── 계정 정보 조회 (날짜 필드) ──
    const accountRows = (await queryMySQL(
      `SELECT name, subscription_at, terminate_at, subscription_scheduled_at
       FROM accounts WHERE id = ?`,
      [accountId]
    )) as Record<string, unknown>[];

    const acct = accountRows[0] || {};
    const subscriptionAt = toDateStr(acct.subscription_at);
    const terminateAt = toDateStr(acct.terminate_at);
    const subscriptionScheduledAt = toDateStr(acct.subscription_scheduled_at);
    const dbAccountName = acct.name ? String(acct.name) : null;

    // ── 첫 주문일 조회 ──
    const firstOrderRows = (await queryMySQL(
      `SELECT MIN(o.delivery_date) AS first_date
       FROM orders o
       WHERE o.account_id = ? AND o.deleted_at IS NULL`,
      [accountId]
    )) as Record<string, unknown>[];
    const firstOrderDate = toDateStr(firstOrderRows[0]?.first_date);

    // ── 마지막 주문일 조회 ──
    const lastOrderRows = (await queryMySQL(
      `SELECT MAX(o.delivery_date) AS last_date
       FROM orders o
       WHERE o.account_id = ? AND o.deleted_at IS NULL`,
      [accountId]
    )) as Record<string, unknown>[];
    const lastOrderDate = toDateStr(lastOrderRows[0]?.last_date);

    // ── 총 서비스 이용일 계산 ──
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

    // ── 최근 영업일 목록 생성 (45일 전부터 → 30영업일 추출) ──
    const today = getToday();
    const allDates: string[] = [];
    let cursor = addDays(today, -45);
    while (cursor <= today) {
      const [y, m, d] = cursor.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dow = dateObj.getDay();
      if (dow >= 1 && dow <= 6) {
        allDates.push(cursor);
      }
      cursor = addDays(cursor, 1);
    }
    const recentDates = allDates.slice(-30);

    // ── 날짜별 주문 조회 ──
    const dailyResults = await Promise.all(
      recentDates.map(async (d) => {
        const { orders } = await getOrdersByDate(d);
        const acctOrders = orders.filter((o) => o.accountId === accountId);
        const totalQty = acctOrders.reduce((s, o) => s + o.quantity, 0);
        return { date: d, qty: totalQty, orders: acctOrders };
      })
    );

    // ── 주문 있는 날만 추출 ──
    const orderedDays = dailyResults.filter((d) => d.qty > 0);
    const totalOrders = orderedDays.length;

    // ── 전체 평균 / 중간값 ──
    const qtyList = orderedDays.map((d) => d.qty).sort((a, b) => a - b);
    const avgQty =
      totalOrders > 0
        ? Math.round(
            (qtyList.reduce((s, q) => s + q, 0) / totalOrders) * 10
          ) / 10
        : 0;

    function median(arr: number[]): number {
      const n = arr.length;
      if (n === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      return n % 2 === 0
        ? Math.round(((sorted[n / 2 - 1] + sorted[n / 2]) / 2) * 10) / 10
        : sorted[Math.floor(n / 2)];
    }

    const medianQty = median(qtyList);

    // ── 상품 목록 + 색상 ──
    const colorMap = await getProductColorMap();
    const supabase = await createClient();
    const { data: products } = await supabase
      .from("products")
      .select("id, product_name")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    const productList = (products || []).map((p, idx) => {
      const name = String(p.product_name);
      return {
        productName: name,
        color: colorMap.get(name) || PRESET_COLORS[idx % PRESET_COLORS.length],
      };
    });

    // ── 상품별 평균 / 중간값 ──
    const productStats = (products || []).map((p) => {
      const pName = String(p.product_name);
      const pQtyList: number[] = [];
      for (const day of orderedDays) {
        const pqty = day.orders
          .filter((o) => o.productName === pName)
          .reduce((s, o) => s + o.quantity, 0);
        if (pqty > 0) pQtyList.push(pqty);
      }
      const cnt = pQtyList.length;
      const avg =
        cnt > 0
          ? Math.round(
              (pQtyList.reduce((s, q) => s + q, 0) / cnt) * 10
            ) / 10
          : 0;
      return { productName: pName, avg, median: median(pQtyList) };
    });

    // ── 추이 데이터 (상품별 수량 포함) ──
    const recentTrend = recentDates.map((d) => {
      const found = dailyResults.find((r) => r.date === d);
      const row: Record<string, string | number> = {
        date: d,
        qty: found?.qty || 0,
      };
      for (const pl of productList) {
        const pqty = (found?.orders || [])
          .filter((o) => o.productName === pl.productName)
          .reduce((s, o) => s + o.quantity, 0);
        row[pl.productName] = pqty;
      }
      return row;
    });

    // ── 고객사명 ──
    const accountName =
      dbAccountName ||
      orderedDays[0]?.orders[0]?.accountName ||
      `고객사 #${accountId}`;

    return NextResponse.json({
      accountId,
      accountName,
      clientType,
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
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}