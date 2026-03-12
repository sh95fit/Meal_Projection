"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useProductStore } from "@/lib/stores/useProductStore";
import type { ProductWithMappings } from "@/types";

export interface MappingInput {
  channel: "web" | "app";
  external_id: string;
}

export function useProducts() {
  const { products, loading: storeLoading, fetchProducts, setProducts } = useProductStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithMappings | null>(null);

  // 폼
  const [productName, setProductName] = useState("");
  const [offsetDays, setOffsetDays] = useState(3);
  const [notificationGroup, setNotificationGroup] = useState("");
  const [mappings, setMappings] = useState<MappingInput[]>([]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ─── CRUD 후 store 갱신 ───
  const refreshProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data);
    } catch {
      toast.error("상품 목록을 불러오지 못했습니다.");
    }
  }, [setProducts]);

  const resetForm = () => {
    setProductName("");
    setOffsetDays(3);
    setNotificationGroup("");
    setMappings([]);
    setEditingProduct(null);
  };

  const openCreateDialog = () => { resetForm(); setDialogOpen(true); };

  const openEditDialog = (product: ProductWithMappings) => {
    setEditingProduct(product);
    setProductName(product.product_name);
    setOffsetDays(product.offset_days);
    setNotificationGroup(product.notification_group || "");
    setMappings(product.mappings.map((m) => ({ channel: m.channel, external_id: m.external_id })));
    setDialogOpen(true);
  };

  const addMapping = () => setMappings([...mappings, { channel: "web", external_id: "" }]);
  const removeMapping = (i: number) => setMappings(mappings.filter((_, idx) => idx !== i));
  const updateMapping = (i: number, field: keyof MappingInput, value: string) => {
    const updated = [...mappings];
    updated[i] = { ...updated[i], [field]: value };
    setMappings(updated);
  };

  const handleSubmit = async () => {
    if (!productName.trim()) { toast.error("상품명을 입력해주세요."); return; }
    const payload = {
      product_name: productName,
      offset_days: offsetDays,
      notification_group: notificationGroup || null,
      mappings: mappings.filter((m) => m.external_id.trim()),
    };

    try {
      if (editingProduct) {
        await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        toast.success("상품이 수정되었습니다.");
      } else {
        await fetch("/api/products", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        toast.success("상품이 등록되었습니다.");
      }
      setDialogOpen(false);
      resetForm();
      refreshProducts();  // store 갱신
    } catch { toast.error("저장에 실패했습니다."); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      toast.success("상품이 삭제되었습니다.");
      refreshProducts();  // store 갱신
    } catch { toast.error("삭제에 실패했습니다."); }
  };

  return {
    products, loading: storeLoading, dialogOpen, setDialogOpen, editingProduct,
    productName, setProductName, offsetDays, setOffsetDays,
    notificationGroup, setNotificationGroup,
    mappings, addMapping, removeMapping, updateMapping,
    openCreateDialog, openEditDialog, handleSubmit, handleDelete,
  };
}
