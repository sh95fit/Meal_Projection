// app/(main)/dashboard/_components/ClientListCards.tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ClientChangeResponse, ClientChange } from "@/types/dashboard";

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

/** 고객 유형별 우측 날짜 정보 */
function DateInfo({ c }: { c: ClientChange }) {
  if (c.type === "churned") {
    return (
      <div className="text-[11px] text-muted-foreground text-right whitespace-nowrap">
        {c.lastOrderDate && <div>마지막 주문 {c.lastOrderDate}</div>}
        {c.terminateAt && <div>이용 종료 {c.terminateAt}</div>}
      </div>
    );
  }
  if (c.type === "new") {
    return (
      <div className="text-[11px] text-muted-foreground text-right whitespace-nowrap">
        {c.lastOrderDate && <div>마지막 주문 {c.lastOrderDate}</div>}
        {c.subscriptionAt && <div>구독 전환 {c.subscriptionAt}</div>}
      </div>
    );
  }
  // converted
  return (
    <div className="text-[11px] text-muted-foreground text-right whitespace-nowrap">
      {c.subscriptionScheduledAt && (
        <div>전환 예정 {c.subscriptionScheduledAt}</div>
      )}
    </div>
  );
}

/** 중간값 계산 */
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const val =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  return Math.round(val * 10) / 10;
}

export function ClientListCards({ data, onClientClick }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (id: number) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

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
                {g.icon} {g.label} ({items.length})
              </p>
              <div className="max-h-[360px] overflow-y-auto space-y-0.5">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    해당 고객사가 없습니다.
                  </p>
                ) : (
                  items.map((c) => {
                    const isOpen = !!expanded[c.accountId];
                    const avg =
                      c.type === "churned" ? c.previousAvg : c.currentAvg;
                    const productAvgs = c.productAvgs ?? [];
                    const medianVal = median(productAvgs.map((p) => p.avg));

                    return (
                      <div
                        key={c.accountId}
                        className="border-b last:border-b-0"
                      >
                        {/* ── 메인 행 ── */}
                        <div
                          className="flex items-center justify-between py-2.5 px-2 rounded
                                     hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => toggle(c.accountId)}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span
                              className="font-semibold text-sm truncate hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClientClick(c.accountId);
                              }}
                            >
                              {c.accountName}
                            </span>
                          </div>
                          <DateInfo c={c} />
                        </div>

                        {/* ── 펼침 영역 ── */}
                        {isOpen && (
                          <div className="px-3 pb-3 pt-1 ml-5 text-xs text-muted-foreground space-y-1.5">
                            {/* 전체 평균 / 중간값 */}
                            <div className="flex gap-4">
                              <span>
                                전체 평균{" "}
                                <strong className="text-foreground">
                                  {avg}
                                </strong>
                              </span>
                              <span>
                                중간값{" "}
                                <strong className="text-foreground">
                                  {medianVal}
                                </strong>
                              </span>
                            </div>
                            {/* 주력 상품 */}
                            <div>
                              주력 상품:{" "}
                              <span className="text-foreground">
                                {c.mainProduct}
                              </span>
                            </div>
                            {/* 상품별 상세 */}
                            {productAvgs.length > 0 && (
                              <div className="border-t pt-1.5 mt-1 space-y-0.5">
                                {productAvgs.map((p) => (
                                  <div
                                    key={p.productName}
                                    className="flex justify-between"
                                  >
                                    <span>{p.productName}</span>
                                    <span className="text-foreground">
                                      평균 {p.avg}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
