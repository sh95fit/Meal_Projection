// app/(main)/dashboard/_components/ClientDetailModal.tsx (전체 교체)
"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts";
import type { ClientModalData } from "@/types/dashboard";

interface Props {
  open: boolean;
  loading: boolean;
  data: ClientModalData | null;
  onClose: () => void;
}

// ★ 유효한 모달 데이터인지 검증
function isValidModalData(d: unknown): d is ClientModalData {
  if (!d || typeof d !== "object") return false;
  const obj = d as Record<string, unknown>;
  return (
    typeof obj.accountId === "number" &&
    Array.isArray(obj.productStats) &&
    Array.isArray(obj.recentTrend)
  );
}

export function ClientDetailModal({ open, loading, data, onClose }: Props) {
  const valid = isValidModalData(data);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {valid ? data.accountName : "고객사"} 상세
          </DialogTitle>
        </DialogHeader>

        {loading || !valid ? (
          <p className="text-muted-foreground animate-pulse py-8 text-center">
            {loading ? "불러오는 중..." : "데이터를 불러올 수 없습니다."}
          </p>
        ) : (
          <div className="space-y-5">
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

            {/* ── 최근 30일 주문 추이 바 차트 ── */}
            <div>
              <h4 className="text-sm font-semibold mb-2">최근 30일 주문 추이</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.recentTrend ?? []}>
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
                    formatter={(value) => {
                      if (Array.isArray(value)) return value.join(", ");
                      return [value != null ? Number(value).toLocaleString() : "0", "수량"];
                    }}
                  />
                  <Bar dataKey="qty" fill="#6366f1" name="주문량" radius={[2, 2, 0, 0]} />
                </BarChart>
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