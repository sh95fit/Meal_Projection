// app/api/dashboard/trend/route.ts
// ──────────────────────────────────────────────────────────────────
// 추이 차트 API
// ──────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getTrendData } from "@/lib/repositories/dashboardQueryRepository";
import { getToday, addDays, getNthBusinessDay } from "@/lib/utils/date";
import type { PeriodPreset } from "@/types/dashboard";

// ★ 기존 getNthBusinessDayFrom 함수 삭제 — lib/utils/date.ts의 getNthBusinessDay 사용

/**
 * GET /api/dashboard/trend
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const preset = searchParams.get("preset") as PeriodPreset | null;
    const today = getToday();

    // 종료일: 오늘 기준 +2 영업일
    const endDate = getNthBusinessDay(today, 2);

    let startDate: string;

    if (preset) {
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
        case "60d":
          startDate = addDays(today, -59);
          break;
        case "90d":
          startDate = addDays(today, -89);
          break;
        case "custom": {
          const fallbackStart = searchParams.get("start");
          const fallbackEnd = searchParams.get("end");
          if (fallbackStart) {
            startDate = fallbackStart;
            if (fallbackEnd && fallbackEnd > endDate) {
              const data = await getTrendData(startDate, fallbackEnd);
              return NextResponse.json(data);
            }
          } else {
            startDate = addDays(today, -29);
          }
          break;
        }
        default:
          startDate = addDays(today, -29);
      }
    } else {
      const customStart = searchParams.get("start");
      const customEnd = searchParams.get("end");

      if (!customStart) {
        return NextResponse.json(
          { error: "start 파라미터가 필요합니다." },
          { status: 400 }
        );
      }

      startDate = customStart;

      if (customEnd && customEnd > endDate) {
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