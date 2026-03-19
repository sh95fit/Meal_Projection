// app/(main)/dashboard/_components/FlowCards.tsx (전체 교체)
"use client";

import { Card, CardContent } from "@/components/ui/card";

interface Props {
  summary: {
    churned: number;
    new: number;
    converted: number;
    netFlow: number;
    churnedDelta: number;
    newDelta: number;
    convertedDelta: number;
    prevChurned: number;
    prevNew: number;
    prevConverted: number;
  };
}

function DeltaText({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-xs text-gray-400">전기 대비 — 변동 없음</span>;
  const isUp = delta > 0;
  const color = isUp ? "text-red-500" : "text-green-500";
  return (
    <span className={`text-xs ${color}`}>
      전기 대비 {isUp ? "▲" : "▼"} {Math.abs(delta)}건
    </span>
  );
}

function NewDeltaText({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-xs text-gray-400">전기 대비 — 변동 없음</span>;
  const isUp = delta > 0;
  const color = isUp ? "text-green-500" : "text-red-500";
  return (
    <span className={`text-xs ${color}`}>
      전기 대비 {isUp ? "▲" : "▼"} {Math.abs(delta)}건
    </span>
  );
}

export function FlowCards({ summary }: Props) {
  const { churned, converted, netFlow, churnedDelta, newDelta, convertedDelta } = summary;
  const newCount = summary.new;

  const cards = [
    {
      icon: "📉",
      label: "이탈 고객사",
      value: churned,
      color: "text-red-600",
      delta: <DeltaText delta={churnedDelta} />,
    },
    {
      icon: "📈",
      label: "신규 고객사",
      value: newCount,
      color: "text-green-600",
      delta: <NewDeltaText delta={newDelta} />,
    },
    {
      icon: "🔄",
      label: "전환예정",
      value: converted,
      color: "text-purple-600",
      delta: <NewDeltaText delta={convertedDelta} />,
    },
    {
      icon: netFlow >= 0 ? "📊" : "⚠️",
      label: "순 유입",
      value: `${netFlow >= 0 ? "+" : ""}${netFlow}`,
      color: netFlow >= 0 ? "text-green-600" : "text-red-600",
      delta: null,
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
            {c.delta && (
              <span className="block mt-1">{c.delta}</span>
            )}

            {/* 순유입 카드에만 게이지 바 */}
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