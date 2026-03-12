import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDateWithDay } from "@/lib/utils";
import type { OrderForecast } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: OrderForecast | null;
  qty: number;
  onQtyChange: (v: number) => void;
  reason: string;
  onReasonChange: (v: string) => void;
  onSubmit: () => void;
}

export function AdjustDialog({ open, onOpenChange, target, qty, onQtyChange, reason, onReasonChange, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>수량 조정</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {target?.product_name} — {formatDateWithDay(target?.delivery_date ?? "")}
          </p>
          <p className="text-sm">현재 예상 수량: <strong>{target?.forecast_qty}</strong></p>
          <div className="space-y-2">
            <Label>변경 수량</Label>
            <Input type="number" value={qty} onChange={(e) => onQtyChange(parseInt(e.target.value) || 0)} min={0} />
          </div>
          <div className="space-y-2">
            <Label>사유</Label>
            <Textarea value={reason} onChange={(e) => onReasonChange(e.target.value)} placeholder="예: 조기 품절" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSubmit}>조정 및 알림 발송</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
