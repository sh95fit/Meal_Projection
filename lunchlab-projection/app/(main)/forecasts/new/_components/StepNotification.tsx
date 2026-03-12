import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send } from "lucide-react";
import { formatDateWithDay } from "@/lib/utils";
import type { CompletedForecast } from "@/types";

interface Props {
  completedForecasts: CompletedForecast[];
  onSend: () => void;
}

export function StepNotification({ completedForecasts, onSend }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>STEP 3. 알림 발송</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          모든 상품의 발주 예상 수량이 확정되었습니다. 아래 내용을 확인 후 잔디 알림을 발송하세요.
        </p>
        <div className="space-y-2">
          {completedForecasts.map((f, idx) => (
            <div key={idx} className="flex justify-between items-center p-3 border rounded">
              <span className="font-medium">
                {f.productName} — <span className="text-muted-foreground">{formatDateWithDay(f.deliveryDate)}</span>
              </span>
              <div className="text-right">
                <span className="font-bold">{f.forecastQty} 개</span>
                {f.bufferQty !== 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (조정 {f.bufferQty > 0 ? `+${f.bufferQty}` : f.bufferQty} 반영)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={onSend}>
            <Send className="mr-2 h-4 w-4" />잔디 알림 발송
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
