// app/(main)/dashboard/_components/ClientListCards.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ClientChangeResponse } from "@/types/dashboard";

interface Props {
  data: ClientChangeResponse;
  onClientClick: (accountId: number) => void;
}

const GROUPS = [
  {
    type: "churned" as const,
    label: "이탈 고객사",
    color: "text-red-600",
    icon: "📉",
  },
  {
    type: "new" as const,
    label: "신규 고객사",
    color: "text-green-600",
    icon: "📈",
  },
  {
    type: "converted" as const,
    label: "전환예정 고객사",
    color: "text-purple-600",
    icon: "🔄",
  },
] as const;

export function ClientListCards({ data, onClientClick }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {GROUPS.map((g) => {
        const items = data.changes.filter((c) => c.type === g.type);
        return (
          <Card key={g.type}>
            <CardContent className="pt-4 pb-3">
              <p
                className={`text-xs font-semibold uppercase tracking-wide mb-3 ${g.color}`}
              >
                {g.icon} {g.label}
              </p>
              <div className="max-h-[300px] overflow-y-auto space-y-0.5">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    해당 고객사가 없습니다.
                  </p>
                ) : (
                  items.map((c) => (
                    <div
                      key={c.accountId}
                      className="py-2.5 border-b last:border-b-0 cursor-pointer
                                 hover:bg-gray-50 transition-colors px-2 rounded"
                      onClick={() => onClientClick(c.accountId)}
                    >
                      <div className="font-semibold text-sm">
                        {c.accountName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        평균{" "}
                        {c.type === "churned" ? c.previousAvg : c.currentAvg} ·
                        주력: {c.mainProduct}
                      </div>
                      {c.lastOrderDate && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          마지막 주문: {c.lastOrderDate}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}