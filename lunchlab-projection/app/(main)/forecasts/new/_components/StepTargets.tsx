// app/(main)/forecasts/new/_components/StepTargets.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { formatDateWithDay } from "@/lib/utils";
import type { ProductWithMappings, ForecastTarget } from "@/types";

interface Props {
  targets: ForecastTarget[];
  products: ProductWithMappings[];
  onAddTarget: () => void;
  onUpdateTarget: (index: number, field: "product" | "deliveryDate", value: unknown) => void;
  onRemoveTarget: (index: number) => void;
  onNext: () => void;
}

export function StepTargets({ targets, products, onAddTarget, onUpdateTarget, onRemoveTarget, onNext }: Props) {
  return (
    <Card>
      <CardHeader className="px-4 lg:px-6">
        <CardTitle className="text-base lg:text-lg">STEP 1. 산출 대상 지정</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 lg:px-6">
        {targets.map((target, idx) => (
          <div key={idx} className="p-3 border rounded-lg space-y-3 lg:space-y-0">
            {/* 데스크탑: 기존 가로 배치 */}
            <div className="hidden lg:flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label>상품</Label>
                <Select
                  value={String(target.product.id)}
                  onValueChange={(v) => {
                    const p = products.find((p) => p.id === parseInt(v));
                    if (p) onUpdateTarget(idx, "product", p);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.product_name} (D+{p.offset_days}{p.saturday_available ? ", 토 포함" : ""})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>출고일 (영업일 기준)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={target.deliveryDate}
                    onChange={(e) => onUpdateTarget(idx, "deliveryDate", e.target.value)}
                    className="w-44"
                  />
                  <span className="text-sm font-semibold text-primary whitespace-nowrap min-w-[100px]">
                    {formatDateWithDay(target.deliveryDate)}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onRemoveTarget(idx)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            {/* 모바일: 세로 배치 */}
            <div className="lg:hidden space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">상품</Label>
                  <Select
                    value={String(target.product.id)}
                    onValueChange={(v) => {
                      const p = products.find((p) => p.id === parseInt(v));
                      if (p) onUpdateTarget(idx, "product", p);
                    }}
                  >
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.product_name} (D+{p.offset_days}{p.saturday_available ? ", 토 포함" : ""})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0 mt-5" onClick={() => onRemoveTarget(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">출고일 (영업일 기준)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={target.deliveryDate}
                    onChange={(e) => onUpdateTarget(idx, "deliveryDate", e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-sm font-semibold text-primary whitespace-nowrap">
                    {formatDateWithDay(target.deliveryDate)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        <Button variant="outline" onClick={onAddTarget} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />대상 추가
        </Button>

        <div className="flex justify-end pt-4">
          <Button onClick={onNext} disabled={targets.length === 0} className="w-full sm:w-auto">
            다음: 수량 산출<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
