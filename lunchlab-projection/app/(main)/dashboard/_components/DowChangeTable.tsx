// app/(main)/dashboard/_components/DowChangeTable.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { DowFlow, ViewScope } from "@/types/dashboard";

interface Props {
  flows: DowFlow[];
  scope: ViewScope;
  onScopeChange: (s: ViewScope) => void;
}

export function DowChangeTable({ flows, scope, onScopeChange }: Props) {
  if (flows.length === 0) return null;

  const totalChurn = flows.reduce((s, f) => s + f.churned, 0);
  const totalNew = flows.reduce((s, f) => s + f.newCount, 0);
  const totalNet = flows.reduce((s, f) => s + f.net, 0);

  return (
    <div>
      {/* 제목 + 토글 */}
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold">요일별 주문량 증감 추이</h3>
        <div className="flex gap-1 ml-auto">
          {(["total", "product"] as const).map((s) => (
            <Button
              key={s}
              variant={scope === s ? "default" : "outline"}
              size="sm"
              className="text-[10px] h-6 px-2"
              onClick={() => onScopeChange(s)}
            >
              {s === "total" ? "전체" : "상품별"}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28"></TableHead>
              {flows.map((f) => (
                <TableHead key={f.dow} className="text-center">
                  {f.dowLabel}
                </TableHead>
              ))}
              <TableHead className="text-center">주간 합계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 이탈 행 */}
            <TableRow>
              <TableCell className="text-red-600 font-semibold text-xs">
                ⛔ 이탈 감소
              </TableCell>
              {flows.map((f) => (
                <TableCell
                  key={f.dow}
                  className="text-center text-red-600 text-xs"
                >
                  {f.churned > 0 ? `-${f.churned}` : "0"}
                </TableCell>
              ))}
              <TableCell className="text-center text-red-600 font-bold text-xs">
                {totalChurn > 0 ? `-${totalChurn}` : "0"}
              </TableCell>
            </TableRow>

            {/* 신규 행 */}
            <TableRow>
              <TableCell className="text-green-600 font-semibold text-xs">
                ✅ 신규 증가
              </TableCell>
              {flows.map((f) => (
                <TableCell
                  key={f.dow}
                  className="text-center text-green-600 text-xs"
                >
                  +{f.newCount}
                </TableCell>
              ))}
              <TableCell className="text-center text-green-600 font-bold text-xs">
                +{totalNew}
              </TableCell>
            </TableRow>

            {/* 순 변화 행 */}
            <TableRow>
              <TableCell className="text-blue-600 font-semibold text-xs">
                📊 순 변화
              </TableCell>
              {flows.map((f) => (
                <TableCell
                  key={f.dow}
                  className={`text-center font-bold text-xs ${
                    f.net >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {f.net >= 0 ? "▲" : "▼"} {Math.abs(f.net)}
                </TableCell>
              ))}
              <TableCell
                className={`text-center font-bold text-xs ${
                  totalNet >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {totalNet >= 0 ? "▲" : "▼"} {Math.abs(totalNet)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}