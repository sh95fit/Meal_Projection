// app/(main)/forecasts/_components/ForecastTable.tsx
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

function InfoRow({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

export function ForecastTable({ forecasts, onEdit, onActual, onAdjust }: Props) {
  if (forecasts.length === 0) {
    return <p className="text-center py-8 text-muted-foreground text-sm">산출된 결과가 없습니다</p>;
  }

  return (
    <>
      {/* 모바일: 카드형 리스트 */}
      <div className="lg:hidden space-y-2">
        {forecasts.map((f) => (
          <div key={f.id} className="border rounded-lg p-3 space-y-2">
            {/* 상단: 상품명 + 출고일 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{f.product_name}</span>
                <span className="text-xs text-muted-foreground ml-1.5">{formatDateWithDay(f.delivery_date)}</span>
              </div>
              {f.error_rate != null ? (
                <Badge variant={Math.abs(f.error_rate) <= 5 ? "default" : "destructive"} className="text-[10px]">
                  {f.error_rate > 0 ? "+" : ""}{f.error_rate}%
                </Badge>
              ) : null}
            </div>

            {/* 수량 정보 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <InfoRow label="주문확정" value={f.confirmed_order_qty} />
              <InfoRow label="추가예상" value={f.additional_forecast_qty} />
              <InfoRow
                label="조정 수량"
                value={
                  f.buffer_qty != null && f.buffer_qty !== 0
                    ? <span className={f.buffer_qty > 0 ? "text-blue-600" : "text-destructive"}>{f.buffer_qty > 0 ? `+${f.buffer_qty}` : f.buffer_qty}</span>
                    : "-"
                }
              />
              <InfoRow label="예상수량" value={f.forecast_qty} bold />
              <InfoRow label="확정수량" value={f.actual_qty != null ? f.actual_qty : "-"} />
            </div>

            {/* 작업 버튼 */}
            <div className="flex gap-1 pt-1 border-t justify-end">
              <Button variant="ghost" size="sm" onClick={() => onEdit(f)} className="h-7 text-xs px-2">
                <Pencil className="h-3 w-3 mr-1" />수정
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onActual(f)} className="h-7 text-xs px-2">
                <ClipboardCheck className="h-3 w-3 mr-1" />확정
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onAdjust(f)} className="h-7 text-xs px-2">
                <Settings2 className="h-3 w-3 mr-1" />조정
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* 데스크탑: 기존 테이블 */}
      <div className="hidden lg:block">
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
          </TableBody>
        </Table>
      </div>
    </>
  );
}
