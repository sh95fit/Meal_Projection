// app/(main)/dashboard/_components/TrendChartSection.tsx (전체 교체)
"use client";

import { ReactElement } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, Rectangle,
} from "recharts";
import type { LabelProps, BarShapeProps, BarRectangleItem } from "recharts";
import type { TrendResponse, TrendRow, PeriodPreset } from "@/types/dashboard";

// ─── Props ───
interface Props {
  data: TrendResponse | null;
  onBarClick?: (date: string) => void;
  activeDate?: string | null;
  preset: PeriodPreset;
  customStart: string;
  customEnd: string;
  excludedProducts: Set<string>;
  onPresetChange: (p: PeriodPreset) => void;
  onCustomRangeChange: (start: string, end: string) => void;
  onToggleProduct: (name: string) => void;
}

// ─── 프리셋 옵션 ("기간 지정" 추가) ───
const TREND_PRESETS: { label: string; value: PeriodPreset }[] = [
  { label: "올해",   value: "year" },
  { label: "7일",    value: "7d" },
  { label: "30일",   value: "30d" },
  { label: "2개월",  value: "60d" },
  { label: "90일",   value: "90d" },
  { label: "기간 지정", value: "custom" },
];

// ─── 활성 날짜 하이라이트용 shape 함수 ───
function makeHighlightShape(activeDate: string | null | undefined) {
  return function HighlightBar(props: BarShapeProps) {
    const payload = (props as BarShapeProps & { payload?: TrendRow }).payload;
    const isActive = activeDate && payload?.date === activeDate;

    return (
      <Rectangle
        {...props}
        fillOpacity={isActive ? 1 : 0.85}
        stroke={isActive ? "#1e40af" : "none"}
        strokeWidth={isActive ? 2 : 0}
      />
    );
  };
}

// ─── 합계 라벨 (스택 맨 위 Bar 상단에 표시) ───
function TotalLabel(props: LabelProps): ReactElement | null {
  const { viewBox, value } = props;
  const numVal = typeof value === "number" ? value : Number(value);
  if (!numVal || numVal === 0) return null;

  const vb = viewBox as { x?: number; y?: number; width?: number } | undefined;
  const x = (vb?.x ?? 0) + (vb?.width ?? 0) / 2;
  const y = (vb?.y ?? 0) - 8;

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={10}
      fontWeight={700}
      fill="#374151"
    >
      {numVal.toLocaleString()}
    </text>
  );
}

// ─── 개별 상품 수량 라벨 ───
function ProductValueLabel(props: LabelProps): ReactElement | null {
  const { value, viewBox } = props;
  const numVal = typeof value === "number" ? value : Number(value);
  if (!numVal || numVal === 0) return null;

  const vb = viewBox as { x?: number; y?: number; width?: number; height?: number } | undefined;
  const h = vb?.height ?? 0;
  const w = vb?.width ?? 0;
  const x = (vb?.x ?? 0) + w / 2;

  const textLen = numVal.toLocaleString().length * 6;
  if (h < 16 || w < textLen + 4) return null;

  const y = (vb?.y ?? 0) + h / 2 + 4;

  return (
    <text x={x} y={y} textAnchor="middle" fontSize={9} fill="#fff">
      {numVal.toLocaleString()}
    </text>
  );
}

export function TrendChartSection({
  data,
  onBarClick,
  activeDate,
  preset,
  customStart,
  customEnd,
  excludedProducts,
  onPresetChange,
  onCustomRangeChange,
  onToggleProduct,
}: Props) {
  if (!data || data.rows.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">과거 주문 이력</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm">데이터가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  const visibleProducts = data.productList.filter(
    (p) => !excludedProducts.has(p.productName)
  );

  const filteredRows: TrendRow[] = data.rows.map((row) => {
    const newRow: TrendRow = { date: row.date, dayLabel: row.dayLabel, _total: 0 };
    let total = 0;
    for (const p of visibleProducts) {
      const val = Number(row[p.productName] || 0);
      newRow[p.productName] = val;
      total += val;
    }
    newRow._total = total;
    return newRow;
  });

  const handleBarClick = (
    data: BarRectangleItem,
    _index: number,
    _event: React.MouseEvent<SVGPathElement, MouseEvent>,
  ) => {
    if (!onBarClick) return;
    const payload = data?.payload as TrendRow | undefined;
    if (payload?.date) {
      onBarClick(String(payload.date));
    }
  };

  const showProductLabels = visibleProducts.length > 1;
  const highlightShape = makeHighlightShape(activeDate);
  const lastProductIndex = visibleProducts.length - 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">과거 주문 이력</CardTitle>
          {onBarClick && (
            <p className="text-xs text-muted-foreground">
              막대를 클릭하면 해당 일자의 상세 드릴다운을 확인할 수 있습니다.
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* ── 기간 필터 ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {TREND_PRESETS.map((opt) => (
            <Button
              key={opt.value}
              variant={preset === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => onPresetChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}

          {/* ★ "기간 지정" 탭 선택 시에만 날짜 입력 표시 */}
          {preset === "custom" && (
            <div className="flex items-center gap-1 ml-2">
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={customStart}
                onChange={(e) => onCustomRangeChange(e.target.value, customEnd)}
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={customEnd}
                onChange={(e) => onCustomRangeChange(customStart, e.target.value)}
              />
            </div>
          )}
        </div>

        {/* ── 상품 필터 (포함/제외) ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">상품:</span>
          {data.productList.map((p) => {
            const isExcluded = excludedProducts.has(p.productName);
            return (
              <button
                key={p.productId}
                type="button"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  isExcluded
                    ? "bg-gray-100 text-gray-400 border-gray-200 line-through"
                    : "text-white border-transparent"
                }`}
                style={isExcluded ? {} : { backgroundColor: p.color }}
                onClick={() => onToggleProduct(p.productName)}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: isExcluded ? "#d1d5db" : "#fff" }}
                />
                {p.productName}
              </button>
            );
          })}
        </div>

        {/* ── 차트 ── */}
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={filteredRows}
            margin={{ top: 25, right: 10, left: 10, bottom: 0 }}
            style={{ cursor: onBarClick ? "pointer" : "default" }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => {
                if (Array.isArray(value)) return value.join(", ");
                return value != null ? Number(value).toLocaleString() : "0";
              }}
            />
            <Legend />
            {visibleProducts.map((product, idx) => (
              <Bar
                key={product.productId}
                dataKey={product.productName}
                stackId="stack"
                fill={product.color}
                name={product.productName}
                onClick={handleBarClick}
                shape={highlightShape}
              >
                {showProductLabels && (
                  <LabelList
                    dataKey={product.productName}
                    content={ProductValueLabel}
                  />
                )}
                {idx === lastProductIndex && (
                  <LabelList
                    dataKey="_total"
                    position="top"
                    content={TotalLabel}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
