// ──────────────────────────────────────────────────────────────────
// app/(main)/dashboard/_components/ClientDetailModal.tsx
// 고객사 상세 모달 — shadcn Dialog
// ──────────────────────────────────────────────────────────────────
"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ClientChange } from "@/types/dashboard";

interface Props {
  client: ClientChange | null;
  onClose: () => void;
}

/** 타입 라벨 */
const TYPE_LABELS = { churned: "이탈", new: "신규", converted: "전환" };

export function ClientDetailModal({ client, onClose }: Props) {
  if (!client) return null;

  // 변동률 계산
  const changeRate =
    client.previousAvg > 0
      ? Math.round(((client.currentAvg - client.previousAvg) / client.previousAvg) * 100)
      : client.currentAvg > 0 ? 100 : 0;

  return (
    <Dialog open={!!client} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {client.accountName}
            <Badge variant="outline">{TYPE_LABELS[client.type]}</Badge>
          </DialogTitle>
          <DialogDescription>
            고객사 ID: {client.accountId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* 일평균 주문량 비교 */}
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">이전 기간 일평균</span>
            <span className="font-medium">{client.previousAvg}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">현재 기간 일평균</span>
            <span className="font-medium">{client.currentAvg}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">변동률</span>
            <span className={`font-bold ${changeRate > 0 ? "text-green-600" : changeRate < 0 ? "text-red-600" : ""}`}>
              {changeRate > 0 ? "+" : ""}{changeRate}%
            </span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">주력 상품</span>
            <span className="font-medium">{client.mainProduct}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">마지막 주문일</span>
            <span className="font-medium">{client.lastOrderDate || "—"}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}