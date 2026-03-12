"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { OrderForecast, ProductWithMappings } from "@/types";

export function useForecastList() {
  const [forecasts, setForecasts] = useState<OrderForecast[]>([]);
  const [products, setProducts] = useState<ProductWithMappings[]>([]);
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

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then(setProducts).catch(() => {});
  }, []);

  const fetchForecasts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (selectedProductIds.length > 0) params.set("productIds", selectedProductIds.join(","));

    try {
      const res = await fetch(`/api/forecasts?${params.toString()}`);
      setForecasts(await res.json());
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
    setEditDialog(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const previousQty = editTarget.forecast_qty;
    try {
      await fetch(`/api/forecasts/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forecast_qty: editQty }),
      });
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "forecast-change",
          data: { date: editTarget.delivery_date, productName: editTarget.product_name, previousQty, newQty: editQty },
        }),
      });
      toast.success("수량이 수정되었습니다.");
      setEditDialog(false);
      fetchForecasts();
    } catch { toast.error("수정에 실패했습니다."); }
  };

  // ─── 실적 ───
  const openActualDialog = (f: OrderForecast) => {
    setActualTarget(f);
    setActualQty(f.actual_qty || f.forecast_qty);
    setActualDialog(true);
  };

  const handleActual = async () => {
    if (!actualTarget) return;
    try {
      await fetch(`/api/forecasts/${actualTarget.id}/actual`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual_qty: actualQty }),
      });
      toast.success("확정 수량이 기입되었습니다.");
      setActualDialog(false);
      fetchForecasts();
    } catch { toast.error("기입에 실패했습니다."); }
  };

  // ─── 조정 ───
  const openAdjustDialog = (f: OrderForecast) => {
    setAdjustTarget(f);
    setAdjustQty(f.forecast_qty);
    setAdjustReason("");
    setAdjustDialog(true);
  };

  const handleAdjust = async () => {
    if (!adjustTarget) return;
    try {
      const res = await fetch(`/api/forecasts/${adjustTarget.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_qty: adjustQty, reason: adjustReason }),
      });
      const result = await res.json();
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "forecast-adjust",
          data: {
            date: adjustTarget.delivery_date,
            previousQty: result.previous_qty,
            newQty: adjustQty,
            diff: adjustQty - result.previous_qty,
            rate: result.adjustment_rate?.toFixed(1),
            reason: adjustReason,
          },
        }),
      });
      toast.success("수량이 조정되었습니다.");
      setAdjustDialog(false);
      fetchForecasts();
    } catch { toast.error("조정에 실패했습니다."); }
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
    openEditDialog, handleEdit,
    // actual
    actualDialog, setActualDialog, actualTarget, actualQty, setActualQty,
    openActualDialog, handleActual,
    // adjust
    adjustDialog, setAdjustDialog, adjustTarget, adjustQty, setAdjustQty,
    adjustReason, setAdjustReason, openAdjustDialog, handleAdjust,
  };
}
