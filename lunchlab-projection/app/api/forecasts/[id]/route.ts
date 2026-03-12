import { NextRequest, NextResponse } from "next/server";
import { updateForecastQty } from "@/lib/repositories/forecastRepository";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { forecast_qty } = await request.json();
    await updateForecastQty(parseInt(id), forecast_qty);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
