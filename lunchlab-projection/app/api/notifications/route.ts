import { NextRequest, NextResponse } from "next/server";
import {
  buildNotificationMessage,
  sendJandiNotification,
} from "@/lib/services/notificationService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = buildNotificationMessage(body);
    await sendJandiNotification(message);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.startsWith("Unknown notification type") ? 400 : 500;
    console.error("Notification error:", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
