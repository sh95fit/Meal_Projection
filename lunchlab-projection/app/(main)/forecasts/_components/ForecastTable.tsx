import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, ClipboardCheck, Settings2 } from "lucide-react";
import { formatDateWithDay } from "@/lib/utils";
import type { OrderForecast } from "@/types";

interface Props {
  forecasts: OrderForecast[];
  onEdit: (f: OrderForecast) => void;
  onActual: (f: OrderForecast) => void;
  onAdjust: (f: OrderForecast) => void;
}

export function ForecastTable({ forecasts, onEdit, onActual, onAdjust }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>출고일</TableHead>
          <TableHead>상품</TableHead>
          <TableHead className="text-right">주문확정</TableHead>
          <TableHead className="text-right">추가예상</TableHead>
          <TableHead className="text-right">조정 수량</TableHead>
          <TableHead className="text-right">예상수량</TableHead>
          <TableHead className="text-right">확정수량</TableHead>
          <TableHead className="text-right">오차율</TableHead>
          <TableHead className="w-32">작업</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {forecasts.map((f) => (
          <TableRow key={f.id}>
            <TableCell>{formatDateWithDay(f.delivery_date)}</TableCell>
            <TableCell className="font-medium">{f.product_name}</TableCell>
            <TableCell className="text-right">{f.confirmed_order_qty}</TableCell>
            <TableCell className="text-right">{f.additional_forecast_qty}</TableCell>
            <TableCell className="text-right">
              {f.buffer_qty != null && f.buffer_qty !== 0 ? (
                <Badge variant={f.buffer_qty > 0 ? "outline" : "destructive"} className="text-xs">
                  {f.buffer_qty > 0 ? `+${f.buffer_qty}` : f.buffer_qty}
                </Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="text-right font-semibold">{f.forecast_qty}</TableCell>
            <TableCell className="text-right">{f.actual_qty != null ? f.actual_qty : "-"}</TableCell>
            <TableCell className="text-right">
              {f.error_rate != null ? (
                <Badge variant={Math.abs(f.error_rate) <= 5 ? "default" : "destructive"}>
                  {f.error_rate > 0 ? "+" : ""}{f.error_rate}%
                </Badge>
              ) : "-"}
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => onEdit(f)} title="수량 수정">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onActual(f)} title="확정 수량">
                  <ClipboardCheck className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onAdjust(f)} title="수량 조정">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {forecasts.length === 0 && (
          <TableRow>
            <TableCell colSpan={9} className="text-center py-8">
              <p className="text-muted-foreground">산출된 결과가 없습니다</p>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
