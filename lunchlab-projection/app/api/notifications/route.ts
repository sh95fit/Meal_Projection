import { NextRequest, NextResponse } from "next/server";

// POST /api/notifications — 잔디 Webhook 알림 발송
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, data } = body;

  const webhookUrl = process.env.JANDI_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "JANDI_WEBHOOK_URL not configured" },
      { status: 500 }
    );
  }

  let message = "";

  switch (type) {
    case "forecast-complete": {
      // data: { groups: [{ groupName, items: [{ productName, qty }], date, totalQty }] }
      for (const group of data.groups) {
        const dateObj = new Date(group.date);
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
        const dayName = dayNames[dateObj.getDay()];

        message += `**${group.groupName}** 발주요청수량\n\n`;
        message += `**${month}월 ${day}일 ${dayName}요일**\n\n`;

        for (const item of group.items) {
          message += `${item.productName} : ${item.qty}\n\n`;
        }
        message += `총계 : ${group.totalQty}\n\n---\n\n`;
      }
      break;
    }
    case "forecast-change": {
      // data: { date, productName, previousQty, newQty }
      const dateObj = new Date(data.date);
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      const dayName = dayNames[dateObj.getDay()];

      message = `발주 수량 변경 요청\n\n**${month}월 ${day}일 ${dayName}요일**\n\n대상 : ${data.productName}\n\n기존 : ${data.previousQty} 개\n\n변경 : ${data.newQty} 개`;
      break;
    }
    case "forecast-adjust": {
      // data: { date, previousQty, newQty, diff, rate, reason }
      const dateObj = new Date(data.date);
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      const dayName = dayNames[dateObj.getDay()];
      const sign = data.diff > 0 ? "+" : "";

      message = `D-3 프레시밀 발주 수량 조정\n\n${month}월 ${day}일 ${dayName}요일\n\n기존 : ${data.previousQty} 개\n\n변경 : ${data.newQty} 개 (${sign}${data.diff})\n\n조정 폭 : ${data.rate}%\n\n사유 : ${data.reason}`;
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.tosslab.jandi-v2+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Jandi webhook failed: ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification error:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
