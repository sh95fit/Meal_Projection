// app/(main)/dashboard/_components/WeekdayTable.tsx (전체 교체)
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
// ★ WeekdayClient → WeekdayCaseClient, WeekdayCase 타입 수정
import type { WeekdayCaseClient, WeekdayCase, ProductChip, ViewScope } from "@/types/dashboard";

// ★ filter에 "all" 포함하는 별도 유니온
type WeekdayFilter = WeekdayCase | "all";

// 상품 항목 타입
type WeekdayProduct = { productName: string; qty: number };

interface Props {
  clients: WeekdayCaseClient[];
  filter: WeekdayFilter;
  scope: ViewScope;
  productChips: ProductChip[];
  onClientClick?: (accountId: number) => void;
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

export function WeekdayTable({ clients, filter, scope, productChips, onClientClick }: Props) {
  // ★ filter === "all" 비교가 가능하도록 WeekdayFilter 유니온 사용
  const filtered =
    filter === "all" ? clients : clients.filter((c) => c.case === filter);

  if (filtered.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">해당 항목이 없습니다.</p>;
  }

  if (scope === "product") {
    return (
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>구분</TableHead>
              <TableHead>고객사</TableHead>
              <TableHead>상품별 전주 → 금주</TableHead>
              <TableHead className="text-right">총 전주</TableHead>
              <TableHead className="text-right">총 금주</TableHead>
              <TableHead className="text-right">차이</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((client) => (
              <TableRow
                key={client.accountId}
                className={onClientClick ? "cursor-pointer hover:bg-gray-50" : "hover:bg-gray-50"}
                onClick={() => onClientClick?.(client.accountId)}
              >
                <TableCell><CaseBadge caseType={client.case} /></TableCell>
                <TableCell className="font-semibold">{client.accountName}</TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {/* ★ p 타입 명시 */}
                    {client.products.map((p: WeekdayProduct) => {
                      const chip = productChips.find((c) => c.productName === p.productName);
                      const color = chip?.color ?? "#6b7280";
                      return (
                        <div key={p.productName} className="flex items-center gap-1.5 text-xs">
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate">{p.productName}</span>
                          <span className="text-gray-400 font-medium">{p.qty}</span>
                        </div>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell className="text-right">{client.lastWeekQty}</TableCell>
                <TableCell className="text-right">{client.thisWeekQty}</TableCell>
                <TableCell className="text-right"><DiffCell value={client.diff} /></TableCell>
              </TableRow>
            ))}
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
            <TableHead>구분</TableHead>
            <TableHead>고객사</TableHead>
            <TableHead className="text-right">전주</TableHead>
            <TableHead className="text-right">금주</TableHead>
            <TableHead className="text-right">차이</TableHead>
            <TableHead className="text-right">변화율</TableHead>
            <TableHead className="pl-6">주문 상품</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((client) => (
            <TableRow
              key={client.accountId}
              className={onClientClick ? "cursor-pointer hover:bg-gray-50" : "hover:bg-gray-50"}
              onClick={() => onClientClick?.(client.accountId)}
            >
              <TableCell><CaseBadge caseType={client.case} /></TableCell>
              <TableCell className="font-semibold">{client.accountName}</TableCell>
              <TableCell className="text-right">{client.lastWeekQty}</TableCell>
              <TableCell className="text-right">{client.thisWeekQty}</TableCell>
              <TableCell className="text-right"><DiffCell value={client.diff} /></TableCell>
              <TableCell className="text-right"><RateCell value={client.changeRate} /></TableCell>
              <TableCell className="pl-6">
                <div className="flex flex-wrap gap-1.5">
                  {/* ★ p 타입 명시 */}
                  {client.products.map((p: WeekdayProduct) => {
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}