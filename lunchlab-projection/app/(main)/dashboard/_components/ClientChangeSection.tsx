// app/(main)/dashboard/_components/ClientChangeSection.tsx (전체 교체)
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";                          // ★ 추가
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
  onClientClick: (accountId: number, type?: string) => void;
  loading?: boolean;                                               // ★ 추가
}

export function ClientChangeSection({
  data, preset, customStart, customEnd, dowScope,
  onPresetChange, onCustomRangeChange, onDowScopeChange, onClientClick,
  loading,                                                         // ★ 추가
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">📋 이탈 · 신규 · 전환예정 고객사</CardTitle>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {/* ★ 로딩 오버레이 */}
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20 rounded-md">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">불러오는 중…</span>
          </div>
        )}

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

        {/* 데이터가 없으면 여기서 중단 */}
        {!data ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            데이터를 불러오는 중입니다...
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              조회 기간: {data.startDate} ~ {data.endDate}
            </p>
            <FlowCards summary={data.summary} />
            <GroupSummaryCards data={data} />
            <DowChangeTable flows={data.dowFlows} />
            <ClientListCards data={data} onClientClick={onClientClick} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
