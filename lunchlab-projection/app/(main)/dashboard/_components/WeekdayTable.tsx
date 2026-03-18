// app/(main)/dashboard/_components/WeekdayTable.tsx
"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { WeekdayClient, ViewScope, WeekdayCase } from "@/types/dashboard";

interface Props {
  clients: WeekdayClient[];
  scope: ViewScope;
  caseFilter: WeekdayCase;
  onClientClick: (accountId: number) => void;
}

const CASE_BADGE: Record<string, { label: string; cls: string }> = {
  churn: { label: "이탈", cls: "bg-red-50 text-red-700 border-red-200" },
  new: { label: "신규", cls: "bg-green-50 text-green-700 border-green-200" },
  unset: { label: "미지정", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function WeekdayTable({
  clients,
  scope,
  caseFilter,
  onClientClick,
}: Props) {
  const filtered =
    caseFilter === "all"
      ? clients
      : clients.filter((c) => c.case === caseFilter);

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        해당 조건의 고객사가 없습니다.
      </p>
    );
  }

  /* ── 상품별 모드 ── */
  if (scope === "product") {
    return (
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">구분</TableHead>
              <TableHead>고객사</TableHead>
              <TableHead>상품별 전주 → 금주</TableHead>
              <TableHead className="text-right">총 전주</TableHead>
              <TableHead className="text-right">총 금주</TableHead>
              <TableHead className="text-right">총 변화</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const diff = c.totalThis - c.totalLast;
              const diffCls =
                diff > 0
                  ? "text-green-600"
                  : diff < 0
                    ? "text-red-600"
                    : "";
              const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "";

              return (
                <TableRow
                  key={c.accountId}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onClientClick(c.accountId)}
                >
                  <TableCell>
                    <Badge variant="outline" className={CASE_BADGE[c.case].cls}>
                      {CASE_BADGE[c.case].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {c.accountName}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {c.products.map((p) => {
                        const d = p.thisWeekQty - (p.lastWeekQty || 0);
                        const cls =
                          d > 0
                            ? "text-green-600"
                            : d < 0
                              ? "text-red-600"
                              : "";
                        const ar = d > 0 ? "▲" : d < 0 ? "▼" : "";
                        return (
                          <div
                            key={p.productName}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <span className="w-14 truncate">
                              {p.productName}
                            </span>
                            <span className="w-6 text-right">
                              {p.lastWeekQty ?? "—"}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="w-6 text-right">
                              {p.thisWeekQty}
                            </span>
                            <span
                              className={`w-10 text-right font-bold ${cls}`}
                            >
                              {ar} {Math.abs(d)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {c.totalLast || "—"}
                  </TableCell>
                  <TableCell className="text-right">{c.totalThis}</TableCell>
                  <TableCell className={`text-right font-bold ${diffCls}`}>
                    {arrow} {Math.abs(diff)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  /* ── 총 수량 모드 ── */
  return (
    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">구분</TableHead>
            <TableHead>고객사</TableHead>
            <TableHead className="text-right">전주 총수량</TableHead>
            <TableHead className="text-right">금주 총수량</TableHead>
            <TableHead className="text-right">변화</TableHead>
            <TableHead className="text-right">변화율</TableHead>
            <TableHead>주문 상품</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((c) => {
            const diff = c.totalThis - c.totalLast;
            const diffCls =
              diff > 0
                ? "text-green-600"
                : diff < 0
                  ? "text-red-600"
                  : "";
            const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "";
            const rate =
              c.totalLast > 0
                ? Math.round((diff / c.totalLast) * 100)
                : c.totalThis > 0
                  ? "NEW"
                  : "—";

            return (
              <TableRow
                key={c.accountId}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => onClientClick(c.accountId)}
              >
                <TableCell>
                  <Badge variant="outline" className={CASE_BADGE[c.case].cls}>
                    {CASE_BADGE[c.case].label}
                  </Badge>
                </TableCell>
                <TableCell className="font-semibold">
                  {c.accountName}
                </TableCell>
                <TableCell className="text-right">
                  {c.totalLast || "—"}
                </TableCell>
                <TableCell className="text-right">{c.totalThis}</TableCell>
                <TableCell className={`text-right font-bold ${diffCls}`}>
                  {arrow} {Math.abs(diff)}
                </TableCell>
                <TableCell className={`text-right ${diffCls}`}>
                  {typeof rate === "number" ? `${rate}%` : rate}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.products
                    .map((p) => `${p.productName}(${p.thisWeekQty})`)
                    .join(", ")}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}