import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  onReset: () => void;
}

export function StepComplete({ onReset }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>산출 완료</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">발주 예상 수량 산출 및 알림 발송이 완료되었습니다.</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => (window.location.href = "/forecasts")}>
            발주 목록 보기
          </Button>
          <Button onClick={onReset}>새 산출 시작</Button>
        </div>
      </CardContent>
    </Card>
  );
}
