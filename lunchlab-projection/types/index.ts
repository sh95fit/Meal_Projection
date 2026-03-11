// ====== 상품 마스터 ======
export interface Product {
  id: number;
  product_name: string;
  offset_days: number;
  notification_group: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductIdMapping {
  id: number;
  product_id: number;
  channel: "web" | "app";
  external_id: string;
}

export interface ProductWithMappings extends Product {
  mappings: ProductIdMapping[];
}

// ====== 발주 예상 ======
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

// ====== MySQL 쿼리 결과 ======
export interface OrderSummaryRow {
  배송일자: string;
  account_id: number;
  고객사명: string;
  주문채널: string;
  조건충족여부: string;
  상품수량: number;
  총주문수량: number;
  // ★ 조건불충족 고객사 기준 데이터 (조건충족 고객사는 모두 0)
  ref_전체_평균: number;
  ref_전체_중간값: number;
  ref_상품_전체_평균: number;
  ref_상품_전체_중간값: number;
  ref_요일별_평균: number;
  ref_요일별_중간값: number;
  ref_상품_요일별_평균: number;
  ref_상품_요일별_중간값: number;
}

export interface UnorderedAccountRow {
  account_id: number;
  고객사명: string;
  주문요일: string;
  주문요일_해당여부: string;
  전체_평균: number;
  전체_중간값: number;
  상품_전체_평균: number;
  상품_전체_중간값: number;
  요일별_평균: number;
  요일별_중간값: number;
  상품_요일별_평균: number;
  상품_요일별_중간값: number;
  해당요일_최근주문일자: string | null;
  해당요일_주문횟수: number;
}

// ====== 산출 프로세스 ======
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
