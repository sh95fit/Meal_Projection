// app/(main)/forecasts/new/_components/StepComplete.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  onReset: () => void;
}

export function StepComplete({ onReset }: Props) {
  return (
    <Card>
      <CardHeader className="px-4 lg:px-6">
        <CardTitle className="text-base lg:text-lg">산출 완료</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 lg:px-6">
        <p className="text-sm text-muted-foreground">발주 예상 수량 산출 및 알림 발송이 완료되었습니다.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => (window.location.href = "/forecasts")}>
            발주 목록 보기
          </Button>
          <Button className="w-full sm:w-auto" onClick={onReset}>새 산출 시작</Button>
        </div>
      </CardContent>
    </Card>
  );
}
