import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT id, received_at, pif_id, status, ok, error_code, message, ip, user_agent
      FROM request_log
      ORDER BY received_at DESC
      LIMIT 200
    `;
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json(
      { rows: [], error: e instanceof Error ? e.message : "Lỗi đọc dữ liệu" },
      { status: 503 }
    );
  }
}
