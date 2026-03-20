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
      <CardHeader>
        <CardTitle>STEP 1. 산출 대상 지정</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {targets.map((target, idx) => (
          <div key={idx} className="flex items-end gap-3 p-3 border rounded-lg">
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
                {/* {target.product.saturday_available && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    토 판매
                  </span>
                )} */}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onRemoveTarget(idx)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}

        <Button variant="outline" onClick={onAddTarget}>
          <Plus className="mr-2 h-4 w-4" />대상 추가
        </Button>

        <div className="flex justify-end pt-4">
          <Button onClick={onNext} disabled={targets.length === 0}>
            다음: 수량 산출<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}