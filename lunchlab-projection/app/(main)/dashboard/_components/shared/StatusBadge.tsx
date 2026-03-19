// app/(main)/dashboard/_components/shared/StatusBadge.tsx
"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  available: {
    label: "이용중",
    className: "text-green-600 border-green-300 bg-green-50",
  },
  disabled: {
    label: "이용종료",
    className: "text-red-600 border-red-300 bg-red-50",
  },
  considering: {
    label: "체험",
    className: "text-amber-600 border-amber-300 bg-amber-50",
  },
  pending: {
    label: "대기",
    className: "text-purple-600 border-purple-300 bg-purple-50",
  },
  suspended: {
    label: "보류",
    className: "text-orange-600 border-orange-300 bg-orange-50",
  },
  scheduled: {
    label: "전환예정",
    className: "text-gray-600 border-gray-300 bg-gray-50",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status || "-",
    className: "text-gray-500 border-gray-300 bg-gray-50",
  };
  return (
    <Badge variant="outline" className={`${config.className} text-[10px]`}>
      {config.label}
    </Badge>
  );
}
