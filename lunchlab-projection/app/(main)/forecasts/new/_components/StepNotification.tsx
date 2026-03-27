// app/(main)/forecasts/new/_components/StepNotification.tsx
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
      <CardHeader className="px-4 lg:px-6">
        <CardTitle className="text-base lg:text-lg">STEP 3. 알림 발송</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 lg:px-6">
        <p className="text-sm text-muted-foreground">
          모든 상품의 발주 예상 수량이 확정되었습니다. 아래 내용을 확인 후 잔디 알림을 발송하세요.
        </p>
        <div className="space-y-2">
          {completedForecasts.map((f, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 border rounded">
              <div>
                <span className="font-medium text-sm lg:text-base">{f.productName}</span>
                <span className="text-xs lg:text-sm text-muted-foreground ml-1.5">
                  {formatDateWithDay(f.deliveryDate)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-bold text-sm lg:text-base">{f.forecastQty} 개</span>
                {f.bufferQty !== 0 && (
                  <span className="text-[10px] lg:text-xs text-muted-foreground">
                    (조정 {f.bufferQty > 0 ? `+${f.bufferQty}` : f.bufferQty})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={onSend} className="w-full sm:w-auto">
            <Send className="mr-2 h-4 w-4" />잔디 알림 발송
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
