"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, ClipboardCheck, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateWithDay } from "@/lib/utils";
import type { OrderForecast, ProductWithMappings } from "@/types";

export default function ForecastListPage() {
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

  // 확정 수량 다이얼로그
  const [actualDialog, setActualDialog] = useState(false);
  const [actualTarget, setActualTarget] = useState<OrderForecast | null>(null);
  const [actualQty, setActualQty] = useState(0);

  // 조정 다이얼로그
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<OrderForecast | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => {});
  }, []);

  const fetchForecasts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (selectedProductIds.length > 0)
      params.set("productIds", selectedProductIds.join(","));

    try {
      const res = await fetch(`/api/forecasts?${params.toString()}`);
      const data = await res.json();
      setForecasts(data);
    } catch {
      toast.error("목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedProductIds]);

  useEffect(() => {
    fetchForecasts();
  }, [fetchForecasts]);

  // 예상 수량 수정
  const openEditDialog = (forecast: OrderForecast) => {
    setEditTarget(forecast);
    setEditQty(forecast.forecast_qty);
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
          data: {
            date: editTarget.delivery_date,
            productName: editTarget.product_name,
            previousQty,
            newQty: editQty,
          },
        }),
      });

      toast.success("수량이 수정되었습니다.");
      setEditDialog(false);
      fetchForecasts();
    } catch {
      toast.error("수정에 실패했습니다.");
    }
  };

  // 확정 수량 기입
  const openActualDialog = (forecast: OrderForecast) => {
    setActualTarget(forecast);
    setActualQty(forecast.actual_qty || forecast.forecast_qty);
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
    } catch {
      toast.error("기입에 실패했습니다.");
    }
  };

  // 수량 조정
  const openAdjustDialog = (forecast: OrderForecast) => {
    setAdjustTarget(forecast);
    setAdjustQty(forecast.forecast_qty);
    setAdjustReason("");
    setAdjustDialog(true);
  };

  const handleAdjust = async () => {
    if (!adjustTarget) return;

    try {
      const res = await fetch(`/api/forecasts/${adjustTarget.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_qty: adjustQty,
          reason: adjustReason,
        }),
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
    } catch {
      toast.error("조정에 실패했습니다.");
    }
  };

  const toggleProductFilter = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">발주 예상 수량 목록</h1>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>출고일 (시작)</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label>출고일 (종료)</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label>상품</Label>
              <div className="flex gap-2">
                {products.map((p) => (
                  <Badge
                    key={p.id}
                    variant={
                      selectedProductIds.includes(p.id)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => toggleProductFilter(p.id)}
                  >
                    {p.product_name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>산출 결과</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">
              불러오는 중...
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>출고일</TableHead>
                  <TableHead>상품</TableHead>
                  <TableHead className="text-right">주문확정</TableHead>
                  <TableHead className="text-right">추가예상</TableHead>
                  <TableHead className="text-right">조정 수량</TableHead>
                  <TableHead className="text-right">예상수량</TableHead>
                  <TableHead className="text-right">확정수량</TableHead>
                  <TableHead className="text-right">오차율</TableHead>
                  <TableHead className="w-32">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecasts.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      {formatDateWithDay(f.delivery_date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {f.product_name}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.confirmed_order_qty}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.additional_forecast_qty}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.buffer_qty != null && f.buffer_qty !== 0 ? (
                        <Badge
                          variant={f.buffer_qty > 0 ? "outline" : "destructive"}
                          className="text-xs"
                        >
                          {f.buffer_qty > 0 ? `+${f.buffer_qty}` : f.buffer_qty}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {f.forecast_qty}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.actual_qty != null ? f.actual_qty : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.error_rate != null ? (
                        <Badge
                          variant={
                            Math.abs(f.error_rate) <= 5
                              ? "default"
                              : "destructive"
                          }
                        >
                          {f.error_rate > 0 ? "+" : ""}
                          {f.error_rate}%
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(f)}
                          title="수량 수정"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openActualDialog(f)}
                          title="확정 수량"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAdjustDialog(f)}
                          title="수량 조정"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {forecasts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <p className="text-muted-foreground">
                        산출된 결과가 없습니다
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 수정 다이얼로그 */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>예상 수량 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {editTarget?.product_name} —{" "}
              {formatDateWithDay(editTarget?.delivery_date ?? "")}
            </p>
            <div className="space-y-2">
              <Label>수정 수량</Label>
              <Input
                type="number"
                value={editQty}
                onChange={(e) => setEditQty(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              취소
            </Button>
            <Button onClick={handleEdit}>수정 및 알림 발송</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 확정 수량 다이얼로그 */}
      <Dialog open={actualDialog} onOpenChange={setActualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>확정 수량 기입</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {actualTarget?.product_name} —{" "}
              {formatDateWithDay(actualTarget?.delivery_date ?? "")}
            </p>
            <p className="text-sm">
              예상 수량: <strong>{actualTarget?.forecast_qty}</strong>
            </p>
            <div className="space-y-2">
              <Label>확정 수량</Label>
              <Input
                type="number"
                value={actualQty}
                onChange={(e) => setActualQty(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
            {actualTarget && (
              <p className="text-sm">
                오차율:{" "}
                <strong>
                  {actualTarget.forecast_qty > 0
                    ? (
                        ((actualQty - actualTarget.forecast_qty) /
                          actualTarget.forecast_qty) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActualDialog(false)}
            >
              취소
            </Button>
            <Button onClick={handleActual}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 조정 다이얼로그 */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>수량 조정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {adjustTarget?.product_name} —{" "}
              {formatDateWithDay(adjustTarget?.delivery_date ?? "")}
            </p>
            <p className="text-sm">
              현재 예상 수량: <strong>{adjustTarget?.forecast_qty}</strong>
            </p>
            <div className="space-y-2">
              <Label>변경 수량</Label>
              <Input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>사유</Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="예: 조기 품절"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdjustDialog(false)}
            >
              취소
            </Button>
            <Button onClick={handleAdjust}>조정 및 알림 발송</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
