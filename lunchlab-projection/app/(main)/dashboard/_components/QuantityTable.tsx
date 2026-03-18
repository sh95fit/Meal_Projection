// app/(main)/dashboard/_components/QuantityTable.tsx
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
import type { QuantityClient, ViewScope } from "@/types/dashboard";

interface Props {
  clients: QuantityClient[];
  scope: ViewScope;
  onClientClick: (accountId: number) => void;
}

export function QuantityTable({ clients, scope, onClientClick }: Props) {
  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        수량 변동 특이 고객사가 없습니다.
      </p>
    );
  }

  /* ── 상품별 모드: ±3 이상 강조 ── */
  if (scope === "product") {
    return (
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>고객사</TableHead>
              <TableHead>상품별 전주 → 금주 (±3 이상 강조)</TableHead>
              <TableHead className="text-right">총 전주</TableHead>
              <TableHead className="text-right">총 금주</TableHead>
              <TableHead className="text-right">총 변화</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => {
              const tCls =
                c.totalDiff > 0
                  ? "text-green-600"
                  : c.totalDiff < 0
                    ? "text-red-600"
                    : "";
              const tArrow =
                c.totalDiff > 0 ? "▲" : c.totalDiff < 0 ? "▼" : "";

              return (
                <TableRow
                  key={c.accountId}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onClientClick(c.accountId)}
                >
                  <TableCell className="font-semibold">
                    {c.accountName}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {c.products.map((p) => {
                        const highlight = Math.abs(p.diff) >= 3;
                        const cls =
                          p.diff > 0
                            ? "text-green-600"
                            : p.diff < 0
                              ? "text-red-600"
                              : "";
                        const ar = p.diff > 0 ? "▲" : p.diff < 0 ? "▼" : "";

                        return (
                          <div
                            key={p.productName}
                            className={`flex items-center gap-1.5 text-xs ${
                              highlight ? "font-bold" : "opacity-50"
                            }`}
                          >
                            <span className="w-14 truncate">
                              {p.productName}
                            </span>
                            <span className="w-6 text-right">
                              {p.lastWeekQty}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="w-6 text-right">
                              {p.thisWeekQty}
                            </span>
                            <span
                              className={`w-10 text-right font-bold ${cls}`}
                            >
                              {ar} {Math.abs(p.diff)}
                            </span>
                            {highlight && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] px-1 py-0"
                              >
                                ±3↑
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{c.totalLast}</TableCell>
                  <TableCell className="text-right">{c.totalThis}</TableCell>
                  <TableCell className={`text-right font-bold ${tCls}`}>
                    {tArrow} {Math.abs(c.totalDiff)}
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
            <TableHead>고객사</TableHead>
            <TableHead className="text-right">전주 총수량</TableHead>
            <TableHead className="text-right">금주 총수량</TableHead>
            <TableHead className="text-right">변화</TableHead>
            <TableHead className="text-right">변화율</TableHead>
            <TableHead>주문 상품</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => {
            const cls =
              c.totalDiff > 0
                ? "text-green-600"
                : c.totalDiff < 0
                  ? "text-red-600"
                  : "";
            const arrow =
              c.totalDiff > 0 ? "▲" : c.totalDiff < 0 ? "▼" : "";
            const rate =
              c.totalLast > 0
                ? Math.round((c.totalDiff / c.totalLast) * 100)
                : "—";

            return (
              <TableRow
                key={c.accountId}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => onClientClick(c.accountId)}
              >
                <TableCell className="font-semibold">
                  {c.accountName}
                </TableCell>
                <TableCell className="text-right">{c.totalLast}</TableCell>
                <TableCell className="text-right">{c.totalThis}</TableCell>
                <TableCell className={`text-right font-bold ${cls}`}>
                  {arrow} {Math.abs(c.totalDiff)}
                </TableCell>
                <TableCell className={`text-right ${cls}`}>
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