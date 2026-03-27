// app/(main)/dashboard/_components/RealtimeSection.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductProgressCard } from "./ProductProgressCard";
import { formatDateWithDay, addDays, isBusinessDay } from "@/lib/utils/date";
import type { RealtimeResponse } from "@/types/dashboard";

interface Props {
  data: RealtimeResponse | null;
  loading: boolean;
  currentDate: string;
  onDateChange: (date: string) => void;
}

function findAdjacentBusinessDay(dateStr: string, direction: -1 | 1): string {
  let candidate = addDays(dateStr, direction);
  for (let i = 0; i < 14; i++) {
    if (isBusinessDay(candidate)) return candidate;
    candidate = addDays(candidate, direction);
  }
  return candidate;
}

export function RealtimeSection({ data, loading, currentDate, onDateChange }: Props) {
  if (!data && !loading) return null;

  const cutoffText = (() => {
    if (!data) return "";
    if (data.minutesUntilCutoff <= 0) return "마감 완료";
    const hours = Math.floor(data.minutesUntilCutoff / 60);
    const mins = data.minutesUntilCutoff % 60;
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `마감까지 ${days}일 ${hours % 24}시간`;
    }
    return `마감까지 ${hours}시간 ${mins}분`;
  })();

  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        {/* 첫 번째 줄: 타이틀 + 상태 뱃지 */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base lg:text-lg">실시간 주문 현황</CardTitle>
          <div className="flex items-center gap-2">
            {data && (
              <>
                <Badge variant={data.appOrdersMerged ? "secondary" : "default"} className="text-[10px] lg:text-xs">
                  {data.appOrdersMerged ? "🔄 앱 주문 합산 중" : "✅ 앱 주문 이관 완료"}
                </Badge>
                <Badge variant="outline" className="text-[10px] lg:text-xs">
                  {loading ? "갱신 중..." : cutoffText}
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* 두 번째 줄: 날짜 네비게이션 */}
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="px-2 h-8"
            onClick={() => onDateChange(findAdjacentBusinessDay(currentDate, -1))}
          >
            ◀
          </Button>
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm h-8 w-[140px] lg:w-[150px]"
            value={currentDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
          <Button
            variant="ghost"
            size="sm"
            className="px-2 h-8"
            onClick={() => onDateChange(findAdjacentBusinessDay(currentDate, 1))}
          >
            ▶
          </Button>
          <span className="text-xs lg:text-sm text-muted-foreground ml-1">
            {formatDateWithDay(currentDate)}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {loading && !data ? (
          <p className="text-center text-muted-foreground py-8 animate-pulse">
            데이터를 불러오는 중...
          </p>
        ) : data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {data.products.map((product) => (
              <ProductProgressCard key={product.productId} product={product} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
