import type { ProductWithMappings } from "./product";

// ====== DB 모델 (Supabase 테이블 1:1) ======

export interface OrderForecast {
  id: number;
  product_id: number;
  delivery_date: string;
  confirmed_order_qty: number;
  additional_forecast_qty: number;
  buffer_qty: number;
  forecast_qty: number;
  actual_qty: number | null;
  error_rate: number | null;
  calculated_at: string;
  created_at: string;
  updated_at: string;
  // join
  product_name?: string;
}

export interface ForecastDetail {
  id?: number;
  forecast_id?: number;
  account_id: number;
  account_name: string;
  is_included: boolean;
  default_qty: number;
  adjusted_qty: number;
  reference_data: Record<string, unknown>;
}

export interface ForecastAdjustment {
  id: number;
  forecast_id: number;
  previous_qty: number;
  new_qty: number;
  adjustment_rate: number;
  reason: string | null;
  adjusted_at: string;
}

// ====== 프론트 전용 (산출 프로세스) ======

export interface ForecastTarget {
  product: ProductWithMappings;
  deliveryDate: string;
}

export interface ForecastSummary {
  totalOrderQty: number;
  orderedAccountCount: number;
  unorderedAccountCount: number;
  orderDayAccountCount: number;
  conditionNotMetCount: number;
  conditionNotMetQty: number;
}

export interface CompletedForecast {
  productName: string;
  deliveryDate: string;
  forecastQty: number;
  bufferQty: number;
  forecastId: number;
}
