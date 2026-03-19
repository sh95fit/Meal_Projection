// app/api/dashboard/clients/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getClientChangeData } from "@/lib/repositories/clientRepository";
import { getToday, addDays } from "@/lib/utils/date";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const today = getToday();
    const start = searchParams.get("start") || addDays(today, -29);
    const end = searchParams.get("end") || today;
    const preset = searchParams.get("preset") || null;

    // ── 이전 비교 기간 계산 ──
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const periodDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));

    let prevStart: string;
    let prevEnd: string;

    if (preset === "year") {
      const prevYear = Number(start.slice(0, 4)) - 1;
      prevStart = `${prevYear}-01-01`;
      prevEnd = `${prevYear}${end.slice(4)}`;
    } else {
      prevEnd = addDays(start, -1);
      prevStart = addDays(prevEnd, -periodDays);
    }

    const result = await getClientChangeData(start, end, prevStart, prevEnd);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[clients route error]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
