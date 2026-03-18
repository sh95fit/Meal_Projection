// app/api/dashboard/clients/modal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getOrdersByDate } from "@/lib/repositories/dashboardQueryRepository";
import { getToday, addDays } from "@/lib/utils/date";
import { createClient } from "@/lib/supabase/server";

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

    // ── 상품별 평균 / 중간값 ──
    const supabase = await createClient();
    const { data: products } = await supabase
      .from("products")
      .select("id, product_name")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

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

    // ── 추이 데이터 ──
    const recentTrend = recentDates.map((d) => {
      const found = dailyResults.find((r) => r.date === d);
      return { date: d, qty: found?.qty || 0 };
    });

    // ── 고객사명 ──
    const accountName =
      orderedDays[0]?.orders[0]?.accountName || `고객사 #${accountId}`;

    return NextResponse.json({
      accountId,
      accountName,
      totalOrders,
      avgQty,
      medianQty,
      productStats,
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