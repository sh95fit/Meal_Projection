// app/(main)/products/_hooks/useProducts.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useProductStore } from "@/lib/stores/useProductStore";
import { getRandomProductColor } from "@/lib/utils/color";
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
  const [saturdayAvailable, setSaturdayAvailable] = useState(false); // ★ 추가
  const [notificationGroup, setNotificationGroup] = useState("");
  const [mappings, setMappings] = useState<MappingInput[]>([]);
  const [color, setColor] = useState("#818cf8");

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const refreshProducts = useCallback(async () => {
    try {
      const data = await apiGet<ProductWithMappings[]>("/api/products");
      setProducts(data);
    } catch {
      toast.error("상품 목록을 불러오지 못했습니다.");
    }
  }, [setProducts]);

  const resetForm = () => {
    setProductName("");
    setOffsetDays(3);
    setSaturdayAvailable(false); // ★ 추가
    setNotificationGroup("");
    setMappings([]);
    const usedColors = products.map((p) => p.color).filter(Boolean);
    setColor(getRandomProductColor(usedColors));
    setEditingProduct(null);
  };

  const openCreateDialog = () => { resetForm(); setDialogOpen(true); };

  const openEditDialog = (product: ProductWithMappings) => {
    setEditingProduct(product);
    setProductName(product.product_name);
    setOffsetDays(product.offset_days);
    setSaturdayAvailable(product.saturday_available); // ★ 추가
    setNotificationGroup(product.notification_group || "");
    setMappings(product.mappings.map((m) => ({ channel: m.channel, external_id: m.external_id })));
    setColor(product.color || "#818cf8");
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
      saturday_available: saturdayAvailable, // ★ 추가
      notification_group: notificationGroup || null,
      mappings: mappings.filter((m) => m.external_id.trim()),
      color,
    };

    try {
      if (editingProduct) {
        await apiPatch(`/api/products/${editingProduct.id}`, payload);
        toast.success("상품이 수정되었습니다.");
      } else {
        await apiPost("/api/products", payload);
        toast.success("상품이 등록되었습니다.");
      }
      setDialogOpen(false);
      resetForm();
      refreshProducts();
    } catch {
      toast.error("저장에 실패했습니다.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await apiDelete(`/api/products/${id}`);
      toast.success("상품이 삭제되었습니다.");
      refreshProducts();
    } catch {
      toast.error("삭제에 실패했습니다.");
    }
  };

  return {
    products, loading: storeLoading, dialogOpen, setDialogOpen, editingProduct,
    productName, setProductName, offsetDays, setOffsetDays,
    saturdayAvailable, setSaturdayAvailable, // ★ 추가
    notificationGroup, setNotificationGroup,
    color, setColor,
    mappings, addMapping, removeMapping, updateMapping,
    openCreateDialog, openEditDialog, handleSubmit, handleDelete,
  };
}