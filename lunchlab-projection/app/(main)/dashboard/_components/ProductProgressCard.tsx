// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/_components/ProductProgressCard.tsx
// 상품별 진행 카드 — 프로그레스 바, 수량, 전일 대비 증감
// ──────────────────────────────────────────────────────────────────
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RealtimeProduct } from "@/types/dashboard";

interface Props {
  product: RealtimeProduct;
}

export function ProductProgressCard({ product }: Props) {
  const { productName, todayQty, forecastQty, progress, diff } = product;

  // ── 전일 대비 증감 표시 ──
  // diff > 0 → 초록색 ↑, diff < 0 → 빨간색 ↓, diff === 0 → 회색 ─
  const diffColor = diff > 0 ? "text-green-500" : diff < 0 ? "text-red-500" : "text-gray-400";
  const diffIcon = diff > 0 ? "↑" : diff < 0 ? "↓" : "─";
  const diffText = `${diffIcon}${Math.abs(diff)}`;

  // ── 프로그레스 바 색상 (진행률에 따라) ──
  const barColor =
    progress >= 100 ? "bg-green-500" :
    progress >= 70  ? "bg-blue-500" :
    progress >= 40  ? "bg-yellow-500" :
                        "bg-red-400";

  return (
    <Card className="bg-gray-50">
      <CardContent className="pt-4">
        {/* 상품명 & 전일 대비 */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-sm">{productName}</span>
          <span className={`text-xs font-semibold ${diffColor}`}>
            전일 대비 {diffText}
          </span>
        </div>

        {/* 수량 표시 */}
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-2xl font-bold">{todayQty}</span>
          <span className="text-gray-400 text-sm">/ {forecastQty}</span>
          <Badge variant="outline" className="ml-auto text-xs">
            {progress}%
          </Badge>
        </div>

        {/* 프로그레스 바 */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}