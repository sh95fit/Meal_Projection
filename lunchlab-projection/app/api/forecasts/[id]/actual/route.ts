import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PUT /api/forecasts/:id/actual — 확정 수량 기입
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  const { actual_qty } = body;

  // 먼저 현재 forecast_qty를 조회
  const { data: forecast } = await supabase
    .from("order_forecasts")
    .select("forecast_qty")
    .eq("id", parseInt(id))
    .single();

  if (!forecast) {
    return NextResponse.json({ error: "Forecast not found" }, { status: 404 });
  }

  // 오차율 계산
  const errorRate =
    forecast.forecast_qty > 0
      ? ((actual_qty - forecast.forecast_qty) / forecast.forecast_qty) * 100
      : 0;

  const { error } = await supabase
    .from("order_forecasts")
    .update({
      actual_qty,
      error_rate: Math.round(errorRate * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parseInt(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, error_rate: errorRate });
}
