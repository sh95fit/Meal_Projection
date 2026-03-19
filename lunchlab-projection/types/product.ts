// types/product.ts

// ====== 상품 마스터 ======

export interface Product {
  id: number;
  product_name: string;
  offset_days: number;
  /** 토요일 판매 여부 — false면 월~금만 영업일로 계산 */
  saturday_available: boolean;
  notification_group: string | null;
  color: string;
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