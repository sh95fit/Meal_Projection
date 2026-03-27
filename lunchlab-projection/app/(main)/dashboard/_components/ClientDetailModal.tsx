// app/(main)/dashboard/_components/ClientDetailModal.tsx
"use client";

import { ReactElement, useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend, LabelList,
} from "recharts";
import type { LabelProps } from "recharts";
import type { ClientModalData } from "@/types/dashboard";

interface Props {
  open: boolean;
  loading: boolean;
  data: ClientModalData | null;
  onClose: () => void;
}

function isValidModalData(d: unknown): d is ClientModalData {
  if (!d || typeof d !== "object") return false;
  const obj = d as Record<string, unknown>;
  return typeof obj.accountId === "number" && Array.isArray(obj.productStats) && Array.isArray(obj.recentTrend);
}

function ValueLabel(props: LabelProps): ReactElement | null {
  const { value, viewBox } = props;
  const num = typeof value === "number" ? value : Number(value);
  if (!num) return null;
  const vb = viewBox as { x?: number; y?: number; width?: number; height?: number } | undefined;
  const h = vb?.height ?? 0;
  const w = vb?.width ?? 0;
  if (h < 14 || w < num.toString().length * 6 + 4) return null;
  return (
    <text x={(vb?.x ?? 0) + w / 2} y={(vb?.y ?? 0) + h / 2 + 4} textAnchor="middle" fontSize={9} fill="#fff">{num}</text>
  );
}

function TotalLabel(props: LabelProps): ReactElement | null {
  const { viewBox, value } = props;
  const num = typeof value === "number" ? value : Number(value);
  if (!num) return null;
  const vb = viewBox as { x?: number; y?: number; width?: number } | undefined;
  return (
    <text x={(vb?.x ?? 0) + (vb?.width ?? 0) / 2} y={(vb?.y ?? 0) - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill="#374151">{num}</text>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-xs lg:text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-2 pb-1.5 lg:pt-3 lg:pb-2">
        <p className="text-[9px] lg:text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-base lg:text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export function ClientDetailModal({ open, loading, data, onClose }: Props) {
  const valid = isValidModalData(data);
  const [chartMode, setChartMode] = useState<"total" | "product">("total");

  const productList = useMemo(() => valid ? (data.productList ?? []) : [], [valid, data]);

  const trendData = useMemo(() => {
    if (!valid) return [];
    return (data.recentTrend ?? []).map((row) => {
      let total = 0;
      for (const pl of productList) { total += Number(row[pl.productName] || 0); }
      return { ...row, _total: total };
    });
  }, [valid, data, productList]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* 모바일: 거의 전체 화면, 데스크탑: max-w-xl */}
      <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] lg:max-h-[85vh] overflow-y-auto p-4 lg:p-6">
        <DialogHeader>
          <DialogTitle className="text-base lg:text-lg">
            {valid ? data.accountName : "고객사"} 상세 정보
          </DialogTitle>
        </DialogHeader>

        {loading || !valid ? (
          <p className="text-muted-foreground animate-pulse py-8 text-center">
            {loading ? "불러오는 중..." : "데이터를 불러올 수 없습니다."}
          </p>
        ) : (
          <div className="space-y-4 lg:space-y-5">
            {/* 고객 정보 카드 */}
            <Card className="bg-gray-50">
              <CardContent className="pt-3 pb-2 lg:pt-4 lg:pb-3 space-y-1">
                {data.clientType === "churned" && (
                  <>
                    <InfoRow label="이용 종료일" value={data.terminateAt} />
                    <InfoRow label="구독 전환일" value={data.subscriptionAt} />
                    <InfoRow label="첫 주문일" value={data.firstOrderDate} />
                    <InfoRow label="마지막 주문일" value={data.lastOrderDate} />
                    {data.serviceDays != null && <InfoRow label="총 서비스 이용일" value={`${data.serviceDays}일`} />}
                  </>
                )}
                {data.clientType === "new" && (
                  <>
                    <InfoRow label="구독 전환일" value={data.subscriptionAt} />
                    <InfoRow label="첫 주문일" value={data.firstOrderDate} />
                    <InfoRow label="마지막 주문일" value={data.lastOrderDate} />
                    {data.serviceDays != null && <InfoRow label="총 서비스 이용일" value={`${data.serviceDays}일`} />}
                  </>
                )}
                {data.clientType === "converted" && (
                  <InfoRow label="전환 예정일" value={data.subscriptionScheduledAt} />
                )}
                {data.orderDays && data.orderDays.length > 0 && (
                  <div className="flex items-center justify-between text-xs lg:text-sm pt-1">
                    <span className="text-muted-foreground">주문 요일</span>
                    <div className="flex gap-1">
                      {data.orderDays.map((d) => (
                        <Badge key={d} variant="outline" className="text-[10px] lg:text-xs px-1.5 py-0">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3칸 요약 */}
            <div className="grid grid-cols-3 gap-2 lg:gap-3">
              <MiniCard label="총 주문 횟수" value={`${data.totalOrders}회`} />
              <MiniCard label="전체 평균" value={String(data.avgQty)} />
              <MiniCard label="전체 중간값" value={String(data.medianQty)} />
            </div>

            {/* 상품별 테이블 */}
            <div>
              <h4 className="text-xs lg:text-sm font-semibold mb-2">상품별 평균 / 중간값</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">상품</TableHead>
                      <TableHead className="text-right text-xs">평균</TableHead>
                      <TableHead className="text-right text-xs">중간값</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.productStats ?? []).map((p) => (
                      <TableRow key={p.productName}>
                        <TableCell className="text-xs lg:text-sm">{p.productName}</TableCell>
                        <TableCell className="text-right text-xs lg:text-sm">{p.avg}</TableCell>
                        <TableCell className="text-right text-xs lg:text-sm">{p.median}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 차트 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs lg:text-sm font-semibold">최근 30일 주문 추이</h4>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`px-2 py-0.5 lg:px-2.5 lg:py-1 rounded text-[10px] lg:text-xs font-medium border transition-colors ${
                      chartMode === "total"
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "bg-background text-muted-foreground border-input hover:bg-accent"
                    }`}
                    onClick={() => setChartMode("total")}
                  >
                    전체
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-0.5 lg:px-2.5 lg:py-1 rounded text-[10px] lg:text-xs font-medium border transition-colors ${
                      chartMode === "product"
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "bg-background text-muted-foreground border-input hover:bg-accent"
                    }`}
                    onClick={() => setChartMode("product")}
                  >
                    상품별
                  </button>
                </div>
              </div>

              <div className="h-[160px] lg:h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 20, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 8 }}
                      interval="preserveStartEnd"
                      tickFormatter={(v: string) => { const p = v.split("-"); return `${p[1]}/${p[2]}`; }}
                    />
                    <YAxis tick={{ fontSize: 9 }} width={30} />
                    <Tooltip
                      contentStyle={{ fontSize: 11 }}
                      labelStyle={{ fontSize: 11, fontWeight: 600 }}
                      itemStyle={{ fontSize: 10, padding: "1px 0" }}
                      formatter={((value: unknown, name: unknown) => [Number(value || 0).toLocaleString(), String(name ?? "")]) as (value: unknown, name: unknown) => [string, string]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                    {chartMode === "total" ? (
                      <Bar dataKey="qty" fill="#6366f1" name="전체 주문량" radius={[2, 2, 0, 0]}>
                        <LabelList dataKey="qty" position="top" content={TotalLabel} />
                      </Bar>
                    ) : (
                      productList.map((pl, idx) => (
                        <Bar key={pl.productName} dataKey={pl.productName} stackId="stack" fill={pl.color} name={pl.productName}>
                          <LabelList dataKey={pl.productName} content={ValueLabel} />
                          {idx === productList.length - 1 && <LabelList dataKey="_total" position="top" content={TotalLabel} />}
                        </Bar>
                      ))
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
