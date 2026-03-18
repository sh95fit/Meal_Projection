// app/(main)/dashboard/_components/ClientChangeSection.tsx (전체 교체)
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlowCards } from "./FlowCards";
import { GroupSummaryCards } from "./GroupSummaryCards";
import { DowChangeTable } from "./DowChangeTable";
import { ClientListCards } from "./ClientListCards";
import type { ClientChangeResponse, PeriodPreset, ViewScope } from "@/types/dashboard";

const CLIENT_PRESETS: { label: string; value: PeriodPreset }[] = [
  { label: "올해",     value: "year" },
  { label: "7일",      value: "7d" },
  { label: "30일",     value: "30d" },
  { label: "기간 지정", value: "custom" },
];

interface Props {
  data: ClientChangeResponse | null;
  preset: PeriodPreset;
  customStart: string;
  customEnd: string;
  dowScope: ViewScope;
  onPresetChange: (p: PeriodPreset) => void;
  onCustomRangeChange: (start: string, end: string) => void;
  onDowScopeChange: (s: ViewScope) => void;
  onClientClick: (accountId: string) => void;
}

export function ClientChangeSection({
  data, preset, customStart, customEnd, dowScope,
  onPresetChange, onCustomRangeChange, onDowScopeChange, onClientClick,
}: Props) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">📋 이탈 · 신규 · 전환예정 고객사</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── 기간 필터 바 ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {CLIENT_PRESETS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={preset === opt.value ? "default" : "outline"}
              onClick={() => onPresetChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}

          {/* ★ "기간 지정" 탭 선택 시에만 날짜 입력 표시 */}
          {preset === "custom" && (
            <div className="flex items-center gap-1 ml-2">
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={customStart}
                onChange={(e) => onCustomRangeChange(e.target.value, customEnd)}
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={customEnd}
                onChange={(e) => onCustomRangeChange(customStart, e.target.value)}
              />
            </div>
          )}
        </div>

        {/* 조회 기간 표시 */}
        <p className="text-xs text-muted-foreground">
          조회 기간: {data.startDate} ~ {data.endDate}
        </p>

        <FlowCards summary={data.summary} />
        <GroupSummaryCards data={data} />
        <DowChangeTable
          flows={data.dowFlows}
          scope={dowScope}
          onScopeChange={onDowScopeChange}
        />
        <ClientListCards data={data} onClientClick={onClientClick} />
      </CardContent>
    </Card>
  );
}
