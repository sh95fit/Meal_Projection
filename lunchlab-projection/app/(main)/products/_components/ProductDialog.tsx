import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import type { ProductWithMappings } from "@/types";
import type { MappingInput } from "../_hooks/useProducts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingProduct: ProductWithMappings | null;
  productName: string;
  onProductNameChange: (v: string) => void;
  offsetDays: number;
  onOffsetDaysChange: (v: number) => void;
  notificationGroup: string;
  onNotificationGroupChange: (v: string) => void;
  mappings: MappingInput[];
  onAddMapping: () => void;
  onRemoveMapping: (i: number) => void;
  onUpdateMapping: (i: number, field: keyof MappingInput, value: string) => void;
  onSubmit: () => void;
}

export function ProductDialog({
  open, onOpenChange, editingProduct,
  productName, onProductNameChange, offsetDays, onOffsetDaysChange,
  notificationGroup, onNotificationGroupChange,
  mappings, onAddMapping, onRemoveMapping, onUpdateMapping, onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingProduct ? "상품 수정" : "상품 등록"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>상품명</Label>
            <Input value={productName} onChange={(e) => onProductNameChange(e.target.value)} placeholder="예: 가정식 도시락" />
          </div>
          <div className="space-y-2">
            <Label>산출기준일 (D+N)</Label>
            <Input type="number" value={offsetDays} onChange={(e) => onOffsetDaysChange(parseInt(e.target.value) || 0)} min={1} />
            <p className="text-xs text-muted-foreground">산출일 기준 N일 후가 출고일이 됩니다</p>
          </div>
          <div className="space-y-2">
            <Label>알림 그룹 (선택)</Label>
            <Input value={notificationGroup} onChange={(e) => onNotificationGroupChange(e.target.value)} placeholder="예: 가정식" />
            <p className="text-xs text-muted-foreground">같은 그룹의 상품은 하나의 알림으로 합산 발송됩니다</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>상품 ID 매핑</Label>
              <p className="text-xs text-muted-foreground">비즈옵스팀에 문의해주세요 (수정 금지)</p>
              <Button variant="outline" size="sm" onClick={onAddMapping}><Plus className="mr-1 h-3 w-3" />추가</Button>
            </div>
            {mappings.map((m, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={m.channel} onValueChange={(v) => onUpdateMapping(idx, "channel", v)}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web">웹</SelectItem>
                    <SelectItem value="app">앱</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={m.external_id} onChange={(e) => onUpdateMapping(idx, "external_id", e.target.value)} placeholder="상품 ID" className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => onRemoveMapping(idx)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            {mappings.length === 0 && <p className="text-xs text-muted-foreground">매핑을 추가하세요</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSubmit}>{editingProduct ? "수정" : "등록"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
