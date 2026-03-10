import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/products — 상품 목록 조회
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, product_id_mappings(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // product_id_mappings를 mappings로 변환
  const products = data.map((p: Record<string, unknown>) => ({
    ...p,
    mappings: p.product_id_mappings || [],
    product_id_mappings: undefined,
  }));

  return NextResponse.json(products);
}

// POST /api/products — 상품 등록
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const { product_name, offset_days, notification_group, mappings } = body;

  // 상품 등록
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({ product_name, offset_days, notification_group })
    .select()
    .single();

  if (productError) {
    return NextResponse.json(
      { error: productError.message },
      { status: 500 }
    );
  }

  // 매핑 등록
  if (mappings && mappings.length > 0) {
    const mappingRows = mappings.map(
      (m: { channel: string; external_id: string }) => ({
        product_id: product.id,
        channel: m.channel,
        external_id: m.external_id,
      })
    );

    const { error: mappingError } = await supabase
      .from("product_id_mappings")
      .insert(mappingRows);

    if (mappingError) {
      return NextResponse.json(
        { error: mappingError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(product, { status: 201 });
}
