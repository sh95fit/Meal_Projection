// ──────────────────────────────────────────────────────────────────
// app/api/dashboard/drilldown/detail/route.ts
// 드릴다운 상세 분석 API
// 추이 차트에서 바 클릭 시 해당 날짜의 상세 데이터를 반환합니다.
// ──────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getDrilldownDetailData } from "@/lib/repositories/dashboardQueryRepository";
import { getToday } from "@/lib/utils/date";

/**
 * GET /api/dashboard/drilldown/detail?date=YYYY-MM-DD
 *
 * 응답: DrilldownDetailResponse
 *   - chartProductList : 3개월 차트용 상품 목록
 *   - chartRows        : 3개월 일자별 상품별 누적 데이터
 *   - productDayMap    : 상품별 일자별 고객사 수 + 수량
 *   - daySummary       : 선택 날짜 요약 카드
 *   - weekdayClients   : 요일 기준 특이 고객사
 *   - weekdaySummary   : 요일 케이스별 수치 요약
 *   - quantityClients  : 수량 기준 특이 고객사 (±3 이상)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || getToday();

    const data = await getDrilldownDetailData(date);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[drilldown/detail] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
