// app/(main)/forecasts/new/_components/ForecastTotalBar.tsx
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
      <CardContent className="pt-4 lg:pt-6">
        <div className="space-y-3">
          {/* 데스크탑: 기존 가로 배치 */}
          <div className="hidden lg:flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
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

          {/* 모바일: 세로 배치 */}
          <div className="lg:hidden space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">주문 확정</span>
              <strong>{confirmedQty}</strong>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-muted-foreground">+ 추가 예상</span>
                {conditionNotMetDelta !== 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    미주문 {unorderedAdditionalQty}
                    {conditionNotMetDelta >= 0 ? " + " : " "}
                    조건불충족 {conditionNotMetDelta > 0 ? "+" : ""}{conditionNotMetDelta}
                  </p>
                )}
              </div>
              <strong className={conditionNotMetDelta < 0 ? "text-destructive" : ""}>
                {additionalQty}
              </strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">+ 조정 수량</span>
              <Input
                type="text"
                inputMode="numeric"
                className="w-20 h-8 text-right text-sm"
                value={bufferInput}
                onChange={(e) => onBufferInputChange(e.target.value)}
                onBlur={onBufferInputBlur}
                placeholder="0"
              />
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold">= 최종</span>
              <strong className="text-lg text-primary">{totalForecastQty}</strong>
            </div>
          </div>

          {bufferQty !== 0 && (
            <p className="text-xs text-muted-foreground">
              * 조정 수량 {bufferQty > 0 ? `+${bufferQty}` : bufferQty}개가 최종 수량에 반영됩니다.
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={onConfirm} size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? "처리 중..." : (<><Check className="mr-2 h-4 w-4" />확정</>)}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
