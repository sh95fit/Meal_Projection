// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/_components/WeekdayAnomalyBlock.tsx
// 요일 기준 특이 고객사 목록 — 이탈/신규/미지정 그룹별 표시
// ──────────────────────────────────────────────────────────────────
"use client";

import { Badge } from "@/components/ui/badge";
import type { WeekdayAnomaly } from "@/types/dashboard";

interface Props {
  anomalies: WeekdayAnomaly[];
}

/** 타입별 한글 라벨 & 색상 */
const TYPE_CONFIG = {
  lapsed:     { label: "이탈",   color: "bg-red-100 text-red-700" },
  new:        { label: "신규",   color: "bg-green-100 text-green-700" },
  unassigned: { label: "미지정", color: "bg-yellow-100 text-yellow-700" },
};

export function WeekdayAnomalyBlock({ anomalies }: Props) {
  if (anomalies.length === 0) {
    return <p className="text-gray-400 text-sm">특이 고객사가 없습니다.</p>;
  }

  // 타입별 그룹핑
  const groups = {
    lapsed: anomalies.filter((a) => a.type === "lapsed"),
    new: anomalies.filter((a) => a.type === "new"),
    unassigned: anomalies.filter((a) => a.type === "unassigned"),
  };

  return (
    <div className="space-y-4">
      {(["lapsed", "new", "unassigned"] as const).map((type) => {
        const items = groups[type];
        if (items.length === 0) return null;
        const config = TYPE_CONFIG[type];

        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={config.color}>{config.label}</Badge>
              <span className="text-sm text-gray-500">{items.length}개사</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((item) => (
                <div
                  key={item.accountId}
                  className="flex items-center justify-between border rounded px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{item.accountName}</span>
                    {item.orderDay && (
                      <span className="ml-2 text-gray-400 text-xs">
                        주문요일: {item.orderDay}
                      </span>
                    )}
                  </div>
                  {/* 이탈인 경우 마지막 주문일 표시 */}
                  {item.lastOrderDate && (
                    <span className="text-xs text-gray-400">
                      마지막: {item.lastOrderDate}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}