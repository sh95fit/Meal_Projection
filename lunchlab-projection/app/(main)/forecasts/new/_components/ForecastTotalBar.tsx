import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";

interface Props {
  confirmedQty: number;
  additionalQty: number;
  unorderedAdditionalQty: number;
  conditionNotMetDelta: number;
  bufferInput: string;
  bufferQty: number;
  totalForecastQty: number;
  isSubmitting: boolean;
  onBufferInputChange: (v: string) => void;
  onBufferInputBlur: () => void;
  onConfirm: () => void;
}

export function ForecastTotalBar({
  confirmedQty, additionalQty, unorderedAdditionalQty, conditionNotMetDelta,
  bufferInput, bufferQty, totalForecastQty, isSubmitting,
  onBufferInputChange, onBufferInputBlur, onConfirm,
}: Props) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span>
              주문 확정: <strong>{confirmedQty}</strong>
            </span>
            <span>
              + 추가 예상:{" "}
              <strong className={conditionNotMetDelta < 0 ? "text-destructive" : ""}>
                {additionalQty}
              </strong>
              {conditionNotMetDelta !== 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  (미주문 {unorderedAdditionalQty}
                  {conditionNotMetDelta >= 0 ? " + " : " "}
                  조건불충족 {conditionNotMetDelta > 0 ? "+" : ""}
                  {conditionNotMetDelta})
                </span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              + 조정 수량:
              <Input
                type="text"
                inputMode="numeric"
                className="w-24 h-8 text-right text-sm"
                value={bufferInput}
                onChange={(e) => onBufferInputChange(e.target.value)}
                onBlur={onBufferInputBlur}
                placeholder="0"
              />
            </span>
            <span className="text-lg">
              = 최종: <strong className="text-primary">{totalForecastQty}</strong>
            </span>
          </div>
          {bufferQty !== 0 && (
            <p className="text-xs text-muted-foreground">
              * 조정 수량 {bufferQty > 0 ? `+${bufferQty}` : bufferQty}개가 최종 수량에 반영됩니다.
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={onConfirm} size="lg" disabled={isSubmitting}>
              {isSubmitting ? "처리 중..." : (<><Check className="mr-2 h-4 w-4" />확정</>)}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
