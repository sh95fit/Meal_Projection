// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/_components/RealtimeSection.tsx
// 실시간 현황 섹션 — 요약 배지 + 마감 카운트다운 + 상품별 진행 카드
// ──────────────────────────────────────────────────────────────────
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductProgressCard } from "./ProductProgressCard";
import type { RealtimeResponse } from "@/types/dashboard";

interface Props {
  data: RealtimeResponse | null;
  loading: boolean;
}

export function RealtimeSection({ data, loading }: Props) {
  if (!data) return null;

  // ── 마감 카운트다운 텍스트 ──
  // minutesUntilCutoff > 0 이면 아직 14:30 전
  // <= 0 이면 이미 마감 지남
  const cutoffText =
    data.minutesUntilCutoff > 0
      ? `마감까지 ${Math.floor(data.minutesUntilCutoff / 60)}시간 ${data.minutesUntilCutoff % 60}분`
      : "마감 완료";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">① 실시간 현황</CardTitle>
        <div className="flex items-center gap-2">
          {/* 앱 주문 합산 상태 배지 */}
          {/* appOrdersMerged=true : 이관 전 → 앱 데이터 별도 합산 중 */}
          {/* appOrdersMerged=false: 이관 완료 → orders만 사용 */}
          <Badge variant={data.appOrdersMerged ? "secondary" : "default"}>
            {data.appOrdersMerged ? "🔄 앱 주문 합산 중" : "✅ 앱 주문 이관 완료"}
          </Badge>
          {/* 마감 카운트다운 */}
          <Badge variant="outline">
            {loading ? "갱신 중..." : cutoffText}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.products.map((product) => (
            <ProductProgressCard key={product.productId} product={product} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}