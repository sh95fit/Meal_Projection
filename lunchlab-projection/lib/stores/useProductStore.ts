import { create } from "zustand";
import type { ProductWithMappings } from "@/types";

interface ProductStore {
  products: ProductWithMappings[];  // 상품 목록 데이터
  loading: boolean; // API 호출 중인지
  loaded: boolean; // 한 번이라도 로드 완료했는지
  error: string | null; // 에러 메시지

  fetchProducts: () => Promise<void>; // 목록 불러오기
  setProducts: (products: ProductWithMappings[]) => void; // 외부에서 직접 갱신
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: [],
  loading: false,
  loaded: false,
  error: null,

  fetchProducts: async () => {
    // get()으로 현재 상태를 읽어서 중복 요청 방지
    if (get().loaded || get().loading) return;

    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("상품 목록을 불러오지 못했습니다.");
      const data = await res.json();
      set({ products: data, loading: false, loaded: true });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "알 수 없는 오류",
      });
    }
  },

  // 상품 CRUD 후 목록 갱신용
  setProducts: (products) => set({ products, loaded: true }),
}));
