// app/(main)/dashboard/_components/QuantityTable.tsx (전체 교체)
"use client";

import type { QuantityClient, ProductChip, ViewScope } from "@/types/dashboard";

interface Props {
  clients: QuantityClient[];
  scope: ViewScope;
  productChips: ProductChip[];
  targetDate: string;                              // ★ 추가
  onClientClick?: (accountId: number) => void;
}

// ★ 구독 유지일수 계산
function calcRetentionDays(subscriptionAt: string | null, targetDate: string): number | null {
  if (!subscriptionAt) return null;
  const sub = subscriptionAt.slice(0, 10);
  const [sy, sm, sd] = sub.split("-").map(Number);
  const [ty, tm, td] = targetDate.split("-").map(Number);
  if (!sy || !sm || !sd || !ty || !tm || !td) return null;
  const subDate = new Date(sy, sm - 1, sd);
  const tgtDate = new Date(ty, tm - 1, td);
  const diffMs = tgtDate.getTime() - subDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return days >= 0 ? days : null;
}

const thClass = "py-2 px-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap";
const thRight = "py-2 px-3 text-right text-xs font-medium text-gray-500 whitespace-nowrap";
const tdClass = "py-2.5 px-3";
const tdRight = "py-2.5 px-3 text-right";

export function QuantityTable({ clients, scope, productChips, targetDate, onClientClick }: Props) {
  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        수량 변동 특이 고객사가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-auto max-h-[420px] border rounded-md">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white z-10 border-b">
          <tr>
            <th className={thClass}>고객사</th>
            <th className={thClass}>전환일</th>
            <th className={thRight}>요일주문횟수</th>
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
            const retentionDays = calcRetentionDays(c.subscriptionAt, targetDate);

            return (
              <tr
                key={c.accountId}
                className={`border-b last:border-0 ${onClientClick ? "cursor-pointer" : ""} hover:bg-gray-50`}
                onClick={() => onClientClick?.(c.accountId)}
              >
                <td className={`${tdClass} font-semibold`}>{c.accountName}</td>
                <td className={`${tdClass} text-xs text-gray-500 whitespace-nowrap`}>
                  {c.subscriptionAt ? (
                    <>
                      {c.subscriptionAt.slice(0, 10)}
                      {retentionDays !== null && (
                        <span className="text-gray-400 ml-1">({retentionDays}일)</span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className={`${tdRight} text-xs`}>{c.dowOrderCount}회</td>
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
                            className="inline-block w-2 h-2 rounded-full shrink-0"
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
