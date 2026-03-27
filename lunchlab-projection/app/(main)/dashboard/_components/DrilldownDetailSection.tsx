// app/(main)/dashboard/_components/DrilldownDetailSection.tsx
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

interface Props {
  data: DrilldownDetailResponse | null;
  date: string;
  loading: boolean;
  onClose: () => void;
}

type WeekdayFilter = "all" | "lapsed" | "new" | "unassigned";

function FilterTab({
  label, count, active, onClick,
}: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 lg:px-3 lg:py-1.5 rounded-full text-[10px] lg:text-xs font-medium border transition-all shrink-0 ${
        active
          ? "bg-gray-900 text-white border-gray-900"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
      <span className={`text-[9px] lg:text-[10px] ${active ? "text-gray-300" : "text-gray-400"}`}>
        {count}
      </span>
    </button>
  );
}

function SummaryCard({
  label, value, className,
}: {
  label: string; value: string | number; className?: string;
}) {
  return (
    <div className={`rounded-lg border p-2 lg:p-3 text-center ${className ?? ""}`}>
      <p className="text-[10px] lg:text-xs text-muted-foreground">{label}</p>
      <p className="text-lg lg:text-xl font-bold mt-0.5 lg:mt-1">{value}</p>
    </div>
  );
}

/* ── computeNetSummary — 전체 순증 = 상품별 순증 합계 정합성 보장 ── */
function computeNetSummary(
  clients: WeekdayCaseClient[],
  filter: WeekdayFilter,
  productChips: ProductChip[],
) {
  const filtered = filter === "all" ? clients : clients.filter((c) => c.case === filter);

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

/* ── 순증 표시 컴포넌트 (모바일 줄바꿈 대응) ── */
function NetSummaryDisplay({ totalNet, productNets }: { totalNet: number; productNets: { name: string; color: string; net: number }[] }) {
  return (
    <div className="flex items-center gap-2 lg:gap-3 text-xs flex-wrap">
      <span className="text-gray-500">순증:</span>
      <span className={`font-bold ${totalNet > 0 ? "text-blue-600" : totalNet < 0 ? "text-red-600" : "text-gray-400"}`}>
        전체 {totalNet > 0 ? "+" : ""}{totalNet}
      </span>
      {productNets.map((pn) => (
        <span key={pn.name} className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: pn.color }} />
          <span className={`font-medium ${pn.net > 0 ? "text-blue-600" : "text-red-600"}`}>
            {pn.net > 0 ? "+" : ""}{pn.net}
          </span>
        </span>
      ))}
    </div>
  );
}

export function DrilldownDetailSection({ data, date, loading, onClose }: Props) {
  const [weekdayFilter, setWeekdayFilter] = useState<WeekdayFilter>("all");

  const weekdayNetSummary = useMemo(() => {
    if (!data) return { totalNet: 0, productNets: [] };
    return computeNetSummary(data.weekdayClients, weekdayFilter, data.productChips);
  }, [data, weekdayFilter]);

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

  return (
    <Card>
      <CardHeader className="pb-2 lg:pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base lg:text-lg">
            📅 {date} ({data.dow}) 상세 분석
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 lg:space-y-6">
        {/* Summary Cards — 모바일 2열, 태블릿+ 5열 */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 lg:gap-3">
          <SummaryCard label="주문 고객사" value={data.orderedCount} />
          <SummaryCard label="미주문 고객사" value={data.unorderedCount} />
          <SummaryCard label="총 수량" value={data.totalQty.toLocaleString()} />
          <SummaryCard label="신규 주문" value={data.newCount} className="border-blue-200 bg-blue-50/50" />
          <SummaryCard label="이탈" value={data.lapsedCount} className="border-red-200 bg-red-50/50" />
        </div>

        {/* Product Chips — 가로 스크롤 */}
        <div className="flex flex-wrap gap-1.5 lg:gap-2">
          {data.productChips.map((chip) => (
            <span
              key={chip.productId}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 lg:px-3 lg:py-1 text-[10px] lg:text-xs font-medium text-white"
              style={{ backgroundColor: chip.color }}
            >
              {chip.productName}
              <span className="text-white/80">{chip.qty}</span>
            </span>
          ))}
        </div>

        {/* 요일 기준 특이 고객사 */}
        <Card>
          <CardHeader className="pb-2 lg:pb-3">
            <CardTitle className="text-sm lg:text-base">
              요일 기준 특이 고객사 (전주 동일 요일 비교)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 필터 탭 — 가로 스크롤 */}
            <div className="flex items-center gap-1.5 lg:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <FilterTab label="전체" count={data.weekdaySummary.total} active={weekdayFilter === "all"} onClick={() => setWeekdayFilter("all")} />
              <FilterTab label="전주O→금주X" count={data.weekdaySummary.lapsed} active={weekdayFilter === "lapsed"} onClick={() => setWeekdayFilter("lapsed")} />
              <FilterTab label="전주X→금주O" count={data.weekdaySummary.new} active={weekdayFilter === "new"} onClick={() => setWeekdayFilter("new")} />
              <FilterTab label="요일 미지정" count={data.weekdaySummary.unassigned} active={weekdayFilter === "unassigned"} onClick={() => setWeekdayFilter("unassigned")} />
            </div>

            {/* 순증 — 별도 줄 */}
            <NetSummaryDisplay totalNet={weekdayNetSummary.totalNet} productNets={weekdayNetSummary.productNets} />

            <WeekdayTable
              clients={data.weekdayClients}
              filter={weekdayFilter}
              scope="total"
              productChips={data.productChips}
              targetDate={date}
            />
          </CardContent>
        </Card>

        {/* 수량 기준 이상치 */}
        <Card>
          <CardHeader className="pb-2 lg:pb-3">
            <div className="space-y-2">
              <CardTitle className="text-sm lg:text-base">
                수량 기준 이상치 (전주 대비 차이 ±3 이상)
              </CardTitle>
              <NetSummaryDisplay totalNet={qtyTotalNet} productNets={qtyProductNets} />
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
