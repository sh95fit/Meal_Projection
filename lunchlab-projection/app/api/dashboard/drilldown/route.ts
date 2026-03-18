// ──────────────────────────────────────────────────────────────────
// app/api/dashboard/drilldown/route.ts
// 특이 고객사 드릴다운 API
// ──────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getDrilldownData } from "@/lib/repositories/dashboardQueryRepository";
import { getToday } from "@/lib/utils/date";

/**
 * GET /api/dashboard/drilldown
 *
 * 쿼리 파라미터:
 *   - date (optional) : 기준일 "YYYY-MM-DD". 기본값: 오늘.
 *   - dow  (optional) : 요일 약어 ('mon','tue','wed','thu','fri','sat','sun').
 *                        기본값: date에서 자동 계산.
 *
 * 응답 (200):
 *   DrilldownResponse {
 *     targetDate: string,
 *     dow: string,
 *     weekdayAnomalies: WeekdayAnomaly[],
 *     quantityAnomalies: QuantityAnomaly[]
 *   }
 *
 * 에러:
 *   - 401: 인증 실패
 *   - 500: 서버 에러
 */
export async function GET(request: NextRequest) {
  try {
    // ── 인증 확인 ──
    await requireAuth();

    // ── 파라미터 파싱 ──
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || getToday();
    const dow = searchParams.get("dow") || undefined;

    // ── 데이터 조회 ──
    // getDrilldownData 내부에서:
    //   1) getOrdersByDate(targetDate) → 오늘 주문 (분기 로직 내장)
    //   2) 전체 활성 고객사 조회 (accounts WHERE status='available')
    //   3) 요일 기준 이탈/신규/미지정 분류
    //   4) 최근 4주 같은 요일 데이터 조회 → 수량 이상 감지
    const result = await getDrilldownData(date, dow);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}