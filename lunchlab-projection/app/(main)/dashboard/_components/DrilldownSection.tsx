// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/_components/DrilldownSection.tsx
// 특이 고객사 드릴다운 — 탭(요일/수량)으로 분리
// ──────────────────────────────────────────────────────────────────
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WeekdayAnomalyBlock } from "./WeekdayAnomalyBlock";
import { QuantityAnomalyBlock } from "./QuantityAnomalyBlock";
import type { DrilldownResponse } from "@/types/dashboard";

/** 요일 약어 → 한글 */
const DOW_LABELS: Record<string, string> = {
  sun: "일", mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토",
};

interface Props {
  data: DrilldownResponse | null;
}

export function DrilldownSection({ data }: Props) {
  // 탭 상태: 'weekday' | 'quantity'
  const [tab, setTab] = useState<"weekday" | "quantity">("weekday");

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          ③ 특이 고객사 ({data.targetDate} · {DOW_LABELS[data.dow] || data.dow}요일)
        </CardTitle>
        <div className="flex gap-1">
          <Button
            variant={tab === "weekday" ? "default" : "outline"} size="sm"
            onClick={() => setTab("weekday")}
          >
            요일 기준
          </Button>
          <Button
            variant={tab === "quantity" ? "default" : "outline"} size="sm"
            onClick={() => setTab("quantity")}
          >
            수량 변동
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tab === "weekday" ? (
          <WeekdayAnomalyBlock anomalies={data.weekdayAnomalies} />
        ) : (
          <QuantityAnomalyBlock anomalies={data.quantityAnomalies} />
        )}
      </CardContent>
    </Card>
  );
}