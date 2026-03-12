import { create } from "zustand";
import { apiGet } from "@/lib/api";
import type { ProductWithMappings } from "@/types";

interface ProductStore {
  products: ProductWithMappings[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  setProducts: (products: ProductWithMappings[]) => void;
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: [],
  loading: false,
  loaded: false,
  error: null,

  fetchProducts: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const data = await apiGet<ProductWithMappings[]>("/api/products");
      set({ products: data, loading: false, loaded: true });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "알 수 없는 오류",
      });
    }
  },

  setProducts: (products) => set({ products, loaded: true }),
}));
