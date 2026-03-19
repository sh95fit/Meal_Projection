// app/(main)/dashboard/_components/ClientDetailModal.tsx
"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from "recharts";
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
  return (
    typeof obj.accountId === "number" &&
    Array.isArray(obj.productStats) &&
    Array.isArray(obj.recentTrend)
  );
}

/** 최상단 고객 정보 행 */
function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function ClientDetailModal({ open, loading, data, onClose }: Props) {
  const valid = isValidModalData(data);
  const [chartMode, setChartMode] = useState<"total" | "product">("total");

  // 상품 목록 (색상 포함)
  const productList = valid ? (data.productList ?? []) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {valid ? data.accountName : "고객사"} 상세 정보
          </DialogTitle>
        </DialogHeader>

        {loading || !valid ? (
          <p className="text-muted-foreground animate-pulse py-8 text-center">
            {loading ? "불러오는 중..." : "데이터를 불러올 수 없습니다."}
          </p>
        ) : (
          <div className="space-y-5">
            {/* ── 최상단: 고객 정보 ── */}
            <Card>
              <CardContent className="pt-4 pb-3 space-y-0.5">
                {data.clientType === "churned" && (
                  <>
                    <InfoRow label="이용 종료일" value={data.terminateAt} />
                    <InfoRow label="구독 전환일" value={data.subscriptionAt} />
                    <InfoRow label="첫 주문일" value={data.firstOrderDate} />
                    <InfoRow label="마지막 주문일" value={data.lastOrderDate} />
                    {data.serviceDays != null && (
                      <InfoRow
                        label="총 서비스 이용일"
                        value={`${data.serviceDays}일`}
                      />
                    )}
                  </>
                )}
                {data.clientType === "new" && (
                  <>
                    <InfoRow label="구독 전환일" value={data.subscriptionAt} />
                    <InfoRow label="첫 주문일" value={data.firstOrderDate} />
                    <InfoRow label="마지막 주문일" value={data.lastOrderDate} />
                    {data.serviceDays != null && (
                      <InfoRow
                        label="총 서비스 이용일"
                        value={`${data.serviceDays}일`}
                      />
                    )}
                  </>
                )}
                {data.clientType === "converted" && (
                  <InfoRow
                    label="전환 예정일"
                    value={data.subscriptionScheduledAt}
                  />
                )}
              </CardContent>
            </Card>

            {/* ── 3칸 요약 ── */}
            <div className="grid grid-cols-3 gap-3">
              <MiniCard label="총 주문 횟수" value={`${data.totalOrders}회`} />
              <MiniCard label="전체 평균" value={String(data.avgQty)} />
              <MiniCard label="전체 중간값" value={String(data.medianQty)} />
            </div>

            {/* ── 상품별 평균 / 중간값 테이블 ── */}
            <div>
              <h4 className="text-sm font-semibold mb-2">상품별 평균 / 중간값</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>상품</TableHead>
                      <TableHead className="text-right">평균</TableHead>
                      <TableHead className="text-right">중간값</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.productStats ?? []).map((p) => (
                      <TableRow key={p.productName}>
                        <TableCell>{p.productName}</TableCell>
                        <TableCell className="text-right">{p.avg}</TableCell>
                        <TableCell className="text-right">{p.median}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* ── 최근 30일 주문 추이 (믹스 차트) ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">최근 30일 주문 추이</h4>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      chartMode === "total"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    onClick={() => setChartMode("total")}
                  >
                    전체
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      chartMode === "product"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    onClick={() => setChartMode("product")}
                  >
                    상품별
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                  data={data.recentTrend ?? []}
                  margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9 }}
                    interval="preserveStartEnd"
                    tickFormatter={(v: string) => {
                      const parts = v.split("-");
                      return `${parts[1]}/${parts[2]}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(label) => String(label ?? "")}
                    contentStyle={{ fontSize: 11 }}
                    formatter={((value: any, name: any) => {
                      const num = Number(value) || 0;
                      return [num.toLocaleString(), String(name ?? "")];
                    }) as any}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />

                  {chartMode === "total" ? (
                    <>
                      <Bar
                        dataKey="qty"
                        fill="#6366f1"
                        name="전체 주문량"
                        radius={[2, 2, 0, 0]}
                      />
                      <Line
                        dataKey="qty"
                        stroke="#4f46e5"
                        strokeWidth={1.5}
                        dot={{ r: 2 }}
                        name="추이"
                        type="monotone"
                      />
                    </>
                  ) : (
                    <>
                      {productList.map((pl) => (
                        <Bar
                          key={pl.productName}
                          dataKey={pl.productName}
                          stackId="products"
                          fill={pl.color}
                          name={pl.productName}
                          radius={[0, 0, 0, 0]}
                        />
                      ))}
                      <Line
                        dataKey="qty"
                        stroke="#374151"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        dot={false}
                        name="전체"
                        type="monotone"
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-3 pb-2">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
          {label}
        </p>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
