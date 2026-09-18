import { Pool, types } from "pg";

// pg mặc định biến DATE thành Date theo giờ local, làm "2026-09-20" tụt về
// 19/09 khi serialize sang UTC. Giữ nguyên chuỗi Postgres trả về.
types.setTypeParser(types.builtins.DATE, (v) => v);

function connectionString(): string {
  const cs =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SSBI_DATABASE_URL;
  if (!cs) {
    throw new Error(
      "Thiếu biến môi trường DATABASE_URL (hoặc POSTGRES_URL). " +
        "Tạo một Postgres database trên Vercel/Neon rồi nối vào project."
    );
  }
  return cs;
}

/**
 * Serverless nên giữ pool nhỏ và tái dùng qua globalThis: mỗi lambda instance
 * chỉ mở một pool, hot-reload lúc dev không sinh pool mới.
 */
const g = globalThis as unknown as { __ssbiPool?: Pool };

function pool(): Pool {
  if (!g.__ssbiPool) {
    const cs = connectionString();
    g.__ssbiPool = new Pool({
      connectionString: cs,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      // Vercel Postgres / Neon / Supabase đều là TLS với cert không nằm trong
      // trust store của lambda; Postgres local thì không có TLS.
      ssl: /localhost|127\.0\.0\.1|sslmode=disable/.test(cs)
        ? undefined
        : { rejectUnauthorized: false },
    });
  }
  return g.__ssbiPool;
}

/**
 * Template tag dựng câu lệnh tham số hóa: mỗi `${...}` thành $1, $2, …
 * nên giá trị không bao giờ được nối thẳng vào SQL.
 */
export async function sql<T = any>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const text = strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""),
    ""
  );
  const res = await pool().query(text, values);
  return res.rows as T[];
}

let ready: Promise<void> | null = null;

/**
 * Tạo bảng nếu chưa có. Gọi ở đầu mọi route — rẻ vì chỉ chạy thật một lần
 * cho mỗi lambda instance.
 */
export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await sql`CREATE SEQUENCE IF NOT EXISTS ssbi_external_seq START 1`;
      await sql`
        CREATE TABLE IF NOT EXISTS pif (
          pif_id            text PRIMARY KEY,
          external_id       text NOT NULL,
          schema_version    text,
          state             text,
          request_type      text,
          plu_code          text,
          product_name_en   text,
          product_name_vi   text,
          currency          text,
          price_instore     numeric,
          store_count       integer,
          mass_deploy_date  date,
          lab_test_result   text,
          paf_code          text,
          payload           jsonb NOT NULL,
          sent_at           text,
          source_db         text,
          push_count        integer NOT NULL DEFAULT 1,
          first_seen_at     timestamptz NOT NULL DEFAULT now(),
          updated_at        timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS request_log (
          id          bigserial PRIMARY KEY,
          received_at timestamptz NOT NULL DEFAULT now(),
          pif_id      text,
          status      integer NOT NULL,
          ok          boolean NOT NULL,
          error_code  text,
          message     text,
          ip          text,
          user_agent  text,
          body        jsonb
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS request_log_received_at_idx ON request_log (received_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS pif_updated_at_idx ON pif (updated_at DESC)`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
