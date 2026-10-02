import { useRef, useState } from "react";
import { fileToDataUrl } from "../lib/image";
import { useUi } from "./ui";

/** اختيار صورة وتصغيرها وإرجاعها كنص data URL (أو "" عند الحذف) */
export default function ImagePicker({
  value, onChange, size = 256, label = "صورة", round = false, wide = false, maxChars,
}: { value?: string; onChange: (v: string) => void; size?: number; label?: string; round?: boolean; wide?: boolean; maxChars?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);

  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await fileToDataUrl(f, size, 0.8, maxChars)); }
    catch (e) { toast((e as Error).message, "err"); }
    setBusy(false);
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="imgpick">
      <div className={`thumb${round ? " round" : ""}${wide ? " wide" : ""}`}>{value ? <img src={value} alt="" /> : <span className="muted small">بلا صورة</span>}</div>
      <div className="imgpick-actions">
        <button type="button" className="btn small ghost" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "جارٍ المعالجة…" : value ? `تغيير ${label}` : `رفع ${label}`}</button>
        {value && <button type="button" className="btn small danger-outline" onClick={() => onChange("")}>حذف</button>}
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
