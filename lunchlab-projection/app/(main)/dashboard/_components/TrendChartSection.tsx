// app/(main)/dashboard/_components/TrendChartSection.tsx (전체 교체)
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import type { TrendResponse } from "@/types/dashboard";

interface Props {
  data: TrendResponse | null;
  /** 바 클릭 시 해당 날짜(YYYY-MM-DD)를 부모에 전달 */
  onBarClick?: (date: string) => void;
  /** 현재 드릴다운 중인 날짜 (하이라이트 표시용) */
  activeDate?: string | null;
}

export function TrendChartSection({ data, onBarClick, activeDate }: Props) {
  if (!data || data.rows.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">② 추이 차트</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm">데이터가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  /**
   * Recharts의 Bar onClick 이벤트에서 해당 행의 date를 추출하여 콜백 호출.
   * Recharts Bar onClick 시그니처: (data, index) => void
   * data.payload에 원래 TrendRow가 들어있습니다.
   */
  const handleBarClick = (data: Record<string, unknown>) => {
    if (!onBarClick) return;
    const payload = data?.payload as Record<string, unknown> | undefined;
    if (payload?.date) {
      onBarClick(String(payload.date));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">② 추이 차트</CardTitle>
          {onBarClick && (
            <p className="text-xs text-muted-foreground">
              막대를 클릭하면 해당 일자의 상세 드릴다운을 확인할 수 있습니다.
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={data.rows}
            style={{ cursor: onBarClick ? "pointer" : "default" }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            {data.productList.map((product) => (
              <Bar
                key={product.productId}
                dataKey={product.productName}
                stackId="stack"
                fill={product.color}
                name={product.productName}
                onClick={handleBarClick}
              >
                {/* 활성 날짜 하이라이트 */}
                {data.rows.map((row, idx) => (
                  <Cell
                    key={idx}
                    fillOpacity={activeDate && row.date === activeDate ? 1 : 0.85}
                    stroke={activeDate && row.date === activeDate ? "#1e40af" : "none"}
                    strokeWidth={activeDate && row.date === activeDate ? 2 : 0}
                  />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
