// ──────────────────────────────────────────────────────────────────
// app/api/dashboard/clients/route.ts
// 고객 변동 현황 API
// ──────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getClientChangeData } from "@/lib/repositories/dashboardQueryRepository";
import { getToday, addDays } from "@/lib/utils/date";

/**
 * GET /api/dashboard/clients
 *
 * 쿼리 파라미터:
 *   - start (optional) : 현재 기간 시작일 "YYYY-MM-DD". 기본값: 오늘 - 29일.
 *   - end   (optional) : 현재 기간 종료일 "YYYY-MM-DD". 기본값: 오늘.
 *
 *   이전 기간은 자동으로 계산됩니다:
 *     이전 기간 종료일 = start - 1일
 *     이전 기간 시작일 = start - (end - start + 1)일
 *     (현재 기간과 동일한 길이)
 *
 * 응답 (200):
 *   ClientChangeResponse {
 *     startDate: string,
 *     endDate: string,
 *     changes: ClientChange[],
 *     summary: { churned, new, converted, netFlow },
 *     dowFlows: DowFlow[]
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
    const today = getToday();
    const start = searchParams.get("start") || addDays(today, -29);
    const end = searchParams.get("end") || today;

    // ── 데이터 조회 ──
    // getClientChangeData 내부에서:
    //   1) 이전 기간 자동 계산 (동일 길이)
    //   2) 양쪽 기간의 일별 주문 조회 → getOrdersByDate() (분기 로직 내장)
    //   3) groupByCompany()로 고객사별 요약
    //   4) 이탈/신규/전환 분류
    //   5) 요일별 순유입 계산
    const result = await getClientChangeData(start, end);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}