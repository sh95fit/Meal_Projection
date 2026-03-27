// app/(main)/dashboard/page.tsx
"use client";

import { useDashboard } from "./_hooks/useDashboard";
import { RealtimeSection } from "./_components/RealtimeSection";
import { TrendChartSection } from "./_components/TrendChartSection";
import { DrilldownDetailSection } from "./_components/DrilldownDetailSection";
import { ClientChangeSection } from "./_components/ClientChangeSection";
import { ClientDetailModal } from "./_components/ClientDetailModal";
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
    <div className="space-y-4 lg:space-y-6">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-bold">대시보드</h1>
        <Button variant="outline" size="sm" onClick={h.refreshAll}>
          ↻ 새로고침
        </Button>
      </div>

      <RealtimeSection
        data={h.realtime}
        loading={h.realtimeLoading}
        currentDate={h.realtimeDate}
        onDateChange={h.setRealtimeDate}
      />

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
        loading={h.trendLoading}
      />

      {h.drilldownOpen && h.drilldownDate && (
        <DrilldownDetailSection
          data={h.drilldownDetail}
          date={h.drilldownDate}
          loading={h.drilldownLoading}
          onClose={h.closeDrilldown}
        />
      )}

      <ClientChangeSection
        data={h.clients}
        preset={h.clientPreset}
        customStart={h.clientCustomStart}
        customEnd={h.clientCustomEnd}
        dowScope={h.dowScope}
        onPresetChange={h.setClientPreset}
        onCustomRangeChange={h.setClientCustomRange}
        onDowScopeChange={h.setDowScope}
        onClientClick={h.openClientModal}
        loading={h.clientsLoading}
      />

      <ClientDetailModal
        open={h.clientModalOpen}
        loading={h.clientModalLoading}
        data={h.clientModalData}
        onClose={h.closeClientModal}
      />
    </div>
  );
}
