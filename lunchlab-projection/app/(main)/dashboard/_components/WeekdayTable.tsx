// app/(main)/dashboard/_components/WeekdayTable.tsx (전체 교체)
"use client";

import { Badge } from "@/components/ui/badge";
import type { WeekdayCaseClient, WeekdayCase, ProductChip, ViewScope } from "@/types/dashboard";

type WeekdayFilter = WeekdayCase | "all";
type WeekdayProduct = { productName: string; qty: number };

interface Props {
  clients: WeekdayCaseClient[];
  filter: WeekdayFilter;
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

function DiffCell({ value }: { value: number | null | undefined }) {
  const num = value ?? 0;
  if (num === 0) return <span className="text-gray-400">-</span>;
  const color = num > 0 ? "text-blue-600" : "text-red-600";
  const prefix = num > 0 ? "+" : "";
  return <span className={`font-medium ${color}`}>{prefix}{num}</span>;
}

function RateCell({ value }: { value: number | null | undefined }) {
  const num = value ?? 0;
  if (num === 0) return <span className="text-gray-400">-</span>;
  const color = num > 0 ? "text-blue-600" : "text-red-600";
  const prefix = num > 0 ? "+" : "";
  return <span className={`text-xs ${color}`}>{prefix}{num.toFixed(1)}%</span>;
}

const thClass = "py-2 px-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap";
const thRight = "py-2 px-3 text-right text-xs font-medium text-gray-500 whitespace-nowrap";
const tdClass = "py-2.5 px-3";
const tdRight = "py-2.5 px-3 text-right";

export function WeekdayTable({ clients, filter, scope, productChips, targetDate, onClientClick }: Props) {
  const filtered =
    filter === "all" ? clients : clients.filter((c) => c.case === filter);

  if (filtered.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">해당 항목이 없습니다.</p>;
  }

  return (
    <div className="overflow-auto max-h-[420px] border rounded-md">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white z-10 border-b">
          <tr>
            <th className={thClass}>구분</th>
            <th className={thClass}>고객사</th>
            <th className={thClass}>전환일</th>
            <th className={thRight}>요일주문횟수</th>
            <th className={thRight}>전주</th>
            <th className={thRight}>금주</th>
            <th className={thRight}>차이</th>
            <th className={thRight}>변화율</th>
            <th className={`${thClass} pl-6`}>주문 상품</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((client) => {
            const retentionDays = calcRetentionDays(client.subscriptionAt, targetDate);

            return (
              <tr
                key={client.accountId}
                className={`border-b last:border-0 ${onClientClick ? "cursor-pointer" : ""} hover:bg-gray-50`}
                onClick={() => onClientClick?.(client.accountId)}
              >
                <td className={tdClass}><CaseBadge caseType={client.case} /></td>
                <td className={`${tdClass} font-semibold`}>{client.accountName}</td>
                <td className={`${tdClass} text-xs text-gray-500 whitespace-nowrap`}>
                  {client.subscriptionAt ? (
                    <>
                      {client.subscriptionAt.slice(0, 10)}
                      {retentionDays !== null && (
                        <span className="text-gray-400 ml-1">({retentionDays}일)</span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className={`${tdRight} text-xs`}>{client.dowOrderCount}회</td>
                <td className={tdRight}>{client.lastWeekQty}</td>
                <td className={tdRight}>{client.thisWeekQty}</td>
                <td className={tdRight}><DiffCell value={client.diff} /></td>
                <td className={tdRight}><RateCell value={client.changeRate} /></td>
                <td className={`${tdClass} pl-6`}>
                  <div className="flex flex-wrap gap-1.5">
                    {client.products.map((p: WeekdayProduct) => {
                      const chip = productChips.find((c) => c.productName === p.productName);
                      const color = chip?.color ?? "#6b7280";
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
                          <span className="text-gray-400 font-medium">{p.qty}</span>
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
