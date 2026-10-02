const dt = new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });

/** يحوّل أي قيمة وقت (Timestamp أو Date أو رقم أو نص أو {seconds}) إلى ميلي ثانية، أو null إن لم تصلح */
export function toMs(t: unknown): number | null {
  if (t == null || t === "") return null;
  const o = t as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
  let v: number;
  if (typeof o.toMillis === "function") v = o.toMillis();
  else if (typeof o.toDate === "function") v = o.toDate().getTime();
  else if (typeof o.seconds === "number") v = o.seconds * 1000;
  else if (t instanceof Date) v = t.getTime();
  else if (typeof t === "number") v = t < 1e11 ? t * 1000 : t; // ثوانٍ أو ميلي ثانية
  else if (typeof t === "string") v = Date.parse(t);
  else return null;
  return Number.isFinite(v) ? v : null;
}

export const fmt = (t?: unknown) => { const ms = toMs(t); return ms === null ? "—" : dt.format(new Date(ms)); };

/** «قبل 3 ساعات» */
export function ago(t?: unknown): string {
  const ms = toMs(t);
  if (ms === null) return "—";
  const s = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return "الآن";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** تحليل CSV بسيط يدعم الاقتباس والفواصل داخل الحقول */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === "؛" || c === ";" || c === "\t") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export function toCsv(rows: (string | number | undefined)[][]): string {
  const esc = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

export function download(name: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
