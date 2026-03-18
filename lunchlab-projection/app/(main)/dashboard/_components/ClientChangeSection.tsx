// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/_components/ClientChangeSection.tsx
// 고객 변동 현황 — 이탈/신규/전환 목록 + 순유입 게이지 + 요일 테이블
// ──────────────────────────────────────────────────────────────────
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlowSummary } from "./FlowSummary";
import { DowChangeTable } from "./DowChangeTable";
import { ClientDetailModal } from "./ClientDetailModal";
import type { ClientChangeResponse, ClientChange } from "@/types/dashboard";

interface Props {
  data: ClientChangeResponse | null;
}

/** 타입별 설정 */
const TYPE_CONFIG = {
  churned:   { label: "이탈", color: "bg-red-100 text-red-700", icon: "📉" },
  new:       { label: "신규", color: "bg-green-100 text-green-700", icon: "📈" },
  converted: { label: "전환", color: "bg-yellow-100 text-yellow-700", icon: "🔄" },
};

export function ClientChangeSection({ data }: Props) {
  // 모달 상태: 선택된 고객사 정보
  const [selectedClient, setSelectedClient] = useState<ClientChange | null>(null);

  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          ④ 고객 변동 현황 ({data.startDate} ~ {data.endDate})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 요약 & 순유입 게이지 */}
        <FlowSummary summary={data.summary} />

        {/* 이탈 / 신규 / 전환 목록 */}
        {(["churned", "new", "converted"] as const).map((type) => {
          const items = data.changes.filter((c) => c.type === type);
          if (items.length === 0) return null;
          const config = TYPE_CONFIG[type];

          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <span>{config.icon}</span>
                <Badge className={config.color}>{config.label}</Badge>
                <span className="text-sm text-gray-500">{items.length}개사</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((item) => (
                  <button
                    key={item.accountId}
                    className="flex items-center justify-between border rounded px-3 py-2 text-sm
                               hover:bg-gray-50 transition-colors text-left w-full"
                    onClick={() => setSelectedClient(item)}
                  >
                    <div>
                      <span className="font-medium">{item.accountName}</span>
                      <span className="ml-2 text-gray-400 text-xs">
                        주력: {item.mainProduct}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {item.previousAvg} → {item.currentAvg}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* 요일별 증감 테이블 */}
        <DowChangeTable flows={data.dowFlows} />

        {/* 고객사 상세 모달 */}
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      </CardContent>
    </Card>
  );
}