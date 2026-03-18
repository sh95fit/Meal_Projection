// app/(main)/dashboard/_components/QuantityTable.tsx (전체 교체)
"use client";

import { Badge } from "@/components/ui/badge";
import type { QuantityClient, ProductChip, ViewScope } from "@/types/dashboard";

interface Props {
  clients: QuantityClient[];
  scope: ViewScope;
  productChips: ProductChip[];
  onClientClick?: (accountId: number) => void;
}

const thClass = "py-2 px-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap";
const thRight = "py-2 px-3 text-right text-xs font-medium text-gray-500 whitespace-nowrap";
const tdClass = "py-2.5 px-3";
const tdRight = "py-2.5 px-3 text-right";

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
      <div className="overflow-auto max-h-[420px] border rounded-md">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10 border-b">
            <tr>
              <th className={thClass}>고객사</th>
              <th className={thClass}>상품별 전주 → 금주 (±3 이상 강조)</th>
              <th className={thRight}>총 전주</th>
              <th className={thRight}>총 금주</th>
              <th className={thRight}>총 변화</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const tCls =
                c.totalDiff > 0 ? "text-green-600" : c.totalDiff < 0 ? "text-red-600" : "";
              const tArrow =
                c.totalDiff > 0 ? "▲" : c.totalDiff < 0 ? "▼" : "";

              return (
                <tr
                  key={c.accountId}
                  className={`border-b last:border-0 ${onClientClick ? "cursor-pointer" : ""} hover:bg-gray-50`}
                  onClick={() => onClientClick?.(c.accountId)}
                >
                  <td className={`${tdClass} font-semibold`}>{c.accountName}</td>
                  <td className={tdClass}>
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
                  </td>
                  <td className={tdRight}>{c.totalLast}</td>
                  <td className={tdRight}>{c.totalThis}</td>
                  <td className={`${tdRight} font-bold ${tCls}`}>
                    {tArrow} {Math.abs(c.totalDiff)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  /* ── 총 수량 모드 ── */
  return (
    <div className="overflow-auto max-h-[420px] border rounded-md">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white z-10 border-b">
          <tr>
            <th className={thClass}>고객사</th>
            <th className={thRight}>전주 총수량</th>
            <th className={thRight}>금주 총수량</th>
            <th className={thRight}>변화</th>
            <th className={thRight}>변화율</th>
            <th className={`${thClass} pl-6`}>주문 상품</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const cls =
              c.totalDiff > 0 ? "text-green-600" : c.totalDiff < 0 ? "text-red-600" : "";
            const arrow =
              c.totalDiff > 0 ? "▲" : c.totalDiff < 0 ? "▼" : "";
            const rate =
              c.totalLast > 0 ? Math.round((c.totalDiff / c.totalLast) * 100) : "—";

            return (
              <tr
                key={c.accountId}
                className={`border-b last:border-0 ${onClientClick ? "cursor-pointer" : ""} hover:bg-gray-50`}
                onClick={() => onClientClick?.(c.accountId)}
              >
                <td className={`${tdClass} font-semibold`}>{c.accountName}</td>
                <td className={tdRight}>{c.totalLast}</td>
                <td className={tdRight}>{c.totalThis}</td>
                <td className={`${tdRight} font-bold ${cls}`}>
                  {arrow} {Math.abs(c.totalDiff)}
                </td>
                <td className={`${tdRight} ${cls}`}>
                  {typeof rate === "number" ? `${rate}%` : rate}
                </td>
                <td className={`${tdClass} pl-6`}>
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
