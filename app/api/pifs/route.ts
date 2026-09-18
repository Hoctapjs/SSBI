import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT pif_id, external_id, schema_version, state, request_type, plu_code,
             product_name_en, product_name_vi, currency, price_instore, store_count,
             mass_deploy_date, lab_test_result, paf_code, sent_at, source_db,
             push_count, first_seen_at, updated_at
      FROM pif
      ORDER BY updated_at DESC
      LIMIT 500
    `;
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json(
      { rows: [], error: e instanceof Error ? e.message : "Lỗi đọc dữ liệu" },
      { status: 503 }
    );
  }
}
