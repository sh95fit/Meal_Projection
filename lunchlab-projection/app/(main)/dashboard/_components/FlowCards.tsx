// app/(main)/dashboard/_components/FlowCards.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";

interface Props {
  summary: {
    churned: number;
    new: number;
    converted: number;
    netFlow: number;
  };
}

export function FlowCards({ summary }: Props) {
  const { churned, converted, netFlow } = summary;
  const newCount = summary.new;

  // 순유입 게이지 비율
  const total = churned + newCount;
  const newPct = total > 0 ? Math.round((newCount / total) * 100) : 50;

  const cards = [
    {
      icon: "📉",
      label: "이탈 고객사",
      value: churned,
      color: "text-red-600",
      sub: `이탈 비중 ${total > 0 ? 100 - newPct : 50}%`,
    },
    {
      icon: "📈",
      label: "신규 고객사",
      value: newCount,
      color: "text-green-600",
      sub: `신규 비중 ${newPct}%`,
    },
    {
      icon: "🔄",
      label: "전환예정",
      value: converted,
      color: "text-purple-600",
      sub: "",
    },
    {
      icon: netFlow >= 0 ? "📊" : "⚠️",
      label: "순 유입",
      value: `${netFlow >= 0 ? "+" : ""}${netFlow}`,
      color: netFlow >= 0 ? "text-green-600" : "text-red-600",
      sub: `${netFlow >= 0 ? "+" : ""}${newCount + converted - churned} 고객사`,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <Card key={i}>
          <CardContent className="pt-5 pb-4 text-center">
            <span className="text-2xl block mb-1">{c.icon}</span>
            <span className={`text-3xl font-extrabold block ${c.color}`}>
              {c.value}
            </span>
            <span className="text-xs text-muted-foreground block mt-1">
              {c.label}
            </span>
            {c.sub && (
              <span className="text-[10px] text-muted-foreground block mt-1">
                {c.sub}
              </span>
            )}

            {/* 순유입 카드에만 게이지 바 표시 */}
            {i === 3 && (
              <div className="h-1 rounded-full mt-2 w-3/5 mx-auto overflow-hidden bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    netFlow >= 0 ? "bg-green-500" : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.min(Math.abs(netFlow) * 10, 100)}%`,
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}