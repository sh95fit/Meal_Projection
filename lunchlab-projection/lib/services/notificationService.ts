import { parseDateParts } from "@/lib/utils";

interface NotificationPayload {
  type: string;
  data: Record<string, unknown>;
}

function buildForecastCompleteMessage(data: Record<string, unknown>): string {
  const groups = data.groups as {
    groupName: string;
    date: string;
    items: { productName: string; qty: number; buffer: number }[];
    totalQty: number;
  }[];

  let message = "";
  for (const group of groups) {
    const { month, day, dayName } = parseDateParts(group.date);

    message += `**${group.groupName}** 발주요청수량\n\n`;
    message += `**${month}월 ${day}일 ${dayName}요일**\n\n`;

    for (const item of group.items) {
      const bufferNote = item.buffer !== 0
        ? ` (조정 ${item.buffer > 0 ? "+" : ""}${item.buffer})`
        : "";
      message += `${item.productName} : ${item.qty}${bufferNote}\n\n`;
    }
    message += `총계 : ${group.totalQty}\n\n---\n\n`;
  }
  return message;
}

function buildForecastChangeMessage(data: Record<string, unknown>): string {
  const { month, day, dayName } = parseDateParts(data.date as string);

  return `발주 수량 변경 요청\n\n**${month}월 ${day}일 ${dayName}요일**\n\n대상 : ${data.productName}\n\n기존 : ${data.previousQty} 개\n\n변경 : ${data.newQty} 개`;
}

function buildForecastAdjustMessage(data: Record<string, unknown>): string {
  const { month, day, dayName } = parseDateParts(data.date as string);
  const diff = data.diff as number;
  const sign = diff > 0 ? "+" : "";

  return `D-3 프레시밀 발주 수량 조정\n\n${month}월 ${day}일 ${dayName}요일\n\n기존 : ${data.previousQty} 개\n\n변경 : ${data.newQty} 개 (${sign}${diff})\n\n조정 폭 : ${data.rate}%\n\n사유 : ${data.reason}`;
}

export function buildNotificationMessage(payload: NotificationPayload): string {
  switch (payload.type) {
    case "forecast-complete":
      return buildForecastCompleteMessage(payload.data);
    case "forecast-change":
      return buildForecastChangeMessage(payload.data);
    case "forecast-adjust":
      return buildForecastAdjustMessage(payload.data);
    default:
      throw new Error(`Unknown notification type: ${payload.type}`);
  }
}

export async function sendJandiNotification(message: string) {
  const webhookUrl = process.env.JANDI_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("JANDI_WEBHOOK_URL not configured");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      Accept: "application/vnd.tosslab.jandi-v2+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body: message }),
  });

  if (!response.ok) {
    throw new Error(`Jandi webhook failed: ${response.status}`);
  }
}
