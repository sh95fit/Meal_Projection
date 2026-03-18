// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/_components/QuantityAnomalyBlock.tsx
// 수량 변동 특이 고객사 — 테이블 형태로 표시
// ──────────────────────────────────────────────────────────────────
"use client";

import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { QuantityAnomaly } from "@/types/dashboard";

interface Props {
  anomalies: QuantityAnomaly[];
}

export function QuantityAnomalyBlock({ anomalies }: Props) {
  if (anomalies.length === 0) {
    return <p className="text-gray-400 text-sm">수량 변동 특이 고객사가 없습니다.</p>;
  }

  // 증가 / 감소 분리
  const upList = anomalies.filter((a) => a.direction === "up");
  const downList = anomalies.filter((a) => a.direction === "down");

  /** 테이블 렌더링 헬퍼 */
  const renderTable = (title: string, list: QuantityAnomaly[], badgeColor: string) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge className={badgeColor}>{title}</Badge>
          <span className="text-sm text-gray-500">{list.length}개사</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>고객사</TableHead>
              <TableHead className="text-right">오늘</TableHead>
              <TableHead className="text-right">4주 평균</TableHead>
              <TableHead className="text-right">차이</TableHead>
              <TableHead>상품별</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((a) => (
              <TableRow key={a.accountId}>
                <TableCell className="font-medium">{a.accountName}</TableCell>
                <TableCell className="text-right">{a.todayQty}</TableCell>
                <TableCell className="text-right">{a.avgQty}</TableCell>
                <TableCell className="text-right font-semibold">
                  {a.direction === "up" ? "+" : ""}{a.diff}
                </TableCell>
                <TableCell className="text-xs text-gray-500">
                  {a.productBreakdown.map((pb) =>
                    `${pb.productName}(${pb.today}/${pb.avg})`
                  ).join(", ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div>
      {renderTable("수량 증가 ↑", upList, "bg-green-100 text-green-700")}
      {renderTable("수량 감소 ↓", downList, "bg-red-100 text-red-700")}
    </div>
  );
}