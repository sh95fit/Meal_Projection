// app/(main)/dashboard/_components/ProductProgressCard.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RealtimeProduct } from "@/types/dashboard";

interface Props {
  product: RealtimeProduct;
}

export function ProductProgressCard({ product }: Props) {
  const { productName, todayQty, forecastQty, progress, diff } = product;

  const diffColor = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400";
  const diffIcon = diff > 0 ? "▲" : diff < 0 ? "▼" : "─";
  const diffText = `${diffIcon} ${Math.abs(diff)}`;

  const barColor =
    progress >= 100 ? "bg-green-500" :
    progress >= 70  ? "bg-blue-500" :
    progress >= 40  ? "bg-yellow-500" :
                      "bg-red-400";

  const hasForecast = forecastQty > 0;

  return (
    <Card className="bg-gray-50">
      <CardContent className="pt-3 pb-3 lg:pt-4">
        <div className="flex items-center justify-between mb-1.5 lg:mb-2">
          <span className="font-medium text-xs lg:text-sm">{productName}</span>
          <span className={`text-[10px] lg:text-xs font-semibold ${diffColor}`}>
            지난주 대비 {diffText}
          </span>
        </div>

        <div className="flex items-baseline gap-1 mb-1.5 lg:mb-2">
          <span className="text-xl lg:text-2xl font-bold">{todayQty}</span>
          <span className="text-gray-400 text-xs lg:text-sm">
            / {hasForecast ? forecastQty : '-'}
          </span>
          {hasForecast ? (
            <Badge variant="outline" className="ml-auto text-[10px] lg:text-xs">
              {progress}%
            </Badge>
          ) : (
            <Badge variant="destructive" className="ml-auto text-[10px]">
              예측 없음
            </Badge>
          )}
        </div>

        <div className="w-full bg-gray-200 rounded-full h-1.5 lg:h-2">
          <div
            className={`h-1.5 lg:h-2 rounded-full transition-all ${hasForecast ? barColor : 'bg-gray-300'}`}
            style={{ width: `${hasForecast ? Math.min(progress, 100) : 0}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}