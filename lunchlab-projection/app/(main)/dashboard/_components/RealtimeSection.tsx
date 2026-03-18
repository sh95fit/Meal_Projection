// app/(main)/dashboard/_components/RealtimeSection.tsx (전체 교체)
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
  /** 현재 조회 중인 날짜 */
  currentDate: string;
  /** 날짜 변경 콜백 */
  onDateChange: (date: string) => void;
}

/**
 * 이전/다음 영업일을 계산합니다.
 * direction: -1 (이전), +1 (다음)
 */
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

  // ── 마감 카운트다운 ──
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

  const handlePrevDay = () => {
    onDateChange(findAdjacentBusinessDay(currentDate, -1));
  };

  const handleNextDay = () => {
    onDateChange(findAdjacentBusinessDay(currentDate, 1));
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateChange(e.target.value);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">실시간 주문 현황</CardTitle>

          {/* ── 날짜 선택 UI ── */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="px-2 h-8"
              onClick={handlePrevDay}
              title="이전 영업일"
            >
              ◀
            </Button>

            <input
              type="date"
              className="border rounded px-2 py-1 text-sm h-8 w-[150px]"
              value={currentDate}
              onChange={handleDateInput}
            />

            <Button
              variant="ghost"
              size="sm"
              className="px-2 h-8"
              onClick={handleNextDay}
              title="다음 영업일"
            >
              ▶
            </Button>

            <span className="text-sm text-muted-foreground ml-1">
              {formatDateWithDay(currentDate)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data && (
            <>
              <Badge variant={data.appOrdersMerged ? "secondary" : "default"}>
                {data.appOrdersMerged ? "🔄 앱 주문 합산 중" : "✅ 앱 주문 이관 완료"}
              </Badge>
              <Badge variant="outline">
                {loading ? "갱신 중..." : cutoffText}
              </Badge>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading && !data ? (
          <p className="text-center text-muted-foreground py-8 animate-pulse">
            데이터를 불러오는 중...
          </p>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.products.map((product) => (
              <ProductProgressCard key={product.productId} product={product} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
