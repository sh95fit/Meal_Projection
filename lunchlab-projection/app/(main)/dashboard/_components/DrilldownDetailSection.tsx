// app/(main)/dashboard/_components/DrilldownDetailSection.tsx (전체 교체)
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
// ★ 외부 컴포넌트 import (인라인 정의 제거)
import { WeekdayTable } from "./WeekdayTable";
import { QuantityTable } from "./QuantityTable";
import type {
  DrilldownDetailResponse,
  ViewScope,
  QuantityClient,
} from "@/types/dashboard";

// ─── Props ───
interface Props {
  data: DrilldownDetailResponse | null;
  date: string;
  loading: boolean;
  onClose: () => void;
}

type WeekdayFilter = "all" | "lapsed" | "new" | "unassigned";

// ─── 필터 탭 (색상 통일: 검은색 계열) ───
function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
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

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border p-3 text-center ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════
export function DrilldownDetailSection({ data, date, loading, onClose }: Props) {
  const [weekdayFilter, setWeekdayFilter] = useState<WeekdayFilter>("all");
  const [weekdayScope, setWeekdayScope] = useState<ViewScope>("total");
  const [qtyScope, setQtyScope] = useState<ViewScope>("total");

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

  // ★ 수량 기준 이상치 필터링: 요일 기준 고객 제외 + |diff| >= 3
  const weekdayAccountIds = new Set(data.weekdayClients.map((c) => c.accountId));
  const filteredQuantityClients: QuantityClient[] = data.quantityClients
    .filter((c) => !weekdayAccountIds.has(c.accountId) && Math.abs(c.diff ?? 0) >= 3)
    .map((c) => ({
      accountId: c.accountId,
      accountName: c.accountName,
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
        {/* ── 서머리 카드 ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="주문 고객사" value={data.orderedCount} />
          <SummaryCard label="미주문 고객사" value={data.unorderedCount} />
          <SummaryCard label="총 수량" value={data.totalQty.toLocaleString()} />
          <SummaryCard
            label="신규 주문"
            value={data.newCount}
            className="border-blue-200 bg-blue-50/50"
          />
          <SummaryCard
            label="이탈"
            value={data.lapsedCount}
            className="border-red-200 bg-red-50/50"
          />
        </div>

        {/* ── 상품 뱃지 ── */}
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

        {/* ── 요일 기준 특이 고객사 ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                요일 기준 특이 고객사 (전주 동일 요일 비교)
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={weekdayScope === "total" ? "default" : "outline"}
                  onClick={() => setWeekdayScope("total")}
                >
                  총 수량
                </Button>
                <Button
                  size="sm"
                  variant={weekdayScope === "product" ? "default" : "outline"}
                  onClick={() => setWeekdayScope("product")}
                >
                  상품별
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <FilterTab
                label="전체"
                count={data.weekdaySummary.total}
                active={weekdayFilter === "all"}
                onClick={() => setWeekdayFilter("all")}
              />
              <FilterTab
                label="전주 O → 금주 X"
                count={data.weekdaySummary.lapsed}
                active={weekdayFilter === "lapsed"}
                onClick={() => setWeekdayFilter("lapsed")}
              />
              <FilterTab
                label="전주 X → 금주 O"
                count={data.weekdaySummary.new}
                active={weekdayFilter === "new"}
                onClick={() => setWeekdayFilter("new")}
              />
              <FilterTab
                label="요일 미지정"
                count={data.weekdaySummary.unassigned}
                active={weekdayFilter === "unassigned"}
                onClick={() => setWeekdayFilter("unassigned")}
              />
            </div>

            {/* ★ 외부 WeekdayTable 컴포넌트 사용 */}
            <WeekdayTable
              clients={data.weekdayClients}
              filter={weekdayFilter}
              scope={weekdayScope}
              productChips={data.productChips}
            />
          </CardContent>
        </Card>

        {/* ── 수량 기준 이상치 ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                수량 기준 이상치 (전주 대비 차이 ±3 이상)
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={qtyScope === "total" ? "default" : "outline"}
                  onClick={() => setQtyScope("total")}
                >
                  총 수량
                </Button>
                <Button
                  size="sm"
                  variant={qtyScope === "product" ? "default" : "outline"}
                  onClick={() => setQtyScope("product")}
                >
                  상품별
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* ★ 외부 QuantityTable 컴포넌트 사용 */}
            <QuantityTable
              clients={filteredQuantityClients}
              scope={qtyScope}
              productChips={data.productChips}
            />
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
