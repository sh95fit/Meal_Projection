// app/(main)/dashboard/page.tsx (전체 교체)
"use client";

import { useDashboard } from "./_hooks/useDashboard";
import { RealtimeSection } from "./_components/RealtimeSection";
import { TrendChartSection } from "./_components/TrendChartSection";
import { DrilldownDetailSection } from "./_components/DrilldownDetailSection";
import { ClientChangeSection } from "./_components/ClientChangeSection";
import { Button } from "@/components/ui/button";
import type { PeriodPreset } from "@/types/dashboard";

const PRESET_OPTIONS: { label: string; value: PeriodPreset }[] = [
  { label: "올해", value: "year" },
  { label: "7일", value: "7d" },
  { label: "30일", value: "30d" },
  { label: "90일", value: "90d" },
];

export default function DashboardPage() {
  const {
    realtime, trend, clients,
    realtimeDate, setRealtimeDate,
    drilldownDetail, drilldownDate, drilldownOpen, drilldownLoading,
    openDrilldown, closeDrilldown,
    loading, realtimeLoading,
    periodPreset, customStart, customEnd,
    setPeriodPreset, setCustomRange, refreshAll,
  } = useDashboard();

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

      {/* ── 섹션 1: 실시간 현황 (자체 날짜 선택) ── */}
      <RealtimeSection
        data={realtime}
        loading={realtimeLoading}
        currentDate={realtimeDate}
        onDateChange={setRealtimeDate}
      />

      {/* ── 기간 필터 (추이 차트 · 고객 변동용) ── */}
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

      {/* ── 섹션 2: 추이 차트 ── */}
      <TrendChartSection
        data={trend}
        onBarClick={openDrilldown}
        activeDate={drilldownDate}
      />

      {/* ── 섹션 3: 드릴다운 상세 ── */}
      {drilldownOpen && (
        <DrilldownDetailSection
          data={drilldownDetail}
          date={drilldownDate}
          loading={drilldownLoading}
          onClose={closeDrilldown}
        />
      )}

      {/* ── 섹션 4: 고객 변동 현황 ── */}
      <ClientChangeSection data={clients} />
    </div>
  );
}
