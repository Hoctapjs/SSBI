"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { LogRow, Pif } from "@/lib/payload";

type Tab = "pifs" | "logs" | "howto";

const REFRESH_MS = 5000;

function fmtTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("vi-VN", { hour12: false });
}

function money(v: number | string | null, ccy: string | null) {
  if (v === null || v === undefined) return <span className="null">—</span>;
  const n = Number(v);
  if (!Number.isFinite(n)) return <span className="null">—</span>;
  return `${n.toLocaleString("vi-VN")} ${ccy ?? ""}`.trim();
}

function stateTag(state: string | null) {
  if (!state) return <span className="null">—</span>;
  return <span className={state === "completed" ? "tag ok" : "tag warn"}>{state}</span>;
}

export default function Dashboard({ endpoint }: { endpoint: string }) {
  const [tab, setTab] = useState<Tab>("pifs");
  const [pifs, setPifs] = useState<Pif[] | null>(null);
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [live, setLive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([
        fetch("/api/pifs", { cache: "no-store" }),
        fetch("/api/logs", { cache: "no-store" }),
      ]);
      if (!p.ok || !l.ok) throw new Error(`HTTP ${p.ok ? l.status : p.status}`);
      setPifs((await p.json()).rows);
      setLogs((await l.json()).rows);
      setLastSync(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [live, load]);

  const failed = logs?.filter((l) => !l.ok).length ?? 0;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <h1>SSBI Receiver</h1>
            <span className="sub">
              Tiếp nhận hồ sơ PIF — bước B13, Odoo <code className="inline">M08_P0801</code> · schema v1.1
            </span>
          </div>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "pifs"} onClick={() => setTab("pifs")}>
              Hồ sơ PIF {pifs ? `(${pifs.length})` : ""}
            </button>
            <button role="tab" aria-selected={tab === "logs"} onClick={() => setTab("logs")}>
              Nhật ký request {logs ? `(${logs.length}${failed ? `, ${failed} lỗi` : ""})` : ""}
            </button>
            <button role="tab" aria-selected={tab === "howto"} onClick={() => setTab("howto")}>
              Cấu hình &amp; kiểm thử
            </button>
          </div>
        </div>
      </header>

      <div className="wrap">
        <div className="bar">
          <label>
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Tự cập nhật mỗi {REFRESH_MS / 1000}s
          </label>
          <span>
            <span className={`dot${live ? "" : " idle"}`} />{" "}
            {lastSync ? `đồng bộ ${fmtTime(lastSync.toISOString())}` : "đang tải…"}
          </span>
          <button className="btn" onClick={load}>
            Làm mới ngay
          </button>
          {error && <span className="tag err">{error}</span>}
        </div>

        {tab === "pifs" && <PifTable rows={pifs} />}
        {tab === "logs" && <LogTable rows={logs} />}
        {tab === "howto" && <HowTo endpoint={endpoint} />}
      </div>
    </>
  );
}

function PifTable({ rows }: { rows: Pif[] | null }) {
  if (!rows)
    return (
      <div className="card">
        <div className="empty">Đang tải…</div>
      </div>
    );
  if (rows.length === 0)
    return (
      <div className="card">
        <div className="empty">
          Chưa nhận được hồ sơ nào.
          <br />
          Mở tab <strong>Cấu hình &amp; kiểm thử</strong> để lấy URL endpoint đưa cho Odoo.
        </div>
      </div>
    );

  return (
    <div className="card scroll-x">
      <table>
        <thead>
          <tr>
            <th>PIF ID</th>
            <th>Tên sản phẩm</th>
            <th>PLU</th>
            <th>State</th>
            <th>Loại YC</th>
            <th className="num">Giá instore</th>
            <th className="num">Cửa hàng</th>
            <th>Lab</th>
            <th className="num">Lần đẩy</th>
            <th>Cập nhật</th>
            <th>External ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.pif_id}>
              <td className="mono">
                <Link href={`/pif/${encodeURIComponent(r.pif_id)}`}>{r.pif_id}</Link>
              </td>
              <td>
                {r.product_name_en || r.product_name_vi || (
                  <span className="null">— chưa đặt tên —</span>
                )}
              </td>
              <td className="mono">{r.plu_code ?? <span className="null">—</span>}</td>
              <td>{stateTag(r.state)}</td>
              <td>
                <span className="tag">{r.request_type ?? "—"}</span>
              </td>
              <td className="num">{money(r.price_instore, r.currency)}</td>
              <td className="num">{r.store_count ?? <span className="null">—</span>}</td>
              <td>
                {r.lab_test_result ? (
                  <span className={`tag ${r.lab_test_result === "pass" ? "ok" : "err"}`}>
                    {r.lab_test_result}
                  </span>
                ) : (
                  <span className="null">—</span>
                )}
              </td>
              <td className="num">{r.push_count}</td>
              <td className="mono">{fmtTime(r.updated_at)}</td>
              <td className="mono">{r.external_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogTable({ rows }: { rows: LogRow[] | null }) {
  if (!rows)
    return (
      <div className="card">
        <div className="empty">Đang tải…</div>
      </div>
    );
  if (rows.length === 0)
    return (
      <div className="card">
        <div className="empty">Chưa có request nào chạm tới endpoint.</div>
      </div>
    );

  return (
    <div className="card scroll-x">
      <table>
        <thead>
          <tr>
            <th>Thời điểm</th>
            <th>Status</th>
            <th>PIF ID</th>
            <th>Error code</th>
            <th>Message</th>
            <th>IP</th>
            <th>User-Agent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td className="mono">{fmtTime(l.received_at)}</td>
              <td>
                <span className={`tag ${l.ok ? "ok" : "err"}`}>{l.status}</span>
              </td>
              <td className="mono">{l.pif_id ?? <span className="null">—</span>}</td>
              <td className="mono">{l.error_code ?? <span className="null">—</span>}</td>
              <td>{l.message}</td>
              <td className="mono">{l.ip ?? <span className="null">—</span>}</td>
              <td className="mono trunc">{l.user_agent ?? <span className="null">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SAMPLE = `{
  "schema_version": "1.1",
  "sent_at": "2026-09-18T04:04:48",
  "source": { "system": "ODOO_PSM", "db": "admin08_0901" },
  "pif_id": "PIF/2026/0005",
  "state": "completed",
  "request_type": "supply_chain",
  "plu_code": "PLU-0005",
  "product_name_en": "3PO_FIFA World Cup Meal 2026",
  "product_name_vi": false,
  "pricing": { "currency": "VND", "instore": 0.0 },
  "platforms": [],
  "components": [],
  "product": { "wrin_finished": false, "product_code": "2770", "category_path": [] },
  "deployment": {
    "mass_deploy_date": "2026-09-17",
    "store_count": 12,
    "stores": [
      { "code": "ST-CT-001", "name": "Aeon Tan Phu", "status": "mass_dev", "result": "pass" }
    ]
  },
  "quality": { "lab_test_result": "pass", "lab_signed_date": "2026-09-17T04:17:32" }
}`;

function HowTo({ endpoint }: { endpoint: string }) {
  const curl = [
    `curl -X POST ${endpoint} \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Authorization: Bearer $SSBI_API_KEY" \\`,
    `  -d '${SAMPLE.replace(/\n\s*/g, " ")}'`,
  ].join("\n");

  return (
    <div className="card pad">
      <h3 className="first">1. Hai tham số cần khai bên Odoo</h3>
      <p className="muted">Settings → Technical → System Parameters (đặc tả mục 7):</p>
      <dl className="kv boxed">
        <div>
          <dt className="mono">m08_p0801.ssbi_endpoint_url</dt>
          <dd className="mono">{endpoint}</dd>
        </div>
        <div>
          <dt className="mono">m08_p0801.ssbi_api_key</dt>
          <dd className="mono">giá trị của biến môi trường SSBI_API_KEY trên Vercel</dd>
        </div>
      </dl>

      <h3>2. Thử bằng curl</h3>
      <pre className="json boxed">{curl}</pre>

      <h3>3. Phản hồi endpoint trả về</h3>
      <p className="muted">
        Thành công <code className="inline">200</code> — Odoo lưu <code className="inline">external_id</code> vào{" "}
        <code className="inline">x_psm_ssbi_external_id</code>:
      </p>
      <pre className="json boxed">
        {`{ "ok": true, "external_id": "SSBI-2026-000871", "message": "accepted" }`}
      </pre>
      <p className="muted">
        Lỗi — Odoo đặt trạng thái <code className="inline">failed</code>:
      </p>
      <pre className="json boxed">
        {`{ "ok": false, "error_code": "UNAUTHORIZED", "message": "Thiếu hoặc sai Authorization" }`}
      </pre>

      <h3>4. Những gì endpoint này đã đáp ứng theo đặc tả</h3>
      <ul className="muted spaced">
        <li>
          <strong>Idempotency (mục 6)</strong> — upsert theo <code className="inline">pif_id</code>; lần gửi sau ghi đè
          bản cũ và tăng bộ đếm <em>Lần đẩy</em>. <code className="inline">external_id</code> giữ nguyên qua các lần đẩy
          lại, đúng vai trò mã đối chiếu hai chiều.
        </li>
        <li>
          <strong>
            <code className="inline">false</code> vs <code className="inline">null</code> (mục 9.1)
          </strong>{" "}
          — endpoint nhận cả hai; payload nguyên văn vẫn giữ trong Raw JSON nên không mất thông tin.
        </li>
        <li>
          <strong>Xác thực (mục 7)</strong> — bắt buộc <code className="inline">Authorization: Bearer</code>, sai key trả
          401 kèm <code className="inline">error_code</code>.
        </li>
        <li>
          <strong>
            <code className="inline">source_paf</code> tuỳ chọn (mục 4)
          </strong>{" "}
          — phiếu tạo tay không có khối này vẫn nhận bình thường.
        </li>
        <li>
          <strong>Timeout 20s (mục 7)</strong> — đường ghi chỉ có một câu lệnh upsert, phản hồi dưới một giây.
        </li>
      </ul>
    </div>
  );
}
