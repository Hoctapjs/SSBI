/** Tô màu JSON không cần thư viện ngoài — escape trước, rồi đánh dấu token. */
export function JsonView({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2) ?? "null";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = escaped.replace(
    /("(?:\.|[^"\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m, strTok, colon, bool, numTok) => {
      if (strTok) return colon ? `<span class="k">${strTok}</span>${colon}` : `<span class="s">${strTok}</span>`;
      if (bool) return `<span class="b">${bool}</span>`;
      if (numTok) return `<span class="n">${numTok}</span>`;
      return m;
    }
  );

  return <pre className="json" dangerouslySetInnerHTML={{ __html: html }} />;
}
