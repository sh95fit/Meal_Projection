import { NextRequest, NextResponse } from "next/server";
import { updateActualQty } from "@/lib/repositories/forecastRepository";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { actual_qty } = await request.json();
    const { errorRate } = await updateActualQty(parseInt(id), actual_qty);
    return NextResponse.json({ success: true, error_rate: errorRate });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message === "Forecast not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
