import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/forecasts/:id/adjust — 수량 조정
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  const { new_qty, reason } = body;

  // 현재 수량 조회
  const { data: forecast } = await supabase
    .from("order_forecasts")
    .select("forecast_qty")
    .eq("id", parseInt(id))
    .single();

  if (!forecast) {
    return NextResponse.json({ error: "Forecast not found" }, { status: 404 });
  }

  const previous_qty = forecast.forecast_qty;
  const diff = new_qty - previous_qty;
  const adjustment_rate =
    previous_qty > 0 ? (diff / previous_qty) * 100 : 0;

  // 조정 이력 저장
  const { error: adjError } = await supabase
    .from("forecast_adjustments")
    .insert({
      forecast_id: parseInt(id),
      previous_qty,
      new_qty,
      adjustment_rate: Math.round(adjustment_rate * 100) / 100,
      reason,
    });

  if (adjError) {
    return NextResponse.json({ error: adjError.message }, { status: 500 });
  }

  // forecast_qty 업데이트
  const { error: updateError } = await supabase
    .from("order_forecasts")
    .update({
      forecast_qty: new_qty,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parseInt(id));

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    previous_qty,
    new_qty,
    adjustment_rate,
  });
}
