"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ForecastTable } from "./_components/ForecastTable";
import { EditDialog } from "./_components/EditDialog";
import { ActualDialog } from "./_components/ActualDialog";
import { AdjustDialog } from "./_components/AdjustDialog";
import { useForecastList } from "./_hooks/useForecastList";

export default function ForecastListPage() {
  const h = useForecastList();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">발주 예상 수량 목록</h1>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>출고일 (시작)</Label>
              <Input type="date" value={h.dateFrom} onChange={(e) => h.setDateFrom(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label>출고일 (종료)</Label>
              <Input type="date" value={h.dateTo} onChange={(e) => h.setDateTo(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label>상품</Label>
              <div className="flex gap-2">
                {h.products.map((p) => (
                  <Badge
                    key={p.id}
                    variant={h.selectedProductIds.includes(p.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => h.toggleProductFilter(p.id)}
                  >{p.product_name}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 목록 */}
      <Card>
        <CardHeader><CardTitle>산출 결과</CardTitle></CardHeader>
        <CardContent>
          {h.loading ? (
            <p className="text-center py-8 text-muted-foreground">불러오는 중...</p>
          ) : (
            <ForecastTable
              forecasts={h.forecasts}
              onEdit={h.openEditDialog}
              onActual={h.openActualDialog}
              onAdjust={h.openAdjustDialog}
            />
          )}
        </CardContent>
      </Card>

      {/* 다이얼로그 */}
      <EditDialog
        open={h.editDialog} onOpenChange={h.setEditDialog}
        target={h.editTarget} qty={h.editQty} onQtyChange={h.setEditQty}
        onSubmit={h.handleEdit}
      />
      <ActualDialog
        open={h.actualDialog} onOpenChange={h.setActualDialog}
        target={h.actualTarget} qty={h.actualQty} onQtyChange={h.setActualQty}
        onSubmit={h.handleActual}
      />
      <AdjustDialog
        open={h.adjustDialog} onOpenChange={h.setAdjustDialog}
        target={h.adjustTarget} qty={h.adjustQty} onQtyChange={h.setAdjustQty}
        reason={h.adjustReason} onReasonChange={h.setAdjustReason}
        onSubmit={h.handleAdjust}
      />
    </div>
  );
}
