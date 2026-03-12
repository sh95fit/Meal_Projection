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
  