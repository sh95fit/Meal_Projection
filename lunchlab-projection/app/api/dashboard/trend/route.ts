// ──────────────────────────────────────────────────────────────────
// app/api/dashboard/trend/route.ts
// 추이 차트 API
// ──────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getTrendData } from "@/lib/repositories/dashboardQueryRepository";
import { getToday, addDays } from "@/lib/utils/date";

/**
 * GET /api/dashboard/trend
 *
 * 쿼리 파라미터 (2가지 모드):
 *
 *   [모드 A] preset 사용:
 *     - preset : 'year' | '7d' | '30d' | '90d'
 *       → 'year'  : 올해 1월 1일 ~ 오늘
 *       → '7d'    : 오늘 - 6일 ~ 오늘
 *       → '30d'   : 오늘 - 29일 ~ 오늘
 *       → '90d'   : 오늘 - 89일 ~ 오늘
 *
 *   [모드 B] 커스텀 범위:
 *     - start : 시작일 "YYYY-MM-DD"
 *     - end   : 종료일 "YYYY-MM-DD"
 *
 *   preset이 있으면 start/end는 무시됩니다.
 *
 * 응답 (200):
 *   TrendResponse {
 *     productList: TrendProduct[],
 *     rows: TrendRow[]
 *   }
 *
 * 에러:
 *   - 400: start/end 누락 (preset도 없을 때)
 *   - 401: 인증 실패
 *   - 500: 서버 에러
 */
export async function GET(request: NextRequest) {
  try {
    // ── 인증 확인 ──
    await requireAuth();

    // ── 파라미터 파싱 ──
    const { searchParams } = new URL(request.url);
    const preset = searchParams.get("preset");

    let startDate: string;
    let endDate: string;

    if (preset) {
      // ── 프리셋 모드 ──
      // 프리셋에 따라 startDate/endDate를 자동 계산합니다.
      const today = getToday();
      endDate = today;

      switch (preset) {
        case "year": {
          // 올해 1월 1일 ~ 오늘
          const year = today.split("-")[0];
          startDate = `${year}-01-01`;
          break;
        }
        case "7d":
          // 최근 7일 (오늘 포함)
          startDate = addDays(today, -6);
          break;
        case "30d":
          // 최근 30일 (오늘 포함)
          startDate = addDays(today, -29);
          break;
        case "90d":
          // 최근 90일 (오늘 포함)
          startDate = addDays(today, -89);
          break;
        default:
          // 알 수 없는 프리셋 → 기본 90일
          startDate = addDays(today, -89);
      }
    } else {
      // ── 커스텀 모드 ──
      const start = searchParams.get("start");
      const end = searchParams.get("end");

      if (!start || !end) {
        return NextResponse.json(
          { error: "preset 또는 start/end 파라미터가 필요합니다." },
          { status: 400 }
        );
      }

      startDate = start;
      endDate = end;
    }

    // ── 데이터 조회 ──
    // getTrendData 내부에서 각 날짜마다 getOrdersByDate()를 호출하므로
    // 날짜별 needsAppMenuMerge() 분기가 자동으로 적용됩니다.
    // (과거 날짜는 웹만, 오늘 14:30 전이면 웹+앱 합산)
    const result = await getTrendData(startDate, endDate);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}