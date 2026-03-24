// app/(main)/dashboard/_components/DrilldownDetailSection.tsx (전체 교체)
"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { WeekdayTable } from "./WeekdayTable";
import { QuantityTable } from "./QuantityTable";
import type {
  DrilldownDetailResponse,
  QuantityClient,
  WeekdayCaseClient,
  ProductChip,
} from "@/types/dashboard";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  data: DrilldownDetailResponse | null;
  date: string;
  loading: boolean;
  onClose: () => void;
}

type WeekdayFilter = "all" | "lapsed" | "new" | "unassigned";

/* ------------------------------------------------------------------ */
/*  FilterTab                                                          */
/* ------------------------------------------------------------------ */

function FilterTab({
  label, count, active, onClick,
}: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? "bg-gray-900 text-white border-gray-900"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
      <span className={`text-[10px] ${active ? "text-gray-300" : "text-gray-400"}`}>
        {count}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  SummaryCard                                                        */
/* ------------------------------------------------------------------ */

function SummaryCard({
  label, value, className,
}: {
  label: string; value: string | number; className?: string;
}) {
  return (
    <div className={`rounded-lg border p-3 text-center ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  computeNetSummary — 전체 순증 = 상품별 순증 합계 정합성 보장       */
/* ------------------------------------------------------------------ */

function computeNetSummary(
  clients: WeekdayCaseClient[],
  filter: WeekdayFilter,
  productChips: ProductChip[],
) {
  const filtered = filter === "all" ? clients : clients.filter((c) => c.case === filter);

  // ★ 수정: totalNet도 상품별과 동일한 기준으로 계산하여 정합성 보장
  let totalNet = 0;
  const productNetMap = new Map<string, number>();

  for (const c of filtered) {
    const sign = c.case === "lapsed" ? -1 : 1;
    for (const p of c.products) {
      const val = sign === -1 ? -p.qty : p.qty;
      productNetMap.set(p.productName, (productNetMap.get(p.productName) || 0) + val);
      totalNet += val;
    }
  }

  const productNets: { name: string; color: string; net: number }[] = [];
  for (const chip of productChips) {
    const net = productNetMap.get(chip.productName);
    if (net !== undefined && net !== 0) {
      productNets.push({ name: chip.productName, color: chip.color, net });
    }
  }

  return { totalNet, productNets };
}

/* ------------------------------------------------------------------ */
/*  DrilldownDetailSection                                             */
/* ------------------------------------------------------------------ */

export function DrilldownDetailSection({ data, date, loading, onClose }: Props) {
  const [weekdayFilter, setWeekdayFilter] = useState<WeekdayFilter>("all");

  /* ── C-2: 요일 순증감 (기존 useMemo 유지) ── */
  const weekdayNetSummary = useMemo(() => {
    if (!data) return { totalNet: 0, productNets: [] };
    return computeNetSummary(data.weekdayClients, weekdayFilter, data.productChips);
  }, [data, weekdayFilter]);

  /* ── C-2: 수량 특이 고객사 필터링 + QuantityClient 변환 (useMemo 추가) ── */
  const filteredQuantityClients = useMemo<QuantityClient[]>(() => {
    if (!data) return [];
    const weekdayAccountIds = new Set(data.weekdayClients.map((c) => c.accountId));
    return data.quantityClients
      .filter((c) => !weekdayAccountIds.has(c.accountId) && Math.abs(c.diff ?? 0) >= 3)
      .map((c) => ({
        accountId: c.accountId,
        accountName: c.accountName,
        accountStatus: c.accountStatus,
        subscriptionAt: c.subscriptionAt,
        dowOrderCount: c.dowOrderCount,
        totalLast: c.lastWeekQty,
        totalThis: c.thisWeekQty,
        totalDiff: c.diff,
        products: c.products.map((p) => ({
          productName: p.productName,
          lastWeekQty: p.lastWeek,
          thisWeekQty: p.thisWeek,
          diff: p.diff,
        })),
      }));
  }, [data]);

  /* ── C-2: 수량 순증감 계산 (useMemo 추가) ── */
  const { qtyTotalNet, qtyProductNets } = useMemo(() => {
    if (!data) {
      return {
        qtyTotalNet: 0,
        qtyProductNets: [] as { name: string; color: string; net: number }[],
      };
    }

    let totalNet = 0;
    const productNetMap = new Map<string, number>();

    for (const c of filteredQuantityClients) {
      totalNet += c.totalDiff;
      for (const p of c.products) {
        productNetMap.set(
          p.productName,
          (productNetMap.get(p.productName) || 0) + p.diff,
        );
      }
    }

    const productNets: { name: string; color: string; net: number }[] = [];
    for (const chip of data.productChips) {
      const net = productNetMap.get(chip.productName);
      if (net !== undefined && net !== 0) {
        productNets.push({ name: chip.productName, color: chip.color, net });
      }
    }

    return { qtyTotalNet: totalNet, qtyProductNets: productNets };
  }, [filteredQuantityClients, data]);

  /* ── Loading ── */
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">상세 분석 로딩 중…</span>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  /* ── Render ── */
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            📅 {date} ({data.dow}) 상세 분석
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ──────────────── Summary Cards ──────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="주문 고객사" value={data.orderedCount} />
          <SummaryCard label="미주문 고객사" value={data.unorderedCount} />
          <SummaryCard label="총 수량" value={data.totalQty.toLocaleString()} />
          <SummaryCard label="신규 주문" value={data.newCount} className="border-blue-200 bg-blue-50/50" />
          <SummaryCard label="이탈" value={data.lapsedCount} className="border-red-200 bg-red-50/50" />
        </div>

        {/* ──────────────── Product Chips ──────────────── */}
        <div className="flex flex-wrap gap-2">
          {data.productChips.map((chip) => (
            <span
              key={chip.productId}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: chip.color }}
            >
              {chip.productName}
              <span className="text-white/80">{chip.qty}</span>
            </span>
          ))}
        </div>

        {/* ──────────────── 요일 기준 특이 고객사 ──────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              요일 기준 특이 고객사 (전주 동일 요일 비교)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <FilterTab label="전체" count={data.weekdaySummary.total} active={weekdayFilter === "all"} onClick={() => setWeekdayFilter("all")} />
              <FilterTab label="전주 O → 금주 X" count={data.weekdaySummary.lapsed} active={weekdayFilter === "lapsed"} onClick={() => setWeekdayFilter("lapsed")} />
              <FilterTab label="전주 X → 금주 O" count={data.weekdaySummary.new} active={weekdayFilter === "new"} onClick={() => setWeekdayFilter("new")} />
              <FilterTab label="요일 미지정" count={data.weekdaySummary.unassigned} active={weekdayFilter === "unassigned"} onClick={() => setWeekdayFilter("unassigned")} />

              <div className="ml-auto flex items-center gap-3 text-xs">
                <span className="text-gray-500">순증:</span>
                <span className={`font-bold ${weekdayNetSummary.totalNet > 0 ? "text-blue-600" : weekdayNetSummary.totalNet < 0 ? "text-red-600" : "text-gray-400"}`}>
                  전체 {weekdayNetSummary.totalNet > 0 ? "+" : ""}{weekdayNetSummary.totalNet}
                </span>
                {weekdayNetSummary.productNets.map((pn) => (
                  <span key={pn.name} className="inline-flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: pn.color }} />
                    <span className={`font-medium ${pn.net > 0 ? "text-blue-600" : "text-red-600"}`}>
                      {pn.net > 0 ? "+" : ""}{pn.net}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <WeekdayTable
              clients={data.weekdayClients}
              filter={weekdayFilter}
              scope="total"
              productChips={data.productChips}
              targetDate={date}
            />
          </CardContent>
        </Card>

        {/* ──────────────── 수량 기준 이상치 ──────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                수량 기준 이상치 (전주 대비 차이 ±3 이상)
              </CardTitle>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">순증:</span>
                <span className={`font-bold ${qtyTotalNet > 0 ? "text-blue-600" : qtyTotalNet < 0 ? "text-red-600" : "text-gray-400"}`}>
                  전체 {qtyTotalNet > 0 ? "+" : ""}{qtyTotalNet}
                </span>
                {qtyProductNets.map((pn) => (
                  <span key={pn.name} className="inline-flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: pn.color }} />
                    <span className={`font-medium ${pn.net > 0 ? "text-blue-600" : "text-red-600"}`}>
                      {pn.net > 0 ? "+" : ""}{pn.net}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <QuantityTable
              clients={filteredQuantityClients}
              scope="total"
              productChips={data.productChips}
              targetDate={date}
            />
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
