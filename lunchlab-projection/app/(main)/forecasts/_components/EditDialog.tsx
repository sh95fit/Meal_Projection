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

export function EditDialog({ open, onOpenChange, target, qty, onQtyChange, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>예상 수량 수정</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {target?.product_name} — {formatDateWithDay(target?.delivery_date ?? "")}
          </p>
          <div className="space-y-2">
            <Label>수정 수량</Label>
            <Input type="number" value={qty} onChange={(e) => onQtyChange(parseInt(e.target.value) || 0)} min={0} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSubmit}>수정 및 알림 발송</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
