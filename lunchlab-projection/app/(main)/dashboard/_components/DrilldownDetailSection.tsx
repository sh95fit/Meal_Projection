"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  DrilldownDetailResponse,
  WeekdayCaseClient,
  QuantityAnomalyClient,
  WeekdayCaseSummary,
} from "@/types/dashboard";

// ──────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────

interface Props {
  data: DrilldownDetailResponse | null;
  date: string;
  loading: boolean;
  onClose: () => void;
}

type WeekdayFilter = "all" | "lapsed" | "new" | "unassigned";
type QtyScope = "total" | "product";

// ──────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────────────────────────

export function DrilldownDetailSection({ data, date, loading, onClose }: Props) {
  const [weekdayFilter, setWeekdayFilter] = useState<WeekdayFilter>("all");
  const [weekdayScope, setWeekdayScope] = useState<QtyScope>("total");
  const [qtyScope, setQtyScope] = useState<QtyScope>("total");

  // ── 로딩 ──
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          드릴다운 데이터를 불러오는 중...
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const {
    targetDate,
    dow,
    orderedCount,
    unorderedCount,
    totalQty,
    newCount,
    lapsedCount,
    productChips,
    weekdayClients,
    weekdaySummary,
    quantityClients,
  } = data;

  // 요일 필터링
  const filteredWeekdayClients = weekdayFilter === "all"
    ? weekdayClients
    : weekdayClients.filter((c) => c.case === weekdayFilter);

  return (
    <div className="space-y-4">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {targetDate} ({dow}) 상세 분석
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕ 닫기
        </Button>
      </div>

      {/* ── 요약 카드 (5칸) ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="주문 고객사" value={`${orderedCount}곳`} />
        <SummaryCard label="미주문 고객사" value={`${unorderedCount}곳`} />
        <SummaryCard label="총 주문량" value={`${totalQty}식`} />
        <SummaryCard
          label="신규 주문"
          value={`+${newCount}`}
          valueClass="text-green-500"
          tooltip="전주 동일 요일에 주문이 없었으나 금주에 주문한 고객사 수"
        />
        <SummaryCard
          label="이탈(미주문)"
          value={`-${lapsedCount}`}
          valueClass="text-red-500"
          tooltip="전주 동일 요일에 주문이 있었으나 금주에 주문하지 않은 고객사 수"
        />
      </div>

      {/* ── 상품별 배지 ── */}
      <div className="flex flex-wrap gap-2">
        {productChips.map((chip) => (
          <Badge
            key={chip.productId}
            variant="outline"
            style={{ borderColor: chip.color, color: chip.color }}
          >
            {chip.productName}: {chip.qty}식
          </Badge>
        ))}
      </div>

      {/* ── 요일 기준 특이 고객사 ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              요일 기준 특이 고객사 (전주 동일 요일 비교)
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant={weekdayScope === "total" ? "default" : "outline"}
                size="sm"
                onClick={() => setWeekdayScope("total")}
              >
                총 수량
              </Button>
              <Button
                variant={weekdayScope === "product" ? "default" : "outline"}
                size="sm"
                onClick={() => setWeekdayScope("product")}
              >
                상품별
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 케이스 필터 탭 */}
          <div className="flex flex-wrap gap-2 mb-3">
            <FilterTab
              label={`전체 ${weekdaySummary.total}`}
              active={weekdayFilter === "all"}
              onClick={() => setWeekdayFilter("all")}
            />
            <FilterTab
              label={`전주O → 금주X ${weekdaySummary.lapsed}`}
              active={weekdayFilter === "lapsed"}
              onClick={() => setWeekdayFilter("lapsed")}
              variant="destructive"
            />
            <FilterTab
              label={`전주X → 금주O ${weekdaySummary.new}`}
              active={weekdayFilter === "new"}
              onClick={() => setWeekdayFilter("new")}
              variant="default"
            />
            <FilterTab
              label={`요일 미지정 ${weekdaySummary.unassigned}`}
              active={weekdayFilter === "unassigned"}
              onClick={() => setWeekdayFilter("unassigned")}
              variant="secondary"
            />
          </div>

          <WeekdayTable
            clients={filteredWeekdayClients}
            scope={weekdayScope}
          />
        </CardContent>
      </Card>

      {/* ── 수량 기준 특이 고객사 ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              수량 기준 특이 고객사 (전주 대비 ±3 이상 변화)
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant={qtyScope === "total" ? "default" : "outline"}
                size="sm"
                onClick={() => setQtyScope("total")}
              >
                총 수량
              </Button>
              <Button
                variant={qtyScope === "product" ? "default" : "outline"}
                size="sm"
                onClick={() => setQtyScope("product")}
              >
                상품별
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <QuantityTable clients={quantityClients} scope={qtyScope} />
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 서브 컴포넌트: SummaryCard
// ──────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  valueClass,
  tooltip,
}: {
  label: string;
  value: string;
  valueClass?: string;
  tooltip?: string;
}) {
  return (
    <Card className="bg-muted/50" title={tooltip}>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground mb-1">
          {label}
          {tooltip && (
            <span className="ml-1 text-muted-foreground/50 cursor-help" title={tooltip}>
              ⓘ
            </span>
          )}
        </p>
        <p className={`text-xl font-bold ${valueClass || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// 서브 컴포넌트: FilterTab
// ──────────────────────────────────────────────────────────────────

function FilterTab({
  label,
  active,
  onClick,
  variant = "default",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  variant?: "default" | "destructive" | "secondary";
}) {
  return (
    <Badge
      variant={active ? variant : "outline"}
      className="cursor-pointer"
      onClick={onClick}
    >
      {label}
    </Badge>
  );
}

// ──────────────────────────────────────────────────────────────────
// 서브 컴포넌트: WeekdayTable
// ──────────────────────────────────────────────────────────────────

const caseLabel: Record<string, string> = {
  lapsed: "이탈",
  new: "신규",
  unassigned: "미지정",
};

const caseBadgeVariant: Record<string, "destructive" | "default" | "secondary"> = {
  lapsed: "destructive",
  new: "default",
  unassigned: "secondary",
};

function WeekdayTable({
  clients,
  scope,
}: {
  clients: WeekdayCaseClient[];
  scope: QtyScope;
}) {
  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        해당 케이스 없음
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-3">구분</th>
            <th className="py-2 pr-3">고객사</th>
            <th className="py-2 pr-3 text-right">전주 총수량</th>
            <th className="py-2 pr-3 text-right">금주 총수량</th>
            <th className="py-2 pr-3 text-right">변화</th>
            <th className="py-2 pr-3 text-right">변화율</th>
            <th className="py-2">주문 상품</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={`${c.case}-${c.accountId}`} className="border-b">
              <td className="py-2 pr-3">
                <Badge variant={caseBadgeVariant[c.case]}>
                  {caseLabel[c.case]}
                </Badge>
              </td>
              <td className="py-2 pr-3 font-medium">{c.accountName}</td>
              <td className="py-2 pr-3 text-right">
                {c.lastWeekQty > 0 ? c.lastWeekQty : "—"}
              </td>
              <td className="py-2 pr-3 text-right">
                {c.thisWeekQty > 0 ? c.thisWeekQty : "—"}
              </td>
              <td className="py-2 pr-3 text-right">
                <DiffCell value={c.diff} />
              </td>
              <td className="py-2 pr-3 text-right">
                <RateCell rate={c.changeRate} />
              </td>
              <td className="py-2 text-xs text-muted-foreground">
                {scope === "total"
                  ? c.products.map((p) => `${p.productName}(${p.qty})`).join(", ")
                  : c.products.map((p) => (
                      <span key={p.productName} className="mr-2">
                        {p.productName}({p.qty})
                      </span>
                    ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 서브 컴포넌트: QuantityTable
// ──────────────────────────────────────────────────────────────────

function QuantityTable({
  clients,
  scope,
}: {
  clients: QuantityAnomalyClient[];
  scope: QtyScope;
}) {
  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        수량 이상 고객사 없음
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-3">고객사</th>
            <th className="py-2 pr-3 text-right">전주 총수량</th>
            <th className="py-2 pr-3 text-right">금주 총수량</th>
            <th className="py-2 pr-3 text-right">변화</th>
            <th className="py-2 pr-3 text-right">변화율</th>
            <th className="py-2">주문 상품</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.accountId} className="border-b">
              <td className="py-2 pr-3 font-medium">{c.accountName}</td>
              <td className="py-2 pr-3 text-right">
                {c.lastWeekQty > 0 ? c.lastWeekQty : "—"}
              </td>
              <td className="py-2 pr-3 text-right">{c.thisWeekQty}</td>
              <td className="py-2 pr-3 text-right">
                <DiffCell value={c.diff} />
              </td>
              <td className="py-2 pr-3 text-right">
                <RateCell rate={c.changeRate} />
              </td>
              <td className="py-2 text-xs text-muted-foreground">
                {scope === "total"
                  ? c.products.map((p) => (
                      <span key={p.productName} className="mr-2">
                        {p.productName}({p.thisWeek})
                      </span>
                    ))
                  : c.products.map((p) => (
                      <span key={p.productName} className="mr-2">
                        {p.productName}({p.thisWeek}
                        {p.diff !== 0 && (
                          <span className={p.diff > 0 ? "text-green-500" : "text-red-500"}>
                            {p.diff > 0 ? "+" : ""}{p.diff}
                          </span>
                        )}
                        )
                      </span>
                    ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 공통 셀 컴포넌트
// ──────────────────────────────────────────────────────────────────

function DiffCell({ value }: { value: number }) {
  if (value === 0) return <span className="text-gray-400">—</span>;
  const color = value > 0 ? "text-green-500" : "text-red-500";
  const icon = value > 0 ? "▲" : "▼";
  return (
    <span className={`font-semibold ${color}`}>
      {icon} {Math.abs(value)}
    </span>
  );
}

function RateCell({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-green-500 font-semibold">NEW</span>;
  if (rate === 0) return <span className="text-gray-400">0%</span>;
  const color = rate > 0 ? "text-green-500" : "text-red-500";
  return (
    <span className={`font-semibold ${color}`}>
      {rate > 0 ? "+" : ""}{rate}%
    </span>
  );
}
