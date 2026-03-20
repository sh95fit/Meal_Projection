// app/(main)/forecasts/_hooks/useForecastList.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { apiGet, apiPut, apiPost } from "@/lib/api";
import { useProductStore } from "@/lib/stores/useProductStore";
import type { OrderForecast, ProductWithMappings } from "@/types";

export function useForecastList() {
  const [forecasts, setForecasts] = useState<OrderForecast[]>([]);
  const { products, fetchProducts } = useProductStore();
  const [loading, setLoading] = useState(true);

  // 필터
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  // 수정 다이얼로그
  const [editDialog, setEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<OrderForecast | null>(null);
  const [editQty, setEditQty] = useState(0);

  // 실적 다이얼로그
  const [actualDialog, setActualDialog] = useState(false);
  const [actualTarget, setActualTarget] = useState<OrderForecast | null>(null);
  const [actualQty, setActualQty] = useState(0);

  // 조정 다이얼로그
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<OrderForecast | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");

  // ★ 중복 제출 방지 플래그
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [isActualSubmitting, setIsActualSubmitting] = useState(false);
  const [isAdjustSubmitting, setIsAdjustSubmitting] = useState(false);

  // ─── 상품 로드 (Zustand store 사용) ───
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const fetchForecasts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (selectedProductIds.length > 0) params.set("productIds", selectedProductIds.join(","));

    try {
      const data = await apiGet<OrderForecast[]>(`/api/forecasts?${params.toString()}`);
      setForecasts(data);
    } catch {
      toast.error("목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedProductIds]);

  useEffect(() => { fetchForecasts(); }, [fetchForecasts]);

  // ─── 수정 ───
  const openEditDialog = (f: OrderForecast) => {
    setEditTarget(f);
    setEditQty(f.forecast_qty);
    setIsEditSubmitting(false); // ★ 다이얼로그 열 때 초기화
    setEditDialog(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (isEditSubmitting) return; // ★ 중복 방지
    setIsEditSubmitting(true);   // ★ 잠금

    const previousQty = editTarget.forecast_qty;
    try {
      await apiPut(`/api/forecasts/${editTarget.id}`, { forecast_qty: editQty });
      await apiPost("/api/notifications", {
        type: "forecast-change",
        data: {
          date: editTarget.delivery_date,
          productName: editTarget.product_name,
          previousQty,
          newQty: editQty,
        },
      });
      toast.success("수량이 수정되었습니다.");
      setEditDialog(false);
      fetchForecasts();
    } catch {
      toast.error("수정에 실패했습니다.");
      setIsEditSubmitting(false); // ★ 실패 시 재시도 허용
    }
  };

  // ─── 실적 ───
  const openActualDialog = (f: OrderForecast) => {
    setActualTarget(f);
    setActualQty(f.actual_qty || f.forecast_qty);
    setIsActualSubmitting(false); // ★ 다이얼로그 열 때 초기화
    setActualDialog(true);
  };

  const handleActual = async () => {
    if (!actualTarget) return;
    if (isActualSubmitting) return; // ★ 중복 방지
    setIsActualSubmitting(true);   // ★ 잠금

    try {
      await apiPut(`/api/forecasts/${actualTarget.id}/actual`, { actual_qty: actualQty });
      toast.success("확정 수량이 기입되었습니다.");
      setActualDialog(false);
      fetchForecasts();
    } catch {
      toast.error("기입에 실패했습니다.");
      setIsActualSubmitting(false); // ★ 실패 시 재시도 허용
    }
  };

  // ─── 조정 ───
  const openAdjustDialog = (f: OrderForecast) => {
    setAdjustTarget(f);
    setAdjustQty(f.forecast_qty);
    setAdjustReason("");
    setIsAdjustSubmitting(false); // ★ 다이얼로그 열 때 초기화
    setAdjustDialog(true);
  };

  const handleAdjust = async () => {
    if (!adjustTarget) return;
    if (isAdjustSubmitting) return; // ★ 중복 방지
    setIsAdjustSubmitting(true);   // ★ 잠금

    try {
      const result = await apiPost<{
        previous_qty: number;
        new_qty: number;
        adjustment_rate: number;
      }>(`/api/forecasts/${adjustTarget.id}/adjust`, {
        new_qty: adjustQty,
        reason: adjustReason,
      });

      await apiPost("/api/notifications", {
        type: "forecast-adjust",
        data: {
          date: adjustTarget.delivery_date,
          previousQty: result.previous_qty,
          newQty: adjustQty,
          diff: adjustQty - result.previous_qty,
          rate: result.adjustment_rate?.toFixed(1),
          reason: adjustReason,
        },
      });
      toast.success("수량이 조정되었습니다.");
      setAdjustDialog(false);
      fetchForecasts();
    } catch {
      toast.error("조정에 실패했습니다.");
      setIsAdjustSubmitting(false); // ★ 실패 시 재시도 허용
    }
  };

  const toggleProductFilter = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return {
    forecasts, products, loading,
    dateFrom, setDateFrom, dateTo, setDateTo,
    selectedProductIds, toggleProductFilter,
    // edit
    editDialog, setEditDialog, editTarget, editQty, setEditQty,
    openEditDialog, handleEdit, isEditSubmitting,           // ★ 추가
    // actual
    actualDialog, setActualDialog, actualTarget, actualQty, setActualQty,
    openActualDialog, handleActual, isActualSubmitting,     // ★ 추가
    // adjust
    adjustDialog, setAdjustDialog, adjustTarget, adjustQty, setAdjustQty,
    adjustReason, setAdjustReason, openAdjustDialog, handleAdjust, isAdjustSubmitting, // ★ 추가
  };
}