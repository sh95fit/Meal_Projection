"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ArrowRight, Check, Send, Search } from "lucide-react";
import { toast } from "sonner";
import type {
  ProductWithMappings,
  ForecastTarget,
  OrderSummaryRow,
  UnorderedAccountRow,
  ForecastSummary,
} from "@/types";

import { formatDateWithDay } from "@/lib/utils";

// ─── 유틸리티 함수 ───

function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── 타입 ───

interface UnorderedRow extends UnorderedAccountRow {
  is_included: boolean;
  adjusted_qty: number;
}

interface OrderRow extends OrderSummaryRow {
  adjusted_qty: number;
}

type IncludeFilter = "all" | "included" | "excluded";
type RecentOrderFilter = "all" | "has" | "none";

export default function ForecastNewPage() {
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState<ProductWithMappings[]>([]);
  const [targets, setTargets] = useState<ForecastTarget[]>([]);
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);

  // Step 2 상태
  const [orderRows, setOrderRows] = useState<OrderRow[]>([]);
  const [unorderedRows, setUnorderedRows] = useState<UnorderedRow[]>([]);
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [step2Loading, setStep2Loading] = useState(false);

  // 미주문 고객사 검색/필터
  const [searchQuery, setSearchQuery] = useState("");
  const [includeFilter, setIncludeFilter] = useState<IncludeFilter>("all");
  const [recentOrderFilter, setRecentOrderFilter] =
    useState<RecentOrderFilter>("all");

  // 여유 버퍼
  const [bufferQty, setBufferQty] = useState(0);

  // 확정 버튼 중복 클릭 방지
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 완료된 forecasts
  const [completedForecasts, setCompletedForecasts] = useState<
    {
      productName: string;
      deliveryDate: string;
      forecastQty: number;
      bufferQty: number;
      forecastId: number;
    }[]
  >([]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => toast.error("상품 목록을 불러오지 못했습니다."));
  }, []);

  // 필터링된 미주문 고객사 목록
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

  // 주문 확정 — 조건충족/조건불충족 분리
  const conditionMetRows = orderRows.filter(
    (r) => r.조건충족여부 === "조건충족"
  );
  const conditionNotMetRows = orderRows.filter(
    (r) => r.조건충족여부 !== "조건충족"
  );

  // ★ 수량 계산 — 조건불충족 변동분은 추가 예상에 반영
  // 확정 수량 = 모든 주문 고객사의 "원본" 상품수량 합계 (변동 없음)
  const confirmedQty = orderRows.reduce(
    (s, r) => s + (Number(r.상품수량) || 0),
    0
  );
  // 미주문 고객사 추가 예상
  const unorderedAdditionalQty = unorderedRows
    .filter((r) => r.is_included)
    .reduce((s, r) => s + Number(r.adjusted_qty || 0), 0);
  // 조건불충족 변동분 = (조정값 - 원본) 합계
  const conditionNotMetDelta = conditionNotMetRows.reduce(
    (s, r) => s + (r.adjusted_qty - (Number(r.상품수량) || 0)),
    0
  );
  // 추가 예상 = 미주문 + 조건불충족 변동분
  const additionalQty = unorderedAdditionalQty + conditionNotMetDelta;
  const totalForecastQty = confirmedQty + additionalQty + bufferQty;

  // ===== STEP 1: 대상 지정 =====
  const addTarget = () => {
    if (products.length === 0) return;
    const product = products[0];
    setTargets([
      ...targets,
      {
        product,
        deliveryDate: addDays(getToday(), product.offset_days),
      },
    ]);
  };

  const updateTarget = (
    index: number,
    field: "product" | "deliveryDate",
    value: unknown
  ) => {
    const updated = [...targets];
    if (field === "product") {
      const product = value as ProductWithMappings;
      updated[index] = {
        ...updated[index],
        product,
        deliveryDate: addDays(getToday(), product.offset_days),
      };
    } else {
      updated[index] = { ...updated[index], deliveryDate: value as string };
    }
    setTargets(updated);
  };

  const removeTarget = (index: number) => {
    setTargets(targets.filter((_, i) => i !== index));
  };

  // ===== STEP 2: 산출 =====
  const loadOrderData = useCallback(async (target: ForecastTarget) => {
    setStep2Loading(true);
    setSearchQuery("");
    setIncludeFilter("all");
    setRecentOrderFilter("all");
    setBufferQty(0);
    setIsSubmitting(false);

    try {
      const [ordersRes, unorderedRes] = await Promise.all([
        fetch(
          `/api/forecasts/orders?date=${target.deliveryDate}&productId=${target.product.id}`
        ),
        fetch(
          `/api/forecasts/unordered?date=${target.deliveryDate}&productId=${target.product.id}`
        ),
      ]);

      const orders: OrderSummaryRow[] = await ordersRes.json();
      const unordered: UnorderedAccountRow[] = await unorderedRes.json();

      const ordersWithAdjust: OrderRow[] = orders.map((row) => ({
        ...row,
        adjusted_qty: Number(row.상품수량) || 0,
      }));
      setOrderRows(ordersWithAdjust);

      const withDefaults: UnorderedRow[] = unordered.map((row) => ({
        ...row,
        is_included: row.주문요일_해당여부 === "포함",
        adjusted_qty: Math.round(Number(row.상품_요일별_중간값) || 0),
      }));
      setUnorderedRows(withDefaults);

      const totalOrderQty = orders.reduce(
        (s, r) => s + (Number(r.상품수량) || 0),
        0
      );
      const orderedAccountCount = orders.length;
      const unorderedAccountCount = unordered.length;
      const orderDayAccountCount = unordered.filter(
        (r) => r.주문요일_해당여부 === "포함"
      ).length;
      const conditionNotMetFiltered = orders.filter(
        (r) => r.조건충족여부 === "조건불충족"
      );
      const conditionNotMetCount = conditionNotMetFiltered.length;
      const conditionNotMetQty = conditionNotMetFiltered.reduce(
        (s, r) => s + (Number(r.상품수량) || 0),
        0
      );

      setSummary({
        totalOrderQty,
        orderedAccountCount,
        unorderedAccountCount,
        orderDayAccountCount,
        conditionNotMetCount,
        conditionNotMetQty,
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

  const toggleIncluded = (accountId: number) => {
    setUnorderedRows((prev) =>
      prev.map((r) =>
        r.account_id === accountId ? { ...r, is_included: !r.is_included } : r
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

  // 확정
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

    const allDetails = [...conditionNotMetDetails, ...details];

    try {
      const res = await fetch("/api/forecasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: target.product.id,
          delivery_date: target.deliveryDate,
          confirmed_order_qty: confirmedQty,
          additional_forecast_qty: additionalQty,
          buffer_qty: bufferQty,
          forecast_qty: totalForecastQty,
          details: allDetails,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "저장에 실패했습니다.");
        setIsSubmitting(false);
        return;
      }

      setCompletedForecasts((prev) => [
        ...prev,
        {
          productName: target.product.product_name,
          deliveryDate: target.deliveryDate,
          forecastQty: totalForecastQty,
          bufferQty: bufferQty,
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

  // ===== STEP 3: 알림 발송 =====
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
      const groupKey = target?.product.notification_group || f.productName;

      if (!groupMap.has(groupKey + f.deliveryDate)) {
        groupMap.set(groupKey + f.deliveryDate, {
          groupName: groupKey,
          date: f.deliveryDate,
          items: [],
        });
      }
      groupMap.get(groupKey + f.deliveryDate)!.items.push({
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
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "forecast-complete",
          data: { groups },
        }),
      });
      toast.success("잔디 알림이 발송되었습니다.");
      setStep(4);
    } catch {
      toast.error("알림 발송에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            <span
              className={`text-sm ${step >= s ? "font-medium" : "text-muted-foreground"}`}
            >
              {s === 1
                ? "대상 지정"
                : s === 2
                  ? "수량 산출"
                  : s === 3
                    ? "알림 발송"
                    : "완료"}
            </span>
            {s < 4 && (
              <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* ===== STEP 1 ===== */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>STEP 1. 산출 대상 지정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {targets.map((target, idx) => (
              <div
                key={idx}
                className="flex items-end gap-3 p-3 border rounded-lg"
              >
                <div className="flex-1 space-y-1">
                  <Label>상품</Label>
                  <Select
                    value={String(target.product.id)}
                    onValueChange={(v) => {
                      const p = products.find((p) => p.id === parseInt(v));
                      if (p) updateTarget(idx, "product", p);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.product_name} (D+{p.offset_days})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>출고일</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={target.deliveryDate}
                      onChange={(e) =>
                        updateTarget(idx, "deliveryDate", e.target.value)
                      }
                      className="w-44"
                    />
                    <span className="text-sm font-semibold text-primary whitespace-nowrap min-w-[100px]">
                      {formatDateWithDay(target.deliveryDate)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTarget(idx)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <Button variant="outline" onClick={addTarget}>
              <Plus className="mr-2 h-4 w-4" />
              대상 추가
            </Button>

            <div className="flex justify-end pt-4">
              <Button onClick={startStep2} disabled={targets.length === 0}>
                다음: 수량 산출
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 2 ===== */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              STEP 2. 수량 산출 —{" "}
              {targets[currentTargetIndex]?.product.product_name}
              <span className="ml-3 text-base font-normal text-muted-foreground">
                출고일:{" "}
                <span className="font-semibold text-foreground">
                  {formatDateWithDay(
                    targets[currentTargetIndex]?.deliveryDate
                  )}
                </span>
              </span>
            </h2>
            <Badge>
              {currentTargetIndex + 1} / {targets.length}
            </Badge>
          </div>

          {step2Loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  데이터를 불러오는 중...
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 요약 정보 */}
              {summary && (
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {confirmedQty}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        주문 확정 수량
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {summary.orderedAccountCount} /{" "}
                        {summary.unorderedAccountCount}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        주문 / 미주문 고객사
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {summary.conditionNotMetCount}건 (
                        {summary.conditionNotMetQty}개)
                      </div>
                      <p className="text-xs text-muted-foreground">
                        조건 미충족
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 주문 확정 고객사 — 조건충족 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    주문 확정 — 조건충족 ({conditionMetRows.length}개사)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-auto">
                    <Table containerClassName="overflow-visible">
                      <TableHeader>
                        <TableRow>
                          <TableHead>고객사명</TableHead>
                          <TableHead>채널</TableHead>
                          <TableHead className="text-right">상품수량</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {conditionMetRows.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{row.고객사명}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.주문채널}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {row.상품수량}
                            </TableCell>
                          </TableRow>
                        ))}
                        {conditionMetRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-6">
                              <p className="text-muted-foreground text-sm">
                                조건충족 고객사가 없습니다.
                              </p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* 주문 확정 — 조건불충족 */}
              {conditionNotMetRows.length > 0 && (
                <Card className="border-destructive/30">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-destructive">
                        주문 확정 — 조건불충족 ({conditionNotMetRows.length}
                        개사)
                      </CardTitle>
                      {conditionNotMetDelta !== 0 && (
                        <Badge
                          variant={
                            conditionNotMetDelta > 0
                              ? "default"
                              : "destructive"
                          }
                        >
                          변동: {conditionNotMetDelta > 0 ? "+" : ""}
                          {conditionNotMetDelta}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      수량 조정 시 변동분이 추가 예상에 반영됩니다. (원본
                      상품수량은 확정 수량에 그대로 유지)
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-auto">
                      <Table containerClassName="overflow-visible">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-background z-30 min-w-[120px]">
                              고객사명
                            </TableHead>
                            <TableHead>채널</TableHead>
                            <TableHead className="text-right min-w-[64px]">
                              원본
                              <br />
                              상품수량
                            </TableHead>
                            <TableHead className="text-right min-w-[64px]">
                              전체
                              <br />
                              평균
                            </TableHead>
                            <TableHead className="text-right min-w-[64px]">
                              전체
                              <br />
                              중간값
                            </TableHead>
                            <TableHead className="text-right min-w-[64px]">
                              상품
                              <br />
                              전체평균
                            </TableHead>
                            <TableHead className="text-right min-w-[64px]">
                              상품
                              <br />
                              전체중간
                            </TableHead>
                            <TableHead className="text-right min-w-[64px]">
                              요일
                              <br />
                              평균
                            </TableHead>
                            <TableHead className="text-right min-w-[64px]">
                              요일
                              <br />
                              중간값
                            </TableHead>
                            <TableHead className="text-right min-w-[64px]">
                              상품
                              <br />
                              요일평균
                            </TableHead>
                            <TableHead className="text-right min-w-[64px]">
                              상품
                              <br />
                              요일중간
                            </TableHead>
                            <TableHead className="text-right min-w-[56px]">
                              변동
                            </TableHead>
                            <TableHead className="text-right min-w-[88px] sticky right-0 bg-background z-30">
                              반영 수량
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {conditionNotMetRows.map((row) => {
                            const delta =
                              row.adjusted_qty -
                              (Number(row.상품수량) || 0);
                            return (
                              <TableRow key={row.account_id}>
                                <TableCell className="font-medium sticky left-0 bg-background z-10">
                                  {row.고객사명}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {row.주문채널}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {row.상품수량}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {row.ref_전체_평균}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {row.ref_전체_중간값}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {row.ref_상품_전체_평균}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {row.ref_상품_전체_중간값}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {row.ref_요일별_평균}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {row.ref_요일별_중간값}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums font-semibold">
                                  {row.ref_상품_요일별_평균}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums font-semibold">
                                  {row.ref_상품_요일별_중간값}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {delta !== 0 && (
                                    <span
                                      className={
                                        delta > 0
                                          ? "text-blue-600 font-medium"
                                          : "text-destructive font-medium"
                                      }
                                    >
                                      {delta > 0 ? "+" : ""}
                                      {delta}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right sticky right-0 bg-background z-10">
                                  <Input
                                    type="number"
                                    className="w-20 text-right h-8 text-sm"
                                    value={row.adjusted_qty}
                                    onChange={(e) =>
                                      updateOrderAdjustedQty(
                                        row.account_id,
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    min={0}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 미주문 고객사 — 검색/필터 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      미주문 고객사 ({unorderedRows.length}개사) — 수량 반영
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      표시: {filteredUnorderedRows.length}개사
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="고객사명 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground mr-1">
                        포함:
                      </span>
                      {(
                        [
                          ["all", "전체"],
                          ["included", "포함"],
                          ["excluded", "미포함"],
                        ] as const
                      ).map(([val, label]) => (
                        <Badge
                          key={val}
                          variant={
                            includeFilter === val ? "default" : "outline"
                          }
                          className="cursor-pointer text-xs"
                          onClick={() => setIncludeFilter(val)}
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground mr-1">
                        최근주문:
                      </span>
                      {(
                        [
                          ["all", "전체"],
                          ["has", "있음"],
                          ["none", "없음"],
                        ] as const
                      ).map(([val, label]) => (
                        <Badge
                          key={val}
                          variant={
                            recentOrderFilter === val ? "default" : "outline"
                          }
                          className="cursor-pointer text-xs"
                          onClick={() => setRecentOrderFilter(val)}
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-auto">
                    <Table containerClassName="overflow-visible">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 sticky left-0 bg-background z-30">
                            포함
                          </TableHead>
                          <TableHead className="sticky left-12 bg-background z-30 min-w-[120px]">
                            고객사명
                          </TableHead>
                          <TableHead className="text-center min-w-[52px]">
                            해당
                          </TableHead>
                          <TableHead className="text-right min-w-[64px]">
                            전체
                            <br />
                            평균
                          </TableHead>
                          <TableHead className="text-right min-w-[64px]">
                            전체
                            <br />
                            중간값
                          </TableHead>
                          <TableHead className="text-right min-w-[64px]">
                            상품
                            <br />
                            전체평균
                          </TableHead>
                          <TableHead className="text-right min-w-[64px]">
                            상품
                            <br />
                            전체중간
                          </TableHead>
                          <TableHead className="text-right min-w-[64px]">
                            요일
                            <br />
                            평균
                          </TableHead>
                          <TableHead className="text-right min-w-[64px]">
                            요일
                            <br />
                            중간값
                          </TableHead>
                          <TableHead className="text-right min-w-[64px]">
                            상품
                            <br />
                            요일평균
                          </TableHead>
                          <TableHead className="text-right min-w-[64px]">
                            상품
                            <br />
                            요일중간
                          </TableHead>
                          <TableHead className="text-right min-w-[80px]">
                            최근 주문
                          </TableHead>
                          <TableHead className="text-right min-w-[48px]">
                            주문
                            <br />
                            횟수
                          </TableHead>
                          <TableHead className="text-right min-w-[88px] sticky right-0 bg-background z-30">
                            반영 수량
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUnorderedRows.map((row) => (
                          <TableRow
                            key={row.account_id}
                            className={
                              row.is_included ? "" : "opacity-40"
                            }
                          >
                            <TableCell className="sticky left-0 bg-background z-10">
                              <Checkbox
                                checked={row.is_included}
                                onCheckedChange={() =>
                                  toggleIncluded(row.account_id)
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium sticky left-12 bg-background z-10">
                              {row.고객사명}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  row.주문요일_해당여부 === "포함"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {row.주문요일_해당여부}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {row.전체_평균}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {row.전체_중간값}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {row.상품_전체_평균}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {row.상품_전체_중간값}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {row.요일별_평균}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {row.요일별_중간값}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums font-semibold">
                              {row.상품_요일별_평균}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums font-semibold">
                              {row.상품_요일별_중간값}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {row.해당요일_최근주문일자 || "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {row.해당요일_주문횟수}
                            </TableCell>
                            <TableCell className="text-right sticky right-0 bg-background z-10">
                              <Input
                                type="number"
                                className="w-20 text-right h-8 text-sm"
                                value={row.adjusted_qty}
                                onChange={(e) =>
                                  updateAdjustedQty(
                                    row.account_id,
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                disabled={!row.is_included}
                                min={0}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredUnorderedRows.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={14}
                              className="text-center py-6"
                            >
                              <p className="text-muted-foreground text-sm">
                                {searchQuery ||
                                includeFilter !== "all" ||
                                recentOrderFilter !== "all"
                                  ? "필터 조건에 맞는 고객사가 없습니다."
                                  : "미주문 고객사가 없습니다."}
                              </p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* 합계 및 확정 */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                      <span>
                        주문 확정:{" "}
                        <strong>{confirmedQty}</strong>
                      </span>
                      <span>
                        + 추가 예상:{" "}
                        <strong
                          className={
                            conditionNotMetDelta < 0
                              ? "text-destructive"
                              : ""
                          }
                        >
                          {additionalQty}
                        </strong>
                        {conditionNotMetDelta !== 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (미주문 {unorderedAdditionalQty}
                            {conditionNotMetDelta >= 0 ? " + " : " "}
                            조건불충족{" "}
                            {conditionNotMetDelta > 0 ? "+" : ""}
                            {conditionNotMetDelta})
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5">
                        + 여유분:
                        <Input
                          type="number"
                          className="w-20 h-8 text-right text-sm"
                          value={bufferQty}
                          onChange={(e) =>
                            setBufferQty(parseInt(e.target.value) || 0)
                          }
                          min={0}
                          placeholder="0"
                        />
                      </span>
                      <span className="text-lg">
                        = 최종:{" "}
                        <strong className="text-primary">
                          {totalForecastQty}
                        </strong>
                      </span>
                    </div>
                    {bufferQty > 0 && (
                      <p className="text-xs text-muted-foreground">
                        * 여유분 {bufferQty}개가 최종 수량에 포함됩니다.
                      </p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        onClick={confirmForecast}
                        size="lg"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          "처리 중..."
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            확정
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ===== STEP 3: 알림 발송 ===== */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>STEP 3. 알림 발송</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              모든 상품의 발주 예상 수량이 확정되었습니다. 아래 내용을 확인 후
              잔디 알림을 발송하세요.
            </p>
            <div className="space-y-2">
              {completedForecasts.map((f, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 border rounded"
                >
                  <span className="font-medium">
                    {f.productName} —{" "}
                    <span className="text-muted-foreground">
                      {formatDateWithDay(f.deliveryDate)}
                    </span>
                  </span>
                  <div className="text-right">
                    <span className="font-bold">{f.forecastQty} 개</span>
                    {f.bufferQty > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (여유분 {f.bufferQty} 포함)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={sendNotifications}>
                <Send className="mr-2 h-4 w-4" />
                잔디 알림 발송
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 4: 완료 ===== */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>산출 완료</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              발주 예상 수량 산출 및 알림 발송이 완료되었습니다.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/forecasts")}
              >
                발주 목록 보기
              </Button>
              <Button
                onClick={() => {
                  setStep(1);
                  setTargets([]);
                  setCompletedForecasts([]);
                  setCurrentTargetIndex(0);
                  setBufferQty(0);
                  setIsSubmitting(false);
                }}
              >
                새로운 산출 시작
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
