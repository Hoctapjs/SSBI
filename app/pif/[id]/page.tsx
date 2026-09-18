import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { arr, str, type Pif } from "@/lib/payload";
import { JsonView } from "../../Json";

export const dynamic = "force-dynamic";

function V({ v }: { v: unknown }) {
  // Odoo gửi `false` cho trường rỗng (mục 3.1) — hiển thị như "trống", không như boolean.
  if (v === false || v === null || v === undefined || v === "")
    return <span className="null">— trống —</span>;
  if (v === true) return <span>true</span>;
  return <span>{String(v)}</span>;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="block card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function PifDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pifId = decodeURIComponent(id);

  await ensureSchema();
  const rows = await sql<Pif>`SELECT * FROM pif WHERE pif_id = ${pifId}`;
  if (rows.length === 0) notFound();

  const r = rows[0];
  const p = r.payload as Record<string, any>;
  const pricing = (p.pricing ?? {}) as Record<string, any>;
  const product = (p.product ?? {}) as Record<string, any>;
  const deployment = (p.deployment ?? {}) as Record<string, any>;
  const quality = (p.quality ?? {}) as Record<string, any>;
  const sourcePaf = p.source_paf as Record<string, any> | undefined;
  const source = (p.source ?? {}) as Record<string, any>;

  const platforms = arr(p.platforms) as Record<string, any>[];
  const components = arr(p.components) as Record<string, any>[];
  const stores = arr(deployment.stores) as Record<string, any>[];
  const categoryPath = arr(product.category_path).map(String);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <Link className="back" href="/">
            ← Danh sách hồ sơ
          </Link>
          <h2 className="page mono">{r.pif_id}</h2>
          <div className="crumb">
            {r.product_name_en || r.product_name_vi || "— chưa đặt tên —"} ·{" "}
            <span className={r.state === "completed" ? "tag ok" : "tag warn"}>{r.state ?? "—"}</span>{" "}
            <span className="tag accent">{r.external_id}</span>{" "}
            <span className="tag">đã nhận {r.push_count} lần</span>
          </div>
        </div>
      </header>

      <div className="wrap">
        {r.state && r.state !== "completed" && (
          <p className="notice">
            Phiếu chưa ở trạng thái <code className="inline">completed</code> — theo đặc tả mục 3.2 nên coi đây là{" "}
            <strong>dữ liệu nháp</strong> (thường là lần IT đẩy tay để kiểm thử).
          </p>
        )}

        <div className="grid">
          <Block title="Nhận dạng">
            <dl className="kv">
              <Row k="pif_id">
                <span className="mono">{r.pif_id}</span>
              </Row>
              <Row k="state">
                <V v={p.state} />
              </Row>
              <Row k="request_type">
                <V v={p.request_type} />
              </Row>
              <Row k="plu_code">
                <span className="mono">
                  <V v={p.plu_code} />
                </span>
              </Row>
              <Row k="product_name_en">
                <V v={p.product_name_en} />
              </Row>
              <Row k="product_name_vi">
                <V v={p.product_name_vi} />
              </Row>
            </dl>
          </Block>

          <Block title="Giá bán (chưa VAT)">
            <dl className="kv">
              <Row k="pricing.currency">
                <V v={pricing.currency} />
              </Row>
              <Row k="pricing.instore">
                {typeof pricing.instore === "number" ? (
                  <>
                    <span className="mono">{pricing.instore.toLocaleString("vi-VN")}</span>
                    {pricing.instore === 0 && (
                      <span className="tag warn note"> giá 0 — xem mục 9.3</span>
                    )}
                  </>
                ) : (
                  <V v={pricing.instore} />
                )}
              </Row>
            </dl>
          </Block>

          <Block title="Sản phẩm">
            <dl className="kv">
              <Row k="wrin_finished">
                <span className="mono">
                  <V v={product.wrin_finished} />
                </span>
              </Row>
              <Row k="product_code">
                <span className="mono">
                  <V v={product.product_code} />
                </span>
              </Row>
              <Row k="category_path">
                {categoryPath.length ? categoryPath.join(" › ") : <span className="null">— trống —</span>}
              </Row>
            </dl>
          </Block>

          <Block title="Chất lượng">
            <dl className="kv">
              <Row k="lab_test_result">
                {str(quality.lab_test_result) ? (
                  <span className={`tag ${quality.lab_test_result === "pass" ? "ok" : "err"}`}>
                    {String(quality.lab_test_result)}
                  </span>
                ) : (
                  <V v={quality.lab_test_result} />
                )}
              </Row>
              <Row k="lab_signed_date">
                <span className="mono">
                  <V v={quality.lab_signed_date} />
                </span>
              </Row>
            </dl>
          </Block>

          <Block title="Triển khai">
            <dl className="kv">
              <Row k="mass_deploy_date">
                <span className="mono">
                  <V v={deployment.mass_deploy_date} />
                </span>
              </Row>
              <Row k="store_count">
                <V v={deployment.store_count} />
              </Row>
              <Row k="số dòng stores[] nhận được">{stores.length}</Row>
            </dl>
          </Block>

          <Block title="Nguồn gửi">
            <dl className="kv">
              <Row k="schema_version">
                <V v={p.schema_version} />
              </Row>
              <Row k="sent_at (giờ máy chủ Odoo, UTC)">
                <span className="mono">
                  <V v={p.sent_at} />
                </span>
              </Row>
              <Row k="source.system">
                <V v={source.system} />
              </Row>
              <Row k="source.db">
                <V v={source.db} />
              </Row>
              <Row k="lần nhận đầu">
                <span className="mono">{new Date(r.first_seen_at).toLocaleString("vi-VN", { hour12: false })}</span>
              </Row>
              <Row k="cập nhật gần nhất">
                <span className="mono">{new Date(r.updated_at).toLocaleString("vi-VN", { hour12: false })}</span>
              </Row>
            </dl>
          </Block>
        </div>

        <Block title="source_paf — chương trình PAF gốc">
          {sourcePaf ? (
            <dl className="kv">
              <Row k="paf_code">
                <V v={sourcePaf.paf_code} />
              </Row>
              <Row k="program_name">
                <V v={sourcePaf.program_name} />
              </Row>
            </dl>
          ) : (
            <div className="empty small">
              Payload không có khối <code className="inline">source_paf</code> — phiếu này tạo tay, không sinh từ PAF
              (đặc tả mục 4).
            </div>
          )}
        </Block>

        <Block title={`platforms[] — kênh bán (${platforms.length})`}>
          {platforms.length === 0 ? (
            <div className="empty small">
              Rỗng — phiếu chưa chọn kênh bán. Theo Phụ lục đặc tả, đây là thiếu dữ liệu phiếu, không phải lỗi.
            </div>
          ) : (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>code</th>
                    <th>name</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((x, i) => (
                    <tr key={i}>
                      <td className="mono">
                        <V v={x.code} />
                      </td>
                      <td>
                        <V v={x.name} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Block>

        <Block title={`components[] — thành phần BOM (${components.length})`}>
          {components.length === 0 ? (
            <div className="empty small">
              Rỗng — sản phẩm chưa gắn BOM đang in-use. Odoo cảnh báo việc này ở ô <em>Recipe Sync Note</em>.
            </div>
          ) : (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>product_code</th>
                    <th>product_name</th>
                    <th className="num">qty</th>
                    <th>uom</th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((x, i) => (
                    <tr key={i}>
                      <td className="mono">
                        <V v={x.product_code} />
                      </td>
                      <td>
                        <V v={x.product_name} />
                      </td>
                      <td className="num">
                        <V v={x.qty} />
                      </td>
                      <td>
                        <V v={x.uom} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Block>

        <Block title={`deployment.stores[] — cửa hàng (${stores.length}${
          typeof deployment.store_count === "number" ? ` / khai báo ${deployment.store_count}` : ""
        })`}>
          {stores.length === 0 ? (
            <div className="empty small">Payload không kèm dòng cửa hàng nào.</div>
          ) : (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>code</th>
                    <th>name</th>
                    <th>status</th>
                    <th>result</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((s, i) => (
                    <tr key={i}>
                      <td className="mono">
                        <V v={s.code} />
                      </td>
                      <td>
                        <V v={s.name} />
                      </td>
                      <td>
                        <span className="tag">{str(s.status) ?? "—"}</span>
                      </td>
                      <td>
                        {str(s.result) ? (
                          <span className={`tag ${s.result === "pass" ? "ok" : "err"}`}>{String(s.result)}</span>
                        ) : (
                          // status và result độc lập nhau (mục 3.6): đã triển khai
                          // nhưng chưa ai ghi kết quả là hợp lệ.
                          <span className="null">chưa chấm</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Block>

        <Block title="Raw JSON — nguyên văn payload Odoo gửi">
          <JsonView value={r.payload} />
        </Block>
      </div>
    </>
  );
}
