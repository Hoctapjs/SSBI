/**
 * Odoo serialize trường rỗng thành `false` (JSON boolean), không phải null/""
 * — xem mục 3.1 của đặc tả. Mọi trường không bắt buộc phải chịu được cả hai.
 */
export function str(v: unknown): string | null {
  if (v === false || v === null || v === undefined || v === "") return null;
  return String(v);
}

export function num(v: unknown): number | null {
  if (v === false || v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
}

/** Ngày dạng "2026-09-17"; `false` hoặc rác → null để Postgres không nổ. */
export function date(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

export function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export type Pif = {
  pif_id: string;
  external_id: string;
  schema_version: string | null;
  state: string | null;
  request_type: string | null;
  plu_code: string | null;
  product_name_en: string | null;
  product_name_vi: string | null;
  currency: string | null;
  price_instore: number | null;
  store_count: number | null;
  mass_deploy_date: string | null;
  lab_test_result: string | null;
  paf_code: string | null;
  payload: Record<string, unknown>;
  sent_at: string | null;
  source_db: string | null;
  push_count: number;
  first_seen_at: string;
  updated_at: string;
};

export type LogRow = {
  id: number;
  received_at: string;
  pif_id: string | null;
  status: number;
  ok: boolean;
  error_code: string | null;
  message: string | null;
  ip: string | null;
  user_agent: string | null;
  body: unknown;
};

/** Mã đối chiếu trả về Odoo — lưu vào x_psm_ssbi_external_id (mục 5.1). */
export function makeExternalId(seq: number): string {
  const year = new Date().getUTCFullYear();
  return `SSBI-${year}-${String(seq).padStart(6, "0")}`;
}
