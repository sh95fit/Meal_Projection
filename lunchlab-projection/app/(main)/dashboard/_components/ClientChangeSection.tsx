// app/(main)/dashboard/_components/ClientChangeSection.tsx
"use client";

import { FlowCards } from "./FlowCards";
import { GroupSummaryCards } from "./GroupSummaryCards";
import { DowChangeTable } from "./DowChangeTable";
import { ClientListCards } from "./ClientListCards";
import type {
  ClientChangeResponse,
  PeriodPreset,
  ViewScope,
} from "@/types/dashboard";

interface Props {
  data: ClientChangeResponse | null;
  periodPreset: PeriodPreset;
  dowScope: ViewScope;
  onDowScopeChange: (s: ViewScope) => void;
  onClientClick: (accountId: number) => void;
}

const PERIOD_LABELS: Record<string, string> = {
  year: "올해",
  "7d": "최근 7일",
  "30d": "최근 30일",
  "90d": "최근 90일",
  custom: "사용자 지정",
};

export function ClientChangeSection({
  data,
  periodPreset,
  dowScope,
  onDowScopeChange,
  onClientClick,
}: Props) {
  if (!data) return null;

  return (
    <section id="sec-clients" className="space-y-4">
      <h2 className="text-lg font-bold">이탈 · 신규 · 전환예정 고객사</h2>
      <p className="text-xs text-muted-foreground">
        {PERIOD_LABELS[periodPreset] || periodPreset} ({data.startDate} ~{" "}
        {data.endDate})
      </p>

      {/* 4칸 플로우 카드 */}
      <FlowCards summary={data.summary} />

      {/* 3칸 요약 (평균/중간값) */}
      <GroupSummaryCards data={data} />

      {/* 요일별 증감 테이블 */}
      <DowChangeTable
        flows={data.dowFlows}
        scope={dowScope}
        onScopeChange={onDowScopeChange}
      />

      {/* 3칸 고객 리스트 */}
      <ClientListCards data={data} onClientClick={onClientClick} />
    </section>
  );
}