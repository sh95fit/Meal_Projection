// app/(main)/dashboard/_components/GroupSummaryCards.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ClientChangeResponse } from "@/types/dashboard";

interface Props {
  data: ClientChangeResponse;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
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

        // ── 총 평균 식수 합계 (각 고객사의 avgField 합산) ──
        const totalAvgSum =
          count > 0
            ? Math.round(items.reduce((s, c) => s + c[g.avgField], 0) * 10) / 10
            : 0;

        // ── 총 중간 식수 합계 (각 고객사 avgField의 중간값 × 고객사 수) ──
        const medianValue = median(items.map((c) => c[g.avgField]));
        const totalMedianSum =
          count > 0 ? Math.round(medianValue * count * 10) / 10 : 0;

        // ── 상품별 집계 ──
        const productTotals = new Map<
          string,
          { avgs: number[]; totalAvg: number }
        >();

        for (const c of items) {
          const productAvgs = c.productAvgs ?? [];
          for (const pa of productAvgs) {
            if (!productTotals.has(pa.productName)) {
              productTotals.set(pa.productName, { avgs: [], totalAvg: 0 });
            }
            const entry = productTotals.get(pa.productName)!;
            entry.avgs.push(pa.avg);
            entry.totalAvg += pa.avg;
          }
        }

        // 상품별 평균 합계 / 중간 합계
        const productStats = Array.from(productTotals.entries())
          .map(([name, data]) => ({
            productName: name,
            avgSum: Math.round(data.totalAvg * 10) / 10,
            medianSum:
              Math.round(median(data.avgs) * data.avgs.length * 10) / 10,
          }))
          .sort((a, b) => b.avgSum - a.avgSum);

        return (
          <Card key={g.type}>
            <CardContent className="pt-4 pb-3">
              <p
                className={`text-xs font-semibold uppercase tracking-wide mb-3 ${g.color}`}
              >
                {g.label}
              </p>
              <div className="space-y-1.5 text-sm">
                {/* 평균 식수 합계 */}
                <Row label="평균 식수 합계" value={String(totalAvgSum)} />
                {totalAvgSum > 0 &&
                  productStats.map((ps) => (
                    <Row
                      key={`avg-${ps.productName}`}
                      label={ps.productName}
                      value={String(ps.avgSum)}
                      sub
                    />
                  ))}

                {/* 구분선 */}
                <div className="border-t border-gray-100 my-1" />

                {/* 중간 식수 합계 */}
                <Row label="중간 식수 합계" value={String(totalMedianSum)} />
                {totalMedianSum > 0 &&
                  productStats.map((ps) => (
                    <Row
                      key={`med-${ps.productName}`}
                      label={ps.productName}
                      value={String(ps.medianSum)}
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