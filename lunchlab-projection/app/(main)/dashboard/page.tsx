// app/(main)/dashboard/page.tsx (전체 교체)
"use client";

import { useDashboard } from "./_hooks/useDashboard";
import { RealtimeSection } from "./_components/RealtimeSection";
import { TrendChartSection } from "./_components/TrendChartSection";
import { DrilldownDetailSection } from "./_components/DrilldownDetailSection";
import { ClientChangeSection } from "./_components/ClientChangeSection";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const h = useDashboard();

  if (h.loading) {
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
        <Button variant="outline" size="sm" onClick={h.refreshAll}>
          ↻ 새로고침
        </Button>
      </div>

      {/* ── 섹션 1: 실시간 현황 ── */}
      <RealtimeSection
        data={h.realtime}
        loading={h.realtimeLoading}
        currentDate={h.realtimeDate}
        onDateChange={h.setRealtimeDate}
      />

      {/* ── 섹션 2: 추이 차트 (자체 필터 포함) ── */}
      <TrendChartSection
        data={h.trend}
        onBarClick={h.openDrilldown}
        activeDate={h.drilldownDate}
        preset={h.trendPreset}
        customStart={h.trendCustomStart}
        customEnd={h.trendCustomEnd}
        excludedProducts={h.trendExcludedProducts}
        onPresetChange={h.setTrendPreset}
        onCustomRangeChange={h.setTrendCustomRange}
        onToggleProduct={h.toggleTrendProduct}
      />

      {/* ── 섹션 3: 드릴다운 상세 ── */}
      {h.drilldownOpen && h.drilldownDate && (
        <DrilldownDetailSection
          data={h.drilldownDetail}
          date={h.drilldownDate}
          loading={h.drilldownLoading}
          onClose={h.closeDrilldown}
        />
      )}

      {/* ── 섹션 4: 고객 변동 (자체 필터 포함) ── */}
      <ClientChangeSection
        data={h.clients}
        preset={h.clientPreset}
        customStart={h.clientCustomStart}
        customEnd={h.clientCustomEnd}
        dowScope={h.dowScope}
        onPresetChange={h.setClientPreset}
        onCustomRangeChange={h.setClientCustomRange}
        onDowScopeChange={h.setDowScope}
        onClientClick={(id) => console.log("client click:", id)}
      />
    </div>
  );
}