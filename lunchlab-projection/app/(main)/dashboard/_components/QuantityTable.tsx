// app/(main)/dashboard/_components/QuantityTable.tsx (전체 교체)
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
import type { QuantityClient, ProductChip, ViewScope } from "@/types/dashboard";

interface Props {
  clients: QuantityClient[];
  scope: ViewScope;
  productChips: ProductChip[];
  onClientClick?: (accountId: number) => void;
}

export function QuantityTable({ clients, scope, productChips, onClientClick }: Props) {
  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
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
                c.totalDiff > 0 ? "text-green-600" : c.totalDiff < 0 ? "text-red-600" : "";
              const tArrow =
                c.totalDiff > 0 ? "▲" : c.totalDiff < 0 ? "▼" : "";

              return (
                <TableRow
                  key={c.accountId}
                  className={onClientClick ? "cursor-pointer hover:bg-gray-50" : "hover:bg-gray-50"}
                  onClick={() => onClientClick?.(c.accountId)}
                >
                  <TableCell className="font-semibold">{c.accountName}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {c.products.map((p) => {
                        const highlight = Math.abs(p.diff) >= 3;
                        const chip = productChips.find((ch) => ch.productName === p.productName);
                        const color = chip?.color ?? "#6b7280";
                        const cls =
                          p.diff > 0 ? "text-green-600" : p.diff < 0 ? "text-red-600" : "";
                        const prefix = p.diff > 0 ? "+" : "";

                        return (
                          <div
                            key={p.productName}
                            className={`flex items-center gap-1.5 text-xs ${
                              highlight ? "font-bold" : "opacity-50"
                            }`}
                          >
                            <span
                              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="w-14 truncate">{p.productName}</span>
                            <span className="text-gray-500">{p.lastWeekQty}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-gray-700">{p.thisWeekQty}</span>
                            <span className={`font-bold ${cls}`}>
                              ({prefix}{p.diff})
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
            <TableHead className="pl-6">주문 상품</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => {
            const cls =
              c.totalDiff > 0 ? "text-green-600" : c.totalDiff < 0 ? "text-red-600" : "";
            const arrow =
              c.totalDiff > 0 ? "▲" : c.totalDiff < 0 ? "▼" : "";
            const rate =
              c.totalLast > 0 ? Math.round((c.totalDiff / c.totalLast) * 100) : "—";

            return (
              <TableRow
                key={c.accountId}
                className={onClientClick ? "cursor-pointer hover:bg-gray-50" : "hover:bg-gray-50"}
                onClick={() => onClientClick?.(c.accountId)}
              >
                <TableCell className="font-semibold">{c.accountName}</TableCell>
                <TableCell className="text-right">{c.totalLast}</TableCell>
                <TableCell className="text-right">{c.totalThis}</TableCell>
                <TableCell className={`text-right font-bold ${cls}`}>
                  {arrow} {Math.abs(c.totalDiff)}
                </TableCell>
                <TableCell className={`text-right ${cls}`}>
                  {typeof rate === "number" ? `${rate}%` : rate}
                </TableCell>
                {/* ★ 상품명 전주→금주 (±차이) 형태 */}
                <TableCell className="pl-6">
                  <div className="flex flex-wrap gap-1.5">
                    {c.products.map((p) => {
                      const chip = productChips.find((ch) => ch.productName === p.productName);
                      const color = chip?.color ?? "#6b7280";
                      const diff = p.diff;
                      const diffColor =
                        diff > 0 ? "text-blue-600" : diff < 0 ? "text-red-600" : "text-gray-400";
                      const diffPrefix = diff > 0 ? "+" : "";

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
                          <span className="text-gray-500">{p.lastWeekQty}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-gray-700 font-medium">{p.thisWeekQty}</span>
                          <span className={`font-medium ${diffColor}`}>
                            ({diffPrefix}{diff})
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}