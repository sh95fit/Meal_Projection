// app/(main)/forecasts/new/_components/SummaryCards.tsx
import { Card, CardContent } from "@/components/ui/card";
import type { ForecastSummary } from "@/types";

interface Props {
  summary: ForecastSummary;
  confirmedQty: number;
}

export function SummaryCards({ summary, confirmedQty }: Props) {
  return (
    <>
      {/* 모바일: 컴팩트 한 줄 */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex-1 border rounded-lg px-2.5 py-2 text-center">
          <div className="text-sm font-bold">{confirmedQty}</div>
          <p className="text-[10px] text-muted-foreground leading-tight">확정 수량</p>
        </div>
        <div className="flex-1 border rounded-lg px-2.5 py-2 text-center">
          <div className="text-sm font-bold">{summary.orderedAccountCount} / {summary.unorderedAccountCount}</div>
          <p className="text-[10px] text-muted-foreground leading-tight">주문 / 미주문</p>
        </div>
        <div className="flex-1 border rounded-lg px-2.5 py-2 text-center">
          <div className="text-sm font-bold">{summary.conditionNotMetCount}건 ({summary.conditionNotMetQty}개)</div>
          <p className="text-[10px] text-muted-foreground leading-tight">조건 미충족</p>
        </div>
      </div>

      {/* 데스크탑: 기존 카드 배치 */}
      <div className="hidden lg:grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{confirmedQty}</div>
            <p className="text-xs text-muted-foreground">주문 확정 수량</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {summary.orderedAccountCount} / {summary.unorderedAccountCount}
            </div>
            <p className="text-xs text-muted-foreground">주문 / 미주문 고객사</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {summary.conditionNotMetCount}건 ({summary.conditionNotMetQty}개)
            </div>
            <p className="text-xs text-muted-foreground">조건 미충족</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
