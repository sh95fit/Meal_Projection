import { NextRequest, NextResponse } from "next/server";
import { getForecasts, upsertForecast } from "@/lib/repositories/forecastRepository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const productIdsParam = searchParams.get("productIds");
    const productIds = productIdsParam
      ? productIdsParam.split(",").map(Number)
      : undefined;

    const forecasts = await getForecasts({ dateFrom, dateTo, productIds });
    return NextResponse.json(forecasts);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const forecastId = await upsertForecast(body);
    return NextResponse.json({ id: forecastId, success: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
