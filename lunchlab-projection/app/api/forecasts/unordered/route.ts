import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getUnorderedAccounts } from "@/lib/repositories/orderQueryRepository";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const productId = searchParams.get("productId");

    if (!date || !productId) {
      return NextResponse.json(
        { error: "date and productId are required" },
        { status: 400 }
      );
    }

    const rows = await getUnorderedAccounts(date, parseInt(productId));
    return NextResponse.json(rows);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Unordered query error:", e);
    return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  }
}
