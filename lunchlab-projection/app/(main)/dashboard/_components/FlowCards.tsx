// app/(main)/dashboard/_components/FlowCards.tsx
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
  if (delta === 0) return <span className="text-[10px] lg:text-xs text-gray-400">전기 대비 — 변동 없음</span>;
  const isUp = delta > 0;
  const color = isUp ? "text-red-500" : "text-green-500";
  return <span className={`text-[10px] lg:text-xs ${color}`}>전기 대비 {isUp ? "▲" : "▼"} {Math.abs(delta)}건</span>;
}

function NewDeltaText({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-[10px] lg:text-xs text-gray-400">전기 대비 — 변동 없음</span>;
  const isUp = delta > 0;
  const color = isUp ? "text-green-500" : "text-red-500";
  return <span className={`text-[10px] lg:text-xs ${color}`}>전기 대비 {isUp ? "▲" : "▼"} {Math.abs(delta)}건</span>;
}

export function FlowCards({ summary }: Props) {
  const { churned, converted, netFlow, churnedDelta, newDelta, convertedDelta } = summary;
  const newCount = summary.new;

  const cards = [
    { icon: "📉", label: "이탈 고객사", value: churned, color: "text-red-600", delta: <DeltaText delta={churnedDelta} />, tooltip: "활성 고객사 기준 이탈 수 (체험 고객사 제외)" },
    { icon: "📈", label: "신규 고객사", value: newCount, color: "text-green-600", delta: <NewDeltaText delta={newDelta} />, tooltip: "구독 전환 고객사 기준 유입 수 (체험 고객사 제외)" },
    { icon: "🔄", label: "전환예정", value: converted, color: "text-purple-600", delta: <NewDeltaText delta={convertedDelta} />, tooltip: "전환 예정 설정이 되어 있는 고객사가 유효한 경우 표시" },
    { icon: netFlow >= 0 ? "📊" : "⚠️", label: "순 유입", value: `${netFlow >= 0 ? "+" : ""}${netFlow}`, color: netFlow >= 0 ? "text-green-600" : "text-red-600", delta: null, tooltip: null },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
      {cards.map((c, i) => (
        <Card key={i} className="relative group">
          <CardContent className="pt-3 pb-2 lg:pt-5 lg:pb-4 text-center">
            <span className="text-xl lg:text-2xl block mb-0.5 lg:mb-1">{c.icon}</span>
            <span className={`text-2xl lg:text-3xl font-extrabold block ${c.color}`}>{c.value}</span>
            <span className="text-[10px] lg:text-xs text-muted-foreground block mt-0.5 lg:mt-1">{c.label}</span>
            {c.delta && <span className="block mt-0.5 lg:mt-1">{c.delta}</span>}
            {c.tooltip && (
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-1 hidden group-hover:block whitespace-nowrap rounded bg-gray-800 px-2.5 py-1.5 text-xs text-white shadow-lg z-10">
                {c.tooltip}
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
