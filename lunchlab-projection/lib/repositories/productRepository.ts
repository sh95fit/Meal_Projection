// ──────────────────────────────────────────────────────────────────
// lib/repositories/productRepository.ts
// Supabase products 테이블 CRUD + 색상 관리
// ──────────────────────────────────────────────────────────────────
import { createClient } from "@/lib/supabase/server";
import { getRandomProductColor, isValidHexColor, PRESET_COLORS } from "@/lib/utils/color";
import type { Product, ProductWithMappings } from "@/types";

// ──────────────────────────────────────────────────────────────────
// A. Input 타입
// ──────────────────────────────────────────────────────────────────

export interface CreateProductInput {
  product_name: string;
  offset_days?: number;
  notification_group?: string;
  color?: string;
}

export interface UpdateProductInput {
  product_name?: string;
  offset_days?: number;
  notification_group?: string;
  color?: string;
}

// ──────────────────────────────────────────────────────────────────
// B. 조회
// ──────────────────────────────────────────────────────────────────

/** 전체 상품 + 매핑 목록 조회 (ProductTable용) */
export async function getAllProductsWithMappings(): Promise<ProductWithMappings[]> {
  const supabase = await createClient();

  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id, product_name, offset_days, notification_group, color, deleted_at, created_at, updated_at")
    .is("deleted_at", null)
    .order("id", { ascending: true });

  if (pErr) throw new Error(pErr.message);

  const { data: mappings, error: mErr } = await supabase
    .from("product_id_mappings")
    .select("id, product_id, channel, external_id");

  if (mErr) throw new Error(mErr.message);

  const mappingsByProduct = new Map<number, { id: number; product_id: number; channel: "web" | "app"; external_id: string }[]>();
  for (const m of mappings || []) {
    const pid = Number(m.product_id);
    if (!mappingsByProduct.has(pid)) mappingsByProduct.set(pid, []);
    mappingsByProduct.get(pid)!.push({
      id: Number(m.id),
      product_id: pid,
      channel: m.channel as "web" | "app",
      external_id: String(m.external_id),
    });
  }

  return (products || []).map((row, idx) => ({
    ...row,
    color: row.color || PRESET_COLORS[idx % PRESET_COLORS.length],
    mappings: mappingsByProduct.get(row.id) || [],
  }));
}

/** 전체 상품 목록 조회 (매핑 불필요한 경우) */
export async function getAllProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, product_name, offset_days, notification_group, color, deleted_at, created_at, updated_at")
    .is("deleted_at", null)
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((row, idx) => ({
    ...row,
    color: row.color || PRESET_COLORS[idx % PRESET_COLORS.length],
  }));
}

/** 상품 1건 조회 */
export async function getProductById(id: number): Promise<Product> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, product_name, offset_days, notification_group, color, deleted_at, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return { ...data, color: data.color || "#818cf8" };
}

// ──────────────────────────────────────────────────────────────────
// C. 색상 전용 조회 (대시보드 차트용)
// ──────────────────────────────────────────────────────────────────

export async function getProductColorMap(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("product_name, color")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  if (data) {
    data.forEach((row, idx) => {
      map.set(row.product_name, row.color || PRESET_COLORS[idx % PRESET_COLORS.length]);
    });
  }
  return map;
}

export async function getUsedColors(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("color")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  return (data || []).map((p) => p.color).filter(Boolean);
}

// ──────────────────────────────────────────────────────────────────
// D. 생성
// ──────────────────────────────────────────────────────────────────

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const supabase = await createClient();

  let color: string;
  if (input.color && isValidHexColor(input.color)) {
    color = input.color;
  } else {
    const usedColors = await getUsedColors();
    color = getRandomProductColor(usedColors);
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      product_name: input.product_name,
      offset_days: input.offset_days ?? 3,
      notification_group: input.notification_group || null,
      color,
    })
    .select("id, product_name, offset_days, notification_group, color, deleted_at, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ──────────────────────────────────────────────────────────────────
// E. 수정
// ──────────────────────────────────────────────────────────────────

export async function updateProduct(id: number, input: UpdateProductInput): Promise<Product> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {};

  if (input.product_name !== undefined) updates.product_name = input.product_name;
  if (input.offset_days !== undefined) updates.offset_days = input.offset_days;
  if (input.notification_group !== undefined) updates.notification_group = input.notification_group;

  if (input.color !== undefined) {
    if (!isValidHexColor(input.color)) {
      throw new Error("유효한 hex 색상 코드를 입력해주세요. (예: #818cf8)");
    }
    updates.color = input.color;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("수정할 항목이 없습니다.");
  }

  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select("id, product_name, offset_days, notification_group, color, deleted_at, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ──────────────────────────────────────────────────────────────────
// F. 삭제 (soft delete)
// ──────────────────────────────────────────────────────────────────

export async function deleteProduct(id: number): Promise<Product> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, product_name, offset_days, notification_group, color, deleted_at, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}


// ──────────────────────────────────────────────────────────────────
// G. 상품 ID 매핑 조회 (orderQueryRepository용)
// ──────────────────────────────────────────────────────────────────

export interface ProductMapping {
  id: number;
  product_id: number;
  channel: "web" | "app";
  external_id: string;
}

/** 특정 상품의 채널별 외부 ID 매핑 목록 조회 */
export async function getProductMappings(productId: number): Promise<ProductMapping[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_id_mappings")
    .select("id, product_id, channel, external_id")
    .eq("product_id", productId);

  if (error) throw new Error(error.message);

  return (data || []).map((m: Record<string, unknown>) => ({
    id: Number(m.id),
    product_id: Number(m.product_id),
    channel: m.channel as "web" | "app",
    external_id: String(m.external_id),
  }));
}