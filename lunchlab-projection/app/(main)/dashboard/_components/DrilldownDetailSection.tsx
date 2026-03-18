// app/(main)/dashboard/_components/DrilldownDetailSection.tsx (전체 교체)
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import type {
  DrilldownDetailResponse,
  WeekdayCaseClient,
  QuantityAnomalyClient,
  ProductChip,
  ViewScope,
} from "@/types/dashboard";

// ─── Props ───
interface Props {
  data: DrilldownDetailResponse | null;
  date: string;
  loading: boolean;
  onClose: () => void;
}

// ─── 필터 타입 ───
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

// ─── 케이스 뱃지 (이탈=빨강, 신규=파랑, 미지정=회색 유지) ───
function CaseBadge({ caseType }: { caseType: string }) {
  switch (caseType) {
    case "lapsed":
      return (
        <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 text-[10px]">
          이탈
        </Badge>
      );
    case "new":
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 text-[10px]">
          신규
        </Badge>
      );
    case "unassigned":
    default:
      return (
        <Badge variant="outline" className="text-gray-500 border-gray-300 bg-gray-50 text-[10px]">
          미지정
        </Badge>
      );
  }
}

// ─── 차이 셀 (null-safe) ───
function DiffCell({ value }: { value: number | null | undefined }) {
  const num = value ?? 0;
  if (num === 0) return <span className="text-gray-400">-</span>;
  const color = num > 0 ? "text-blue-600" : "text-red-600";
  const prefix = num > 0 ? "+" : "";
  return <span className={`font-medium ${color}`}>{prefix}{num}</span>;
}

// ─── 변화율 셀 (null-safe) ───
function RateCell({ value }: { value: number | null | undefined }) {
  const num = value ?? 0;
  if (num === 0) return <span className="text-gray-400">-</span>;
  const color = num > 0 ? "text-blue-600" : "text-red-600";
  const prefix = num > 0 ? "+" : "";
  return <span className={`text-xs ${color}`}>{prefix}{num.toFixed(1)}%</span>;
}

// ─── 서머리 카드 ───
function SummaryCard({
  label,
  value,
  className,
  tooltip,
}: {
  label: string;
  value: string | number;
  className?: string;
  tooltip?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-center ${className ?? ""}`}
      title={tooltip}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

// ─── 상품 목록 (색상 마커 포함) ───
function ProductList({
  products,
  productChips,
}: {
  products: { productName: string; qty: number }[];
  productChips: ProductChip[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {products.map((p) => {
        const chip = productChips.find((c) => c.productName === p.productName);
        const color = chip?.color ?? "#6b7280";
        return (
          <span
            key={p.productName}
            className="inline-flex items-center gap-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5"
          >
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            {p.productName}
            <span className="text-gray-400 font-medium">{p.qty}</span>
          </span>
        );
      })}
    </div>
  );
}

// ─── 요일 기준 테이블 ───
function WeekdayTable({
  clients,
  filter,
  productChips,
}: {
  clients: WeekdayCaseClient[];
  filter: WeekdayFilter;
  productChips: ProductChip[];
}) {
  const filtered =
    filter === "all" ? clients : clients.filter((c) => c.case === filter);

  if (filtered.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">해당 항목이 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-3 font-medium">구분</th>
            <th className="py-2 pr-3 font-medium">고객사</th>
            <th className="py-2 pr-3 font-medium text-right">전주</th>
            <th className="py-2 pr-3 font-medium text-right">금주</th>
            <th className="py-2 pr-3 font-medium text-right">차이</th>
            <th className="py-2 pr-3 font-medium text-right">변화율</th>
            <th className="py-2 pl-6 font-medium">주문 상품</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((client) => (
            <tr key={client.accountId} className="border-b last:border-0 hover:bg-gray-50">
              <td className="py-2.5 pr-3">
                <CaseBadge caseType={client.case} />
              </td>
              <td className="py-2.5 pr-3 font-medium">{client.accountName}</td>
              <td className="py-2.5 pr-3 text-right">{client.lastWeekQty}</td>
              <td className="py-2.5 pr-3 text-right">{client.thisWeekQty}</td>
              <td className="py-2.5 pr-3 text-right">
                <DiffCell value={client.diff} />
              </td>
              <td className="py-2.5 pr-3 text-right">
                <RateCell value={client.changeRate} />
              </td>
              <td className="py-2.5 pl-6">
                <ProductList products={client.products} productChips={productChips} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 수량 기준 테이블 ───
function QuantityTable({
  clients,
  productChips,
}: {
  clients: QuantityAnomalyClient[];
  productChips: ProductChip[];
}) {
  if (clients.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">해당 항목이 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-3 font-medium">방향</th>
            <th className="py-2 pr-3 font-medium">고객사</th>
            <th className="py-2 pr-3 font-medium text-right">전주</th>
            <th className="py-2 pr-3 font-medium text-right">금주</th>
            <th className="py-2 pr-3 font-medium text-right">차이</th>
            <th className="py-2 pr-3 font-medium text-right">변화율</th>
            <th className="py-2 pl-6 font-medium">상품별 변동</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.accountId} className="border-b last:border-0 hover:bg-gray-50">
              <td className="py-2.5 pr-3">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    client.direction === "up"
                      ? "text-blue-600 border-blue-300 bg-blue-50"
                      : "text-red-600 border-red-300 bg-red-50"
                  }`}
                >
                  {client.direction === "up" ? "▲ 증가" : "▼ 감소"}
                </Badge>
              </td>
              <td className="py-2.5 pr-3 font-medium">{client.accountName}</td>
              <td className="py-2.5 pr-3 text-right">{client.lastWeekQty}</td>
              <td className="py-2.5 pr-3 text-right">{client.thisWeekQty}</td>
              <td className="py-2.5 pr-3 text-right">
                <DiffCell value={client.diff} />
              </td>
              <td className="py-2.5 pr-3 text-right">
                <RateCell value={client.changeRate} />
              </td>
              <td className="py-2.5 pl-6">
                <div className="flex flex-wrap gap-1.5">
                  {client.products.map((p) => {
                    const chip = productChips.find((c) => c.productName === p.productName);
                    const color = chip?.color ?? "#6b7280";
                    return (
                      <span
                        key={p.productName}
                        className="inline-flex items-center gap-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5"
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        {p.productName}
                        <DiffCell value={p.diff} />
                      </span>
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 메인 컴포넌트
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

  // ★ 수량 기준 이상치 필터링:
  //   1) 요일 기준 테이블에 이미 표시된 고객사 제외
  //   2) |diff| >= 3 인 고객사만 표시
  const weekdayAccountIds = new Set(
    data.weekdayClients.map((c) => c.accountId),
  );
  const filteredQuantityClients = data.quantityClients.filter(
    (c) => !weekdayAccountIds.has(c.accountId) && Math.abs(c.diff ?? 0) >= 3,
  );

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
            {/* 필터 탭 (검은색 통일) */}
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

            <WeekdayTable
              clients={data.weekdayClients}
              filter={weekdayFilter}
              productChips={data.productChips}
            />
          </CardContent>
        </Card>

        {/* ── 수량 기준 이상치 (요일 기준 고객 제외, 차이 ±3 이상) ── */}
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
            <QuantityTable
              clients={filteredQuantityClients}
              productChips={data.productChips}
            />
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
