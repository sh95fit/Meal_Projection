// ──────────────────────────────────────────────────────────────────
// app/api/dashboard/trend/route.ts
// 추이 차트 API
// ──────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getTrendData } from "@/lib/repositories/dashboardQueryRepository";
import { getToday, addDays, isBusinessDay } from "@/lib/utils/date";
import type { PeriodPreset } from "@/types/dashboard";

/**
 * 오늘 기준 N번째 영업일을 구합니다.
 * (공휴일·일요일 제외)
 *
 * @param fromDate  기준일 "YYYY-MM-DD"
 * @param n         몇 번째 영업일 (1 = 다음 영업일, 2 = 그 다음)
 * @returns "YYYY-MM-DD"
 */
function getNthBusinessDayFrom(fromDate: string, n: number): string {
  let cursor = fromDate;
  let count = 0;
  while (count < n) {
    cursor = addDays(cursor, 1);
    if (isBusinessDay(cursor)) {
      count++;
    }
  }
  return cursor;
}

/**
 * GET /api/dashboard/trend
 *
 * 쿼리 파라미터:
 *   - preset (optional) : 'year' | '7d' | '30d' | '90d'
 *   - start  (optional) : 시작일 "YYYY-MM-DD" (custom 모드)
 *   - end    (optional) : 종료일 "YYYY-MM-DD" (custom 모드)
 *
 * 종료일은 항상 오늘 +2 영업일까지 확장됩니다.
 * (이미 주문이 접수되고 있는 미래 영업일 포함)
 *
 * 응답 (200): TrendResponse
 * 에러: 400 / 401 / 500
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const preset = searchParams.get("preset") as PeriodPreset | null;
    const today = getToday();

    // 종료일: 오늘 기준 +2 영업일
    const endDate = getNthBusinessDayFrom(today, 2);

    let startDate: string;

    if (preset) {
      // ── 프리셋 모드 ──
      switch (preset) {
        case "year":
          startDate = `${today.slice(0, 4)}-01-01`;
          break;
        case "7d":
          startDate = addDays(today, -6);
          break;
        case "30d":
          startDate = addDays(today, -29);
          break;
        case "90d":
          startDate = addDays(today, -89);
          break;
        default:
          startDate = addDays(today, -6);
      }
    } else {
      // ── 커스텀 모드 ──
      const customStart = searchParams.get("start");
      const customEnd = searchParams.get("end");

      if (!customStart) {
        return NextResponse.json(
          { error: "start 파라미터가 필요합니다." },
          { status: 400 }
        );
      }

      startDate = customStart;

      // 커스텀 종료일이 지정되어도 +2 영업일까지는 보장
      if (customEnd && customEnd > endDate) {
        // 사용자가 더 먼 미래를 지정한 경우 그대로 사용
        const data = await getTrendData(startDate, customEnd);
        return NextResponse.json(data);
      }
    }

    const data = await getTrendData(startDate, endDate);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[trend] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
