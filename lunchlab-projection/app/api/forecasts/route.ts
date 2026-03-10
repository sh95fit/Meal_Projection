import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/forecasts — 목록 조회 (필터 포함)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const productIds = searchParams.get("productIds"); // comma-separated

  let query = supabase
    .from("order_forecasts")
    .select("*, products(product_name)")
    .order("delivery_date", { ascending: false });

  if (dateFrom) {
    query = query.gte("delivery_date", dateFrom);
  }
  if (dateTo) {
    query = query.lte("delivery_date", dateTo);
  }
  if (productIds) {
    const ids = productIds.split(",").map(Number);
    query = query.in("product_id", ids);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const forecasts = data.map((f: Record<string, unknown>) => ({
    ...f,
    product_name: (f.products as Record<string, unknown>)?.product_name,
    products: undefined,
  }));

  return NextResponse.json(forecasts);
}

// POST /api/forecasts — 예상 수량 확정 저장
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const {
    product_id,
    delivery_date,
    confirmed_order_qty,
    additional_forecast_qty,
    forecast_qty,
    details,
  } = body;

  // upsert: 동일 product_id + delivery_date 조합은 1건만
  const { data: existing } = await supabase
    .from("order_forecasts")
    .select("id")
    .eq("product_id", product_id)
    .eq("delivery_date", delivery_date)
    .single();

  let forecastId: number;

  if (existing) {
    // 기존 레코드 업데이트
    const { error } = await supabase
      .from("order_forecasts")
      .update({
        confirmed_order_qty,
        additional_forecast_qty,
        forecast_qty,
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    forecastId = existing.id;

    // 기존 details 삭제
    await supabase
      .from("forecast_details")
      .delete()
      .eq("forecast_id", forecastId);
  } else {
    // 새 레코드 생성
    const { data: newForecast, error } = await supabase
      .from("order_forecasts")
      .insert({
        product_id,
        delivery_date,
        confirmed_order_qty,
        additional_forecast_qty,
        forecast_qty,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    forecastId = newForecast.id;
  }

  // details 저장
  if (details && details.length > 0) {
    const detailRows = details.map(
      (d: {
        account_id: number;
        account_name: string;
        is_included: boolean;
        default_qty: number;
        adjusted_qty: number;
        reference_data: Record<string, unknown>;
      }) => ({
        forecast_id: forecastId,
        account_id: d.account_id,
        account_name: d.account_name,
        is_included: d.is_included,
        default_qty: d.default_qty,
        adjusted_qty: d.adjusted_qty,
        reference_data: d.reference_data,
      })
    );

    const { error: detailError } = await supabase
      .from("forecast_details")
      .insert(detailRows);

    if (detailError) {
      return NextResponse.json(
        { error: detailError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ id: forecastId, success: true }, { status: 201 });
}
