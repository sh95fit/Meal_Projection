import { createClient } from "@/lib/supabase/server";
import type { OrderForecast } from "@/types";

interface ForecastFilters {
  dateFrom?: string;
  dateTo?: string;
  productIds?: number[];
}

export async function getForecasts(filters: ForecastFilters): Promise<OrderForecast[]> {
    const supabase = await createClient();
  
    let query = supabase
      .from("order_forecasts")
      .select("*, products(product_name)")
      .order("delivery_date", { ascending: false });
  
    if (filters.dateFrom) query = query.gte("delivery_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("delivery_date", filters.dateTo);
    if (filters.productIds && filters.productIds.length > 0) {
      query = query.in("product_id", filters.productIds);
    }
  
    const { data, error } = await query;
    if (error) throw new Error(error.message);
  
    return (data ?? []).map((f) => {
      const raw = f as Record<string, unknown>;
      const products = raw.products as Record<string, unknown> | null;
      return {
        ...raw,
        product_name: products?.product_name ?? null,
        products: undefined,
      };
    }) as unknown as OrderForecast[];
  }

export async function upsertForecast(payload: {
  product_id: number;
  delivery_date: string;
  confirmed_order_qty: number;
  additional_forecast_qty: number;
  buffer_qty: number;
  forecast_qty: number;
  details?: {
    account_id: number;
    account_name: string;
    is_included: boolean;
    default_qty: number;
    adjusted_qty: number;
    reference_data: Record<string, unknown>;
  }[];
}): Promise<number> {
  const supabase = await createClient();

  // 기존 레코드 확인
  const { data: existing } = await supabase
    .from("order_forecasts")
    .select("id")
    .eq("product_id", payload.product_id)
    .eq("delivery_date", payload.delivery_date)
    .single();

  let forecastId: number;

  if (existing) {
    const { error } = await supabase
      .from("order_forecasts")
      .update({
        confirmed_order_qty: payload.confirmed_order_qty,
        additional_forecast_qty: payload.additional_forecast_qty,
        buffer_qty: payload.buffer_qty || 0,
        forecast_qty: payload.forecast_qty,
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
    forecastId = existing.id;

    await supabase.from("forecast_details").delete().eq("forecast_id", forecastId);
  } else {
    const { data: newForecast, error } = await supabase
      .from("order_forecasts")
      .insert({
        product_id: payload.product_id,
        delivery_date: payload.delivery_date,
        confirmed_order_qty: payload.confirmed_order_qty,
        additional_forecast_qty: payload.additional_forecast_qty,
        buffer_qty: payload.buffer_qty || 0,
        forecast_qty: payload.forecast_qty,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    forecastId = newForecast.id;
  }

  // details 저장
  if (payload.details && payload.details.length > 0) {
    const detailRows = payload.details.map((d) => ({
      forecast_id: forecastId,
      account_id: d.account_id,
      account_name: d.account_name,
      is_included: d.is_included,
      default_qty: d.default_qty,
      adjusted_qty: d.adjusted_qty,
      reference_data: d.reference_data,
    }));

    const { error: detailError } = await supabase
      .from("forecast_details")
      .insert(detailRows);

    if (detailError) throw new Error(detailError.message);
  }

  return forecastId;
}

export async function updateForecastQty(id: number, forecastQty: number) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("order_forecasts")
    .update({ forecast_qty: forecastQty, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function getForecastQty(id: number): Promise<number> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("order_forecasts")
    .select("forecast_qty")
    .eq("id", id)
    .single();

  if (!data) throw new Error("Forecast not found");
  return data.forecast_qty;
}

export async function updateActualQty(id: number, actualQty: number) {
  const forecastQty = await getForecastQty(id);

  const errorRate =
    forecastQty > 0
      ? ((actualQty - forecastQty) / forecastQty) * 100
      : 0;

  const supabase = await createClient();
  const { error } = await supabase
    .from("order_forecasts")
    .update({
      actual_qty: actualQty,
      error_rate: Math.round(errorRate * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  return { errorRate };
}

export async function adjustForecast(
  id: number,
  newQty: number,
  reason: string | null
) {
  const previousQty = await getForecastQty(id);
  const diff = newQty - previousQty;
  const adjustmentRate =
    previousQty > 0 ? (diff / previousQty) * 100 : 0;

  const supabase = await createClient();

  const { error: adjError } = await supabase
    .from("forecast_adjustments")
    .insert({
      forecast_id: id,
      previous_qty: previousQty,
      new_qty: newQty,
      adjustment_rate: Math.round(adjustmentRate * 100) / 100,
      reason,
    });

  if (adjError) throw new Error(adjError.message);

  const { error: updateError } = await supabase
    .from("order_forecasts")
    .update({ forecast_qty: newQty, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) throw new Error(updateError.message);

  return { previousQty, newQty, adjustmentRate };
}
