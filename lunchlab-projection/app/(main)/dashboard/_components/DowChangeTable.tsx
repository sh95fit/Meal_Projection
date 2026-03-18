// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/_components/DowChangeTable.tsx
// 요일별 순유입 테이블
// ──────────────────────────────────────────────────────────────────
"use client";

import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import type { DowFlow } from "@/types/dashboard";

interface Props {
  flows: DowFlow[];
}

export function DowChangeTable({ flows }: Props) {
  if (flows.length === 0) return null;

  return (
    <div>
      <h4 className="font-medium text-sm mb-2">요일별 증감</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>요일</TableHead>
            <TableHead className="text-right">이탈</TableHead>
            <TableHead className="text-right">신규</TableHead>
            <TableHead className="text-right">순유입</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flows.map((f) => {
            const netColor =
              f.net > 0 ? "text-green-600 font-semibold" :
              f.net < 0 ? "text-red-600 font-semibold" :
                           "text-gray-400";
            return (
              <TableRow key={f.dow}>
                <TableCell>{f.dowLabel}요일</TableCell>
                <TableCell className="text-right text-red-500">-{f.churned}</TableCell>
                <TableCell className="text-right text-green-500">+{f.newCount}</TableCell>
                <TableCell className={`text-right ${netColor}`}>
                  {f.net > 0 ? "+" : ""}{f.net}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}