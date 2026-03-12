import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDateWithDay } from "@/lib/utils";
import type { OrderForecast } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: OrderForecast | null;
  qty: number;
  onQtyChange: (v: number) => void;
  onSubmit: () => void;
}

export function ActualDialog({ open, onOpenChange, target, qty, onQtyChange, onSubmit }: Props) {
  const errorRate = target && target.forecast_qty > 0
    ? (((qty - target.forecast_qty) / target.forecast_qty) * 100).toFixed(1)
    : "0";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>확정 수량 기입</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {target?.product_name} — {formatDateWithDay(target?.delivery_date ?? "")}
          </p>
          <p className="text-sm">예상 수량: <strong>{target?.forecast_qty}</strong></p>
          <div className="space-y-2">
            <Label>확정 수량</Label>
            <Input type="number" value={qty} onChange={(e) => onQtyChange(parseInt(e.target.value) || 0)} min={0} />
          </div>
          {target && <p className="text-sm">오차율: <strong>{errorRate}%</strong></p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSubmit}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
