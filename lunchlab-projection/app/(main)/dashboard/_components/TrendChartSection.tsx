// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/_components/TrendChartSection.tsx
// 추이 차트 — Recharts 스택 바 차트
// ──────────────────────────────────────────────────────────────────
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { TrendResponse } from "@/types/dashboard";

interface Props {
  data: TrendResponse | null;
}

export function TrendChartSection({ data }: Props) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">② 추이 차트</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data.rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            {/* 상품별 스택 바 — productList 순서대로 쌓기 */}
            {data.productList.map((product) => (
              <Bar
                key={product.productId}
                dataKey={product.productName}
                stackId="stack"
                fill={product.color}
                name={product.productName}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}