import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { str, num, int, date, makeExternalId } from "@/lib/payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Reply = {
  status: number;
  body: { ok: boolean; external_id?: string; error_code?: string; message: string };
  pifId?: string | null;
};

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

async function log(req: NextRequest, r: Reply, body: unknown) {
  try {
    await sql`
      INSERT INTO request_log (pif_id, status, ok, error_code, message, ip, user_agent, body)
      VALUES (${r.pifId ?? null}, ${r.status}, ${r.body.ok}, ${r.body.error_code ?? null},
              ${r.body.message}, ${clientIp(req)}, ${req.headers.get("user-agent")},
              ${body === undefined ? null : JSON.stringify(body)})
    `;
  } catch {
    // Ghi log hỏng thì không được làm hỏng phản hồi cho Odoo.
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    await ensureSchema();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error_code: "STORAGE_UNAVAILABLE",
        message: e instanceof Error ? e.message : "Không kết nối được kho dữ liệu",
      },
      { status: 503 }
    );
  }

  // --- Xác thực: Authorization: Bearer <api_key> (mục 7) ---
  const expected = process.env.SSBI_API_KEY;
  if (!expected) {
    const r: Reply = {
      status: 503,
      body: {
        ok: false,
        error_code: "SERVER_NOT_CONFIGURED",
        message: "Server chưa cấu hình SSBI_API_KEY",
      },
    };
    await log(req, r, undefined);
    return NextResponse.json(r.body, { status: r.status });
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token !== expected) {
    const r: Reply = {
      status: 401,
      body: {
        ok: false,
        error_code: "UNAUTHORIZED",
        message: "Thiếu hoặc sai Authorization: Bearer <api_key>",
      },
    };
    await log(req, r, undefined);
    return NextResponse.json(r.body, { status: r.status });
  }

  // --- Đọc JSON ---
  try {
    body = await req.json();
  } catch {
    const r: Reply = {
      status: 400,
      body: { ok: false, error_code: "INVALID_JSON", message: "Body không phải JSON hợp lệ" },
    };
    await log(req, r, undefined);
    return NextResponse.json(r.body, { status: r.status });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    const r: Reply = {
      status: 400,
      body: { ok: false, error_code: "INVALID_PAYLOAD", message: "Payload phải là một object JSON" },
    };
    await log(req, r, body);
    return NextResponse.json(r.body, { status: r.status });
  }

  const p = body as Record<string, any>;
  const pifId = str(p.pif_id);

  if (!pifId) {
    const r: Reply = {
      status: 400,
      body: { ok: false, error_code: "MISSING_PIF_ID", message: "Thiếu trường bắt buộc pif_id" },
    };
    await log(req, r, body);
    return NextResponse.json(r.body, { status: r.status });
  }

  const pricing = (p.pricing ?? {}) as Record<string, any>;
  const product = (p.product ?? {}) as Record<string, any>;
  const deployment = (p.deployment ?? {}) as Record<string, any>;
  const quality = (p.quality ?? {}) as Record<string, any>;
  const sourcePaf = (p.source_paf ?? {}) as Record<string, any>;
  const source = (p.source ?? {}) as Record<string, any>;

  try {
    // Mã đối chiếu mới, chỉ dùng khi đây là lần đẩy đầu của pif_id này.
    const [{ seq }] = await sql<{ seq: string }>`SELECT nextval('ssbi_external_seq') AS seq`;
    const externalId = makeExternalId(Number(seq));

    // Upsert theo pif_id — mục 6. Lần gửi sau ghi đè, external_id giữ nguyên
    // để mã đối chiếu hai chiều không đổi giữa các lần đẩy lại.
    const rows = await sql<{ external_id: string; push_count: number }>`
      INSERT INTO pif (
        pif_id, external_id, schema_version, state, request_type, plu_code,
        product_name_en, product_name_vi, currency, price_instore, store_count,
        mass_deploy_date, lab_test_result, paf_code, payload, sent_at, source_db
      ) VALUES (
        ${pifId},
        ${externalId},
        ${str(p.schema_version)}, ${str(p.state)}, ${str(p.request_type)}, ${str(p.plu_code)},
        ${str(p.product_name_en)}, ${str(p.product_name_vi)},
        ${str(pricing.currency)}, ${num(pricing.instore)}, ${int(deployment.store_count)},
        ${date(deployment.mass_deploy_date)}, ${str(quality.lab_test_result)},
        ${str(sourcePaf.paf_code)}, ${JSON.stringify(body)},
        ${str(p.sent_at)}, ${str(source.db)}
      )
      ON CONFLICT (pif_id) DO UPDATE SET
        schema_version   = EXCLUDED.schema_version,
        state            = EXCLUDED.state,
        request_type     = EXCLUDED.request_type,
        plu_code         = EXCLUDED.plu_code,
        product_name_en  = EXCLUDED.product_name_en,
        product_name_vi  = EXCLUDED.product_name_vi,
        currency         = EXCLUDED.currency,
        price_instore    = EXCLUDED.price_instore,
        store_count      = EXCLUDED.store_count,
        mass_deploy_date = EXCLUDED.mass_deploy_date,
        lab_test_result  = EXCLUDED.lab_test_result,
        paf_code         = EXCLUDED.paf_code,
        payload          = EXCLUDED.payload,
        sent_at          = EXCLUDED.sent_at,
        source_db        = EXCLUDED.source_db,
        push_count       = pif.push_count + 1,
        updated_at       = now()
      RETURNING external_id, push_count
    `;

    const r: Reply = {
      status: 200,
      pifId,
      body: {
        ok: true,
        external_id: rows[0].external_id,
        message: rows[0].push_count > 1 ? "accepted (updated)" : "accepted",
      },
    };
    await log(req, r, body);
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) {
    const r: Reply = {
      status: 500,
      pifId,
      body: {
        ok: false,
        error_code: "STORAGE_ERROR",
        message: e instanceof Error ? e.message : "Lỗi ghi dữ liệu",
      },
    };
    await log(req, r, body);
    return NextResponse.json(r.body, { status: r.status });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error_code: "METHOD_NOT_ALLOWED",
      message: "Endpoint này chỉ nhận POST. Xem trang chủ để biết cách gọi.",
    },
    { status: 405 }
  );
}
