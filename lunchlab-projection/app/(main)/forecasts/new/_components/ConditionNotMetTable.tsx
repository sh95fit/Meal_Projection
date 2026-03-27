// app/(main)/forecasts/new/_components/ConditionNotMetTable.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrderRow } from "../_hooks/useForecastNew";

interface Props {
  rows: OrderRow[];
  conditionNotMetDelta: number;
  onUpdateQty: (accountId: number, qty: number) => void;
}

function RefRow({ label, value, bold }: { label: string; value: number | string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

export function ConditionNotMetTable({ rows, conditionNotMetDelta, onUpdateQty }: Props) {
  if (rows.length === 0) return null;

  return (
    <Card className="border-destructive/30">
      <CardHeader className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm lg:text-base text-destructive">
            주문 확정 — 조건불충족 ({rows.length}개사)
          </CardTitle>
          {conditionNotMetDelta !== 0 && (
            <Badge variant={conditionNotMetDelta > 0 ? "default" : "destructive"} className="text-[10px] lg:text-xs">
              변동: {conditionNotMetDelta > 0 ? "+" : ""}{conditionNotMetDelta}
            </Badge>
          )}
        </div>
        <p className="text-[10px] lg:text-xs text-muted-foreground">
          수량 조정 시 변동분이 추가 예상에 반영됩니다. (원본 상품수량은 확정 수량에 그대로 유지)
        </p>
      </CardHeader>
      <CardContent className="px-4 lg:px-6">
        {/* 모바일: 카드형 리스트 */}
        <div className="lg:hidden max-h-[400px] overflow-auto space-y-2">
          {rows.map((row) => {
            const delta = row.adjusted_qty - (Number(row.상품수량) || 0);
            return (
              <div key={row.account_id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{row.고객사명}</span>
                    <Badge variant="outline" className="text-[10px]">{row.주문채널}</Badge>
                  </div>
                  {delta !== 0 && (
                    <span className={`text-xs font-medium ${delta > 0 ? "text-blue-600" : "text-destructive"}`}>
                      {delta > 0 ? "+" : ""}{delta}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <RefRow label="원본 수량" value={row.상품수량} />
                  <RefRow label="전체 평균" value={row.ref_전체_평균} />
                  <RefRow label="전체 중간값" value={row.ref_전체_중간값} />
                  <RefRow label="상품 전체평균" value={row.ref_상품_전체_평균} />
                  <RefRow label="상품 전체중간" value={row.ref_상품_전체_중간값} />
                  <RefRow label="요일 평균" value={row.ref_요일별_평균} />
                  <RefRow label="요일 중간값" value={row.ref_요일별_중간값} />
                  <RefRow label="상품 요일평균" value={row.ref_상품_요일별_평균} bold />
                  <RefRow label="상품 요일중간" value={row.ref_상품_요일별_중간값} bold />
                </div>
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="text-xs text-muted-foreground">반영 수량</span>
                  <Input
                    type="number"
                    className="w-20 text-right h-7 text-sm"
                    value={row.adjusted_qty}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value);
                      onUpdateQty(row.account_id, isNaN(parsed) ? 0 : parsed);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 데스크탑: 기존 테이블 */}
        <div className="hidden lg:block max-h-[400px] overflow-auto">
          <Table containerClassName="overflow-visible">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-30 min-w-[120px]">고객사명</TableHead>
                <TableHead>채널</TableHead>
                <TableHead className="text-right min-w-[64px]">원본<br />상품수량</TableHead>
                <TableHead className="text-right min-w-[64px]">전체<br />평균</TableHead>
                <TableHead className="text-right min-w-[64px]">전체<br />중간값</TableHead>
                <TableHead className="text-right min-w-[64px]">상품<br />전체평균</TableHead>
                <TableHead className="text-right min-w-[64px]">상품<br />전체중간</TableHead>
                <TableHead className="text-right min-w-[64px]">요일<br />평균</TableHead>
                <TableHead className="text-right min-w-[64px]">요일<br />중간값</TableHead>
                <TableHead className="text-right min-w-[64px]">상품<br />요일평균</TableHead>
                <TableHead className="text-right min-w-[64px]">상품<br />요일중간</TableHead>
                <TableHead className="text-right min-w-[56px]">변동</TableHead>
                <TableHead className="text-right min-w-[88px] sticky right-0 bg-background z-30">반영 수량</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const delta = row.adjusted_qty - (Number(row.상품수량) || 0);
                return (
                  <TableRow key={row.account_id}>
                    <TableCell className="font-medium sticky left-0 bg-background z-10">{row.고객사명}</TableCell>
                    <TableCell><Badge variant="outline">{row.주문채널}</Badge></TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.상품수량}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.ref_전체_평균}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.ref_전체_중간값}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.ref_상품_전체_평균}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.ref_상품_전체_중간값}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.ref_요일별_평균}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.ref_요일별_중간값}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-semibold">{row.ref_상품_요일별_평균}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-semibold">{row.ref_상품_요일별_중간값}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {delta !== 0 && (
                        <span className={delta > 0 ? "text-blue-600 font-medium" : "text-destructive font-medium"}>
                          {delta > 0 ? "+" : ""}{delta}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right sticky right-0 bg-background z-10">
                      <Input
                        type="number"
                        className="w-20 text-right h-8 text-sm"
                        value={row.adjusted_qty}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value);
                          onUpdateQty(row.account_id, isNaN(parsed) ? 0 : parsed);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
