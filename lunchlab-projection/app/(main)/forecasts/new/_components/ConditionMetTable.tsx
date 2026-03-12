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
      <CardHeader>
        <CardTitle className="text-base">
          주문 확정 — 조건충족 ({rows.length}개사)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-64 overflow-auto">
          <Table containerClassName="overflow-visible">
            <TableHeader>
              <TableRow>
                <TableHead>고객사명</TableHead>
                <TableHead>채널</TableHead>
                <TableHead className="text-right">상품수량</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{row.고객사명}</TableCell>
                  <TableCell><Badge variant="outline">{row.주문채널}</Badge></TableCell>
                  <TableCell className="text-right">{row.상품수량}</TableCell>
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
