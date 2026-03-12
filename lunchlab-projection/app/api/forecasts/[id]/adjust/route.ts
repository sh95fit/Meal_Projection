import { NextRequest, NextResponse } from "next/server";
import { adjustForecast } from "@/lib/repositories/forecastRepository";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { new_qty, reason } = await request.json();
    const result = await adjustForecast(parseInt(id), new_qty, reason);
    return NextResponse.json({
      success: true,
      previous_qty: result.previousQty,
      new_qty: result.newQty,
      adjustment_rate: result.adjustmentRate,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message === "Forecast not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
