// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/_components/FlowSummary.tsx
// 순유입 게이지 — 이탈 vs 신규 vs 전환 수치와 게이지 바
// ──────────────────────────────────────────────────────────────────
"use client";

import { Badge } from "@/components/ui/badge";

interface Props {
  summary: {
    churned: number;
    new: number;
    converted: number;
    netFlow: number;
  };
}

export function FlowSummary({ summary }: Props) {
  const { churned, converted, netFlow } = summary;
  const newCount = summary.new;

  // 게이지 바 계산: 전체 = churned + new, 비율로 표시
  const total = churned + newCount;
  const churnPct = total > 0 ? Math.round((churned / total) * 100) : 50;
  const newPct = 100 - churnPct;

  // 순유입 색상 & 아이콘
  const netColor = netFlow > 0 ? "text-green-600" : netFlow < 0 ? "text-red-600" : "text-gray-400";
  const netIcon = netFlow > 0 ? "▲" : netFlow < 0 ? "▼" : "─";

  return (
    <div className="flex items-center gap-6 p-4 border rounded-lg bg-gray-50">
      {/* 숫자 요약 */}
      <div className="flex gap-4 text-sm">
        <div className="text-center">
          <div className="text-red-500 text-xl font-bold">{churned}</div>
          <div className="text-gray-400">이탈</div>
        </div>
        <div className="text-center">
          <div className="text-green-500 text-xl font-bold">{newCount}</div>
          <div className="text-gray-400">신규</div>
        </div>
        <div className="text-center">
          <div className="text-yellow-500 text-xl font-bold">{converted}</div>
          <div className="text-gray-400">전환</div>
        </div>
      </div>

      {/* 게이지 바 */}
      <div className="flex-1">
        <div className="flex h-4 rounded-full overflow-hidden">
          <div
            className="bg-red-400 transition-all"
            style={{ width: `${churnPct}%` }}
            title={`이탈 ${churned}`}
          />
          <div
            className="bg-green-400 transition-all"
            style={{ width: `${newPct}%` }}
            title={`신규 ${newCount}`}
          />
        </div>
        <div className="flex justify-between text-xs mt-1 text-gray-400">
          <span>이탈 {churnPct}%</span>
          <span>신규 {newPct}%</span>
        </div>
      </div>

      {/* 순유입 */}
      <div className="text-center">
        <div className={`text-2xl font-bold ${netColor}`}>
          {netIcon} {Math.abs(netFlow)}
        </div>
        <div className="text-gray-400 text-xs">순유입</div>
      </div>
    </div>
  );
}