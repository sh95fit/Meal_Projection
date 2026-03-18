// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/page.tsx
// 대시보드 메인 페이지 — 4개 섹션을 배치하고 기간 필터를 제공합니다.
// ──────────────────────────────────────────────────────────────────
"use client";

import { useDashboard } from "./_hooks/useDashboard";
import { RealtimeSection } from "./_components/RealtimeSection";
import { TrendChartSection } from "./_components/TrendChartSection";
import { DrilldownSection } from "./_components/DrilldownSection";
import { ClientChangeSection } from "./_components/ClientChangeSection";
import { Button } from "@/components/ui/button";
import type { PeriodPreset } from "@/types/dashboard";

/** 기간 프리셋 버튼 목록 */
const PRESET_OPTIONS: { label: string; value: PeriodPreset }[] = [
  { label: "올해", value: "year" },
  { label: "7일", value: "7d" },
  { label: "30일", value: "30d" },
  { label: "90일", value: "90d" },
];

export default function DashboardPage() {
  const {
    realtime, trend, drilldown, clients,
    loading, realtimeLoading,
    periodPreset, customStart, customEnd,
    setPeriodPreset, setCustomRange, refreshAll,
  } = useDashboard();

  // ── 로딩 중 ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 animate-pulse">대시보드를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <Button variant="outline" size="sm" onClick={refreshAll}>
          ↻ 새로고침
        </Button>
      </div>

      {/* ── 기간 필터 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRESET_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={periodPreset === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodPreset(opt.value)}
          >
            {opt.label}
          </Button>
        ))}

        {/* 커스텀 날짜 입력 */}
        <div className="flex items-center gap-1 ml-2">
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm"
            value={customStart}
            onChange={(e) => setCustomRange(e.target.value, customEnd)}
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm"
            value={customEnd}
            onChange={(e) => setCustomRange(customStart, e.target.value)}
          />
        </div>
      </div>

      {/* ── 섹션 1: 실시간 현황 ── */}
      <RealtimeSection data={realtime} loading={realtimeLoading} />

      {/* ── 섹션 2: 추이 차트 ── */}
      <TrendChartSection data={trend} />

      {/* ── 섹션 3: 특이 고객사 드릴다운 ── */}
      <DrilldownSection data={drilldown} />

      {/* ── 섹션 4: 고객 변동 현황 ── */}
      <ClientChangeSection data={clients} />
    </div>
  );
}