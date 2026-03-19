// app/(main)/forecasts/new/_hooks/useForecastNew.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getToday } from "@/lib/utils";
import { getProductDeliveryDate } from "@/lib/utils/date";
import { apiGet, apiPost } from "@/lib/api";
import { useProductStore } from "@/lib/stores/useProductStore";
import type {
  ProductWithMappings,
  ForecastTarget,
  OrderSummaryRow,
  UnorderedAccountRow,
  ForecastSummary,
  CompletedForecast,
} from "@/types";

// ─── 로컬 타입 ───
export interface UnorderedRow extends UnorderedAccountRow {
  is_included: boolean;
  adjusted_qty: number;
}

export interface OrderRow extends OrderSummaryRow {
  adjusted_qty: number;
}

export type IncludeFilter = "all" | "included" | "excluded";
export type RecentOrderFilter = "all" | "has" | "none";

export function useForecastNew() {
  const [step, setStep] = useState(1);
  const { products, fetchProducts } = useProductStore();
  const [targets, setTargets] = useState<ForecastTarget[]>([]);
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);

  // Step 2
  const [orderRows, setOrderRows] = useState<OrderRow[]>([]);
  const [unorderedRows, setUnorderedRows] = useState<UnorderedRow[]>([]);
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [step2Loading, setStep2Loading] = useState(false);

  // 필터
  const [searchQuery, setSearchQuery] = useState("");
  const [includeFilter, setIncludeFilter] = useState<IncludeFilter>("all");
  const [recentOrderFilter, setRecentOrderFilter] =
    useState<RecentOrderFilter>("all");

  // 조정 수량
  const [bufferQty, setBufferQty] = useState(0);
  const [bufferInput, setBufferInput] = useState("0");

  // 제출
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedForecasts, setCompletedForecasts] = useState<
    CompletedForecast[]
  >([]);

  // ─── 상품 로드 ───
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ─── 파생 데이터 ───
  const filteredUnorderedRows = unorderedRows.filter((row) => {
    if (
      searchQuery &&
      !row.고객사명.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    if (includeFilter === "included" && !row.is_included) return false;
    if (includeFilter === "excluded" && row.is_included) return false;
    if (recentOrderFilter === "has" && !row.해당요일_최근주문일자) return false;
    if (recentOrderFilter === "none" && row.해당요일_최근주문일자) return false;
    return true;
  });

  const conditionMetRows = orderRows.filter(
    (r) => r.조건충족여부 === "조건충족"
  );
  const conditionNotMetRows = orderRows.filter(
    (r) => r.조건충족여부 !== "조건충족"
  );

  const confirmedQty = orderRows.reduce(
    (s, r) => s + (Number(r.상품수량) || 0),
    0
  );
  const unorderedAdditionalQty = unorderedRows
    .filter((r) => r.is_included)
    .reduce((s, r) => s + Number(r.adjusted_qty || 0), 0);
  const conditionNotMetDelta = conditionNotMetRows.reduce(
    (s, r) => s + (r.adjusted_qty - (Number(r.상품수량) || 0)),
    0
  );
  const additionalQty = unorderedAdditionalQty + conditionNotMetDelta;
  const totalForecastQty = confirmedQty + additionalQty + bufferQty;

  const currentTarget = targets[currentTargetIndex] ?? null;

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: 산출 대상 관리
  // ═══════════════════════════════════════════════════════════════

  /**
   * 대상 추가.
   * 출고일은 오늘 기준 N번째 **상품 영업일**로 자동 산출합니다.
   * (공휴일 · 일요일 제외, saturday_available=false면 토요일도 제외)
   */
  const addTarget = () => {
    if (products.length === 0) return;
    const product = products[0];
    setTargets((prev) => [
      ...prev,
      {
        product,
        deliveryDate: getProductDeliveryDate(
          getToday(),
          product.offset_days,
          product.saturday_available
        ),
      },
    ]);
  };

  /**
   * 대상 수정.
   * - product 변경 시 출고일도 영업일 기준으로 재계산
   * - deliveryDate 직접 변경 시 사용자가 지정한 날짜를 그대로 사용
   */
  const updateTarget = (
    index: number,
    field: "product" | "deliveryDate",
    value: unknown
  ) => {
    setTargets((prev) => {
      const updated = [...prev];
      if (field === "product") {
        const product = value as ProductWithMappings;
        updated[index] = {
          ...updated[index],
          product,
          deliveryDate: getProductDeliveryDate(
            getToday(),
            product.offset_days,
            product.saturday_available
          ),
        };
      } else {
        updated[index] = {
          ...updated[index],
          deliveryDate: value as string,
        };
      }
      return updated;
    });
  };

  /** 대상 삭제 */
  const removeTarget = (index: number) => {
    setTargets((prev) => prev.filter((_, i) => i !== index));
  };

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: 데이터 로드
  // ═══════════════════════════════════════════════════════════════

  const loadOrderData = useCallback(async (target: ForecastTarget) => {
    setStep2Loading(true);
    setSearchQuery("");
    setIncludeFilter("all");
    setRecentOrderFilter("all");
    setBufferQty(0);
    setBufferInput("0");
    setIsSubmitting(false);

    try {
      const [orders, unordered] = await Promise.all([
        apiGet<OrderSummaryRow[]>(
          `/api/forecasts/orders?date=${target.deliveryDate}&productId=${target.product.id}`
        ),
        apiGet<UnorderedAccountRow[]>(
          `/api/forecasts/unordered?date=${target.deliveryDate}&productId=${target.product.id}`
        ),
      ]);

      setOrderRows(
        orders.map((row) => ({
          ...row,
          adjusted_qty: Number(row.상품수량) || 0,
        }))
      );
      setUnorderedRows(
        unordered.map((row) => ({
          ...row,
          is_included: row.주문요일_해당여부 === "포함",
          adjusted_qty: Math.round(Number(row.상품_요일별_중간값) || 0),
        }))
      );

      const conditionNotMetFiltered = orders.filter(
        (r) => r.조건충족여부 === "조건불충족"
      );
      setSummary({
        totalOrderQty: orders.reduce(
          (s, r) => s + (Number(r.상품수량) || 0),
          0
        ),
        orderedAccountCount: orders.length,
        unorderedAccountCount: unordered.length,
        orderDayAccountCount: unordered.filter(
          (r) => r.주문요일_해당여부 === "포함"
        ).length,
        conditionNotMetCount: conditionNotMetFiltered.length,
        conditionNotMetQty: conditionNotMetFiltered.reduce(
          (s, r) => s + (Number(r.상품수량) || 0),
          0
        ),
      });
    } catch (e) {
      console.error(e);
      toast.error("데이터를 불러오지 못했습니다.");
    } finally {
      setStep2Loading(false);
    }
  }, []);

  const startStep2 = () => {
    if (targets.length === 0) {
      toast.error("최소 1개의 산출 대상을 지정해주세요.");
      return;
    }
    setStep(2);
    setCurrentTargetIndex(0);
    loadOrderData(targets[0]);
  };

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: 수량 조정
  // ═══════════════════════════════════════════════════════════════

  const toggleIncluded = (accountId: number) => {
    setUnorderedRows((prev) =>
      prev.map((r) =>
        r.account_id === accountId
          ? { ...r, is_included: !r.is_included }
          : r
      )
    );
  };

  const updateAdjustedQty = (accountId: number, qty: number) => {
    setUnorderedRows((prev) =>
      prev.map((r) =>
        r.account_id === accountId ? { ...r, adjusted_qty: qty } : r
      )
    );
  };

  const updateOrderAdjustedQty = (accountId: number, qty: number) => {
    setOrderRows((prev) =>
      prev.map((r) =>
        r.account_id === accountId && r.조건충족여부 !== "조건충족"
          ? { ...r, adjusted_qty: qty }
          : r
      )
    );
  };

  const handleBufferInputChange = (value: string) => {
    if (/^-?\d*$/.test(value)) {
      setBufferInput(value);
      const parsed = parseInt(value, 10);
      setBufferQty(isNaN(parsed) ? 0 : parsed);
    }
  };

  const handleBufferInputBlur = () => {
    setBufferInput(String(bufferQty));
  };

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: 확정
  // ═══════════════════════════════════════════════════════════════

  const confirmForecast = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const target = targets[currentTargetIndex];

    const details = unorderedRows.map((r) => ({
      account_id: r.account_id,
      account_name: r.고객사명,
      is_included: r.is_included,
      default_qty: Math.round(Number(r.상품_요일별_중간값) || 0),
      adjusted_qty: r.adjusted_qty,
      reference_data: {
        전체_평균: r.전체_평균,
        전체_중간값: r.전체_중간값,
        상품_전체_평균: r.상품_전체_평균,
        상품_전체_중간값: r.상품_전체_중간값,
        요일별_평균: r.요일별_평균,
        요일별_중간값: r.요일별_중간값,
        상품_요일별_평균: r.상품_요일별_평균,
        상품_요일별_중간값: r.상품_요일별_중간값,
        해당요일_최근주문일자: r.해당요일_최근주문일자,
        해당요일_주문횟수: r.해당요일_주문횟수,
        주문요일_해당여부: r.주문요일_해당여부,
      },
    }));

    const conditionNotMetDetails = conditionNotMetRows.map((r) => ({
      account_id: r.account_id,
      account_name: r.고객사명,
      is_included: true,
      default_qty: Number(r.상품수량) || 0,
      adjusted_qty: r.adjusted_qty,
      reference_data: {
        type: "condition_not_met",
        주문채널: r.주문채널,
        원본_상품수량: r.상품수량,
        총주문수량: r.총주문수량,
        ref_전체_평균: r.ref_전체_평균,
        ref_전체_중간값: r.ref_전체_중간값,
        ref_상품_전체_평균: r.ref_상품_전체_평균,
        ref_상품_전체_중간값: r.ref_상품_전체_중간값,
        ref_요일별_평균: r.ref_요일별_평균,
        ref_요일별_중간값: r.ref_요일별_중간값,
        ref_상품_요일별_평균: r.ref_상품_요일별_평균,
        ref_상품_요일별_중간값: r.ref_상품_요일별_중간값,
      },
    }));

    try {
      const result = await apiPost<{ id: number; success: boolean }>(
        "/api/forecasts",
        {
          product_id: target.product.id,
          delivery_date: target.deliveryDate,
          confirmed_order_qty: confirmedQty,
          additional_forecast_qty: additionalQty,
          buffer_qty: bufferQty,
          forecast_qty: totalForecastQty,
          details: [...conditionNotMetDetails, ...details],
        }
      );

      setCompletedForecasts((prev) => [
        ...prev,
        {
          productName: target.product.product_name,
          deliveryDate: target.deliveryDate,
          forecastQty: totalForecastQty,
          bufferQty,
          forecastId: result.id,
        },
      ]);

      toast.success(
        `${target.product.product_name} 발주 예상 수량이 확정되었습니다.`
      );

      if (currentTargetIndex < targets.length - 1) {
        const nextIndex = currentTargetIndex + 1;
        setCurrentTargetIndex(nextIndex);
        loadOrderData(targets[nextIndex]);
      } else {
        setStep(3);
      }
    } catch {
      toast.error("저장에 실패했습니다.");
      setIsSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: 알림 발송
  // ═══════════════════════════════════════════════════════════════

  const sendNotifications = async () => {
    const groupMap = new Map<
      string,
      {
        groupName: string;
        date: string;
        items: { productName: string; qty: number; buffer: number }[];
      }
    >();

    for (const f of completedForecasts) {
      const target = targets.find(
        (t) =>
          t.product.product_name === f.productName &&
          t.deliveryDate === f.deliveryDate
      );
      const groupKey =
        target?.product.notification_group || f.productName;
      const mapKey = groupKey + f.deliveryDate;

      if (!groupMap.has(mapKey)) {
        groupMap.set(mapKey, {
          groupName: groupKey,
          date: f.deliveryDate,
          items: [],
        });
      }
      groupMap.get(mapKey)!.items.push({
        productName: f.productName,
        qty: f.forecastQty,
        buffer: f.bufferQty,
      });
    }

    const groups = Array.from(groupMap.values()).map((g) => ({
      ...g,
      totalQty: g.items.reduce((s, i) => s + i.qty, 0),
    }));

    try {
      await apiPost("/api/notifications", {
        type: "forecast-complete",
        data: { groups },
      });
      toast.success("잔디 알림이 발송되었습니다.");
      setStep(4);
    } catch {
      toast.error("알림 발송에 실패했습니다.");
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: 초기화
  // ═══════════════════════════════════════════════════════════════

  const resetAll = () => {
    setStep(1);
    setTargets([]);
    setCompletedForecasts([]);
    setCurrentTargetIndex(0);
    setBufferQty(0);
    setBufferInput("0");
    setIsSubmitting(false);
  };

  // ═══════════════════════════════════════════════════════════════
  // Return
  // ═══════════════════════════════════════════════════════════════

  return {
    // 상태
    step,
    products,
    targets,
    currentTargetIndex,
    currentTarget,
    orderRows,
    unorderedRows,
    summary,
    step2Loading,
    searchQuery,
    includeFilter,
    recentOrderFilter,
    bufferQty,
    bufferInput,
    isSubmitting,
    completedForecasts,

    // 파생 데이터
    filteredUnorderedRows,
    conditionMetRows,
    conditionNotMetRows,
    confirmedQty,
    unorderedAdditionalQty,
    conditionNotMetDelta,
    additionalQty,
    totalForecastQty,

    // 필터 세터
    setSearchQuery,
    setIncludeFilter,
    setRecentOrderFilter,

    // STEP 1
    addTarget,
    updateTarget,
    removeTarget,
    startStep2,

    // STEP 2
    toggleIncluded,
    updateAdjustedQty,
    updateOrderAdjustedQty,
    handleBufferInputChange,
    handleBufferInputBlur,
    confirmForecast,

    // STEP 3
    sendNotifications,

    // STEP 4
    resetAll,
  };
}