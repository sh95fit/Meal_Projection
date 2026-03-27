// app/(main)/forecasts/new/_components/ConditionMetTable.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrderRow } from "../_hooks/useForecastNew";

interface Props {
  rows: OrderRow[];
}

export function ConditionMetTable({ rows }: Props) {
  return (
    <Card>
      <CardHeader className="px-4 lg:px-6">
        <CardTitle className="text-sm lg:text-base">
          주문 확정 — 조건충족 ({rows.length}개사)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 lg:px-6">
        <div className="max-h-64 overflow-auto">
          <Table containerClassName="overflow-visible">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs lg:text-sm">고객사명</TableHead>
                <TableHead className="text-xs lg:text-sm">채널</TableHead>
                <TableHead className="text-xs lg:text-sm text-right">상품수량</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-xs lg:text-sm py-2 lg:py-3">{row.고객사명}</TableCell>
                  <TableCell className="py-2 lg:py-3"><Badge variant="outline" className="text-[10px] lg:text-xs">{row.주문채널}</Badge></TableCell>
                  <TableCell className="text-xs lg:text-sm text-right py-2 lg:py-3">{row.상품수량}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6">
                    <p className="text-muted-foreground text-sm">조건충족 고객사가 없습니다.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
