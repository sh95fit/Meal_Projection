// app/api/dashboard/clients/modal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/authService";
import { getClientModalData } from "@/lib/repositories/clientRepository";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const accountIdStr = searchParams.get("accountId");
    if (!accountIdStr) {
      return NextResponse.json(
        { error: "accountId 파라미터가 필요합니다." },
        { status: 400 }
      );
    }

    const accountId = Number(accountIdStr);
    const clientType = searchParams.get("type") || "churned";

    const result = await getClientModalData(accountId, clientType);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
