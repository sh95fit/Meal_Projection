// app/(main)/dashboard/_components/GroupSummaryCards.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ClientChangeResponse } from "@/types/dashboard";

interface Props {
  data: ClientChangeResponse;
}

export function GroupSummaryCards({ data }: Props) {
  const groups = [
    {
      label: "이탈 고객사 요약",
      color: "text-red-600",
      type: "churned" as const,
      avgField: "previousAvg" as const,
    },
    {
      label: "신규 고객사 요약",
      color: "text-green-600",
      type: "new" as const,
      avgField: "currentAvg" as const,
    },
    {
      label: "전환예정 고객사 요약",
      color: "text-purple-600",
      type: "converted" as const,
      avgField: "currentAvg" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {groups.map((g) => {
        const items = data.changes.filter((c) => c.type === g.type);
        const count = items.length;

        // 평균 계산
        const avgQty =
          count > 0
            ? Math.round(
                (items.reduce((s, c) => s + c[g.avgField], 0) / count) * 10
              ) / 10
            : 0;

        // 중간값 계산
        const sorted = items
          .map((c) => c[g.avgField])
          .sort((a, b) => a - b);
        const medianQty =
          count > 0
            ? count % 2 === 0
              ? Math.round(
                  ((sorted[count / 2 - 1] + sorted[count / 2]) / 2) * 10
                ) / 10
              : sorted[Math.floor(count / 2)]
            : 0;

        // 주력 상품 집계
        const productMap = new Map<string, number>();
        for (const c of items) {
          if (c.mainProduct) {
            productMap.set(
              c.mainProduct,
              (productMap.get(c.mainProduct) || 0) + 1
            );
          }
        }

        return (
          <Card key={g.type}>
            <CardContent className="pt-4 pb-3">
              <p
                className={`text-xs font-semibold uppercase tracking-wide mb-3 ${g.color}`}
              >
                {g.label}
              </p>
              <div className="space-y-1.5 text-sm">
                <Row label="전체 평균" value={String(avgQty)} />
                <Row label="전체 중간값" value={String(medianQty)} />
                {/* 상품별 요약은 mainProduct 기반으로 간략 표시 */}
                {Array.from(productMap.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([name, cnt]) => (
                    <Row
                      key={name}
                      label={name}
                      value={`${cnt}개사 주력`}
                      sub
                    />
                  ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Row({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${
        sub ? "pl-3 text-muted-foreground text-xs" : ""
      }`}
    >
      <span className={sub ? "" : "text-muted-foreground"}>{label}</span>
      <strong className={sub ? "font-normal" : ""}>{value}</strong>
    </div>
  );
}