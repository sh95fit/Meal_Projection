// app/(main)/dashboard/_components/DowChangeTable.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { DowFlow } from "@/types/dashboard";

type ViewMode = "total" | string;

interface Props {
  flows: DowFlow[];
}

export function DowChangeTable({ flows }: Props) {
  const [mode, setMode] = useState<ViewMode>("total");

  if (flows.length === 0) return null;

  const productNames = new Set<string>();
  for (const f of flows) {
    for (const p of f.products) {
      productNames.add(p.productName);
    }
  }
  const productList = Array.from(productNames);

  function getValues(f: DowFlow) {
    if (mode === "total") {
      return {
        churnedAvg: f.churnedAvgSum,
        churnedMedian: f.churnedMedianSum,
        newAvg: f.newAvgSum,
        newMedian: f.newMedianSum,
        netAvg: f.netAvg,
        netMedian: f.netMedian,
      };
    }
    const p = f.products.find((p) => p.productName === mode);
    if (!p) {
      return { churnedAvg: 0, churnedMedian: 0, newAvg: 0, newMedian: 0, netAvg: 0, netMedian: 0 };
    }
    return {
      churnedAvg: p.churnedAvgSum,
      churnedMedian: p.churnedMedianSum,
      newAvg: p.newAvgSum,
      newMedian: p.newMedianSum,
      netAvg: Math.round((p.newAvgSum - p.churnedAvgSum) * 10) / 10,
      netMedian: Math.round((p.newMedianSum - p.churnedMedianSum) * 10) / 10,
    };
  }

  const weeklyTotal = flows.reduce(
    (acc, f) => {
      const v = getValues(f);
      acc.churnedAvg += v.churnedAvg;
      acc.churnedMedian += v.churnedMedian;
      acc.newAvg += v.newAvg;
      acc.newMedian += v.newMedian;
      acc.netAvg += v.netAvg;
      acc.netMedian += v.netMedian;
      return acc;
    },
    { churnedAvg: 0, churnedMedian: 0, newAvg: 0, newMedian: 0, netAvg: 0, netMedian: 0 }
  );

  const r = (n: number) => Math.round(n * 10) / 10;
  const netColor = (v: number) =>
    v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : "text-muted-foreground";
  const netText = (v: number) =>
    v === 0 ? "-" : `${v > 0 ? "+" : ""}${r(v)}`;

  return (
    <div>
      {/* 제목 + 필터 */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold">요일별 주문량 증감 추이</h3>
        <div className="flex gap-1 ml-auto flex-wrap">
          <Button
            variant={mode === "total" ? "default" : "outline"}
            size="sm"
            className="text-[10px] h-6 px-2"
            onClick={() => setMode("total")}
          >
            전체
          </Button>
          {productList.map((name) => (
            <Button
              key={name}
              variant={mode === name ? "default" : "outline"}
              size="sm"
              className="text-[10px] h-6 px-2"
              onClick={() => setMode(name)}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36"></TableHead>
              {flows.map((f) => (
                <TableHead key={f.dow} className="text-center text-xs">
                  {f.dowLabel}
                </TableHead>
              ))}
              <TableHead className="text-center text-xs">주간 합계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* ── 순 변화 (평균) ── */}
            <TableRow className="bg-muted/80 border-b">
              <TableCell className="font-bold text-xs">
                📊 순 변화 (평균)
              </TableCell>
              {flows.map((f) => {
                const v = getValues(f);
                return (
                  <TableCell key={f.dow} className={`text-center font-bold text-sm ${netColor(v.netAvg)}`}>
                    {netText(v.netAvg)}
                  </TableCell>
                );
              })}
              <TableCell className={`text-center font-extrabold text-sm ${netColor(r(weeklyTotal.netAvg))}`}>
                {netText(r(weeklyTotal.netAvg))}
              </TableCell>
            </TableRow>

            {/* 순 변화 (중간) */}
            <TableRow className="bg-muted/80 border-b-2">
              <TableCell className="text-muted-foreground text-xs pl-6">
                └ 중간값
              </TableCell>
              {flows.map((f) => {
                const v = getValues(f);
                return (
                  <TableCell key={f.dow} className={`text-center font-semibold text-xs ${netColor(v.netMedian)}`}>
                    {netText(v.netMedian)}
                  </TableCell>
                );
              })}
              <TableCell className={`text-center font-bold text-xs ${netColor(r(weeklyTotal.netMedian))}`}>
                {netText(r(weeklyTotal.netMedian))}
              </TableCell>
            </TableRow>

            {/* ── 이탈 (평균) ── */}
            <TableRow>
              <TableCell className="text-red-600 font-semibold text-xs">
                ⛔ 이탈 (평균)
              </TableCell>
              {flows.map((f) => {
                const v = getValues(f);
                return (
                  <TableCell key={f.dow} className="text-center text-red-600 text-xs">
                    {v.churnedAvg > 0 ? `-${r(v.churnedAvg)}` : "-"}
                  </TableCell>
                );
              })}
              <TableCell className="text-center text-red-600 font-bold text-xs">
                {r(weeklyTotal.churnedAvg) > 0 ? `-${r(weeklyTotal.churnedAvg)}` : "-"}
              </TableCell>
            </TableRow>

            {/* 이탈 (중간) */}
            <TableRow>
              <TableCell className="text-red-400 text-xs pl-6">└ 중간값</TableCell>
              {flows.map((f) => {
                const v = getValues(f);
                return (
                  <TableCell key={f.dow} className="text-center text-red-400 text-xs">
                    {v.churnedMedian > 0 ? `-${r(v.churnedMedian)}` : "-"}
                  </TableCell>
                );
              })}
              <TableCell className="text-center text-red-400 font-bold text-xs">
                {r(weeklyTotal.churnedMedian) > 0 ? `-${r(weeklyTotal.churnedMedian)}` : "-"}
              </TableCell>
            </TableRow>

            {/* ── 신규 (평균) ── */}
            <TableRow>
              <TableCell className="text-green-600 font-semibold text-xs">
                ✅ 신규 (평균)
              </TableCell>
              {flows.map((f) => {
                const v = getValues(f);
                return (
                  <TableCell key={f.dow} className="text-center text-green-600 text-xs">
                    {v.newAvg > 0 ? `+${r(v.newAvg)}` : "-"}
                  </TableCell>
                );
              })}
              <TableCell className="text-center text-green-600 font-bold text-xs">
                {r(weeklyTotal.newAvg) > 0 ? `+${r(weeklyTotal.newAvg)}` : "-"}
              </TableCell>
            </TableRow>

            {/* 신규 (중간) */}
            <TableRow>
              <TableCell className="text-green-400 text-xs pl-6">└ 중간값</TableCell>
              {flows.map((f) => {
                const v = getValues(f);
                return (
                  <TableCell key={f.dow} className="text-center text-green-400 text-xs">
                    {v.newMedian > 0 ? `+${r(v.newMedian)}` : "-"}
                  </TableCell>
                );
              })}
              <TableCell className="text-center text-green-400 font-bold text-xs">
                {r(weeklyTotal.newMedian) > 0 ? `+${r(weeklyTotal.newMedian)}` : "-"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
