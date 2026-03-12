import { NextRequest, NextResponse } from "next/server";
import { getProducts, createProduct } from "@/lib/repositories/productRepository";

export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json(products);
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
    const product = await createProduct(body);
    return NextResponse.json(product, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
