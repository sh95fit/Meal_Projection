import { Card, CardContent } from "@/components/ui/card";
import type { ForecastSummary } from "@/types";

interface Props {
  summary: ForecastSummary;
  confirmedQty: number;
}

export function SummaryCards({ summary, confirmedQty }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
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
  );
}
