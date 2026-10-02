import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { PageHead, useUi } from "../components/ui";
import { db, errMsg } from "../lib/firebase";
import { AppSettings, DEFAULT_SETTINGS } from "../lib/types";

const FIELDS: [keyof AppSettings, string, number][] = [
  ["tagline", "العبارة الرئيسية في أعلى الشاشة الرئيسية", 120],
  ["searchHint", "نص مربع البحث في الشاشة الرئيسية", 80],
];

export default function Settings() {
  const { toast } = useUi();
  const [f, setF] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(doc(db, "settings", "app"), (s) => {
    if (s.exists()) setF({ ...DEFAULT_SETTINGS, ...(s.data() as Partial<AppSettings>) });
  }), []);

  const save = async () => {
    setBusy(true);
    try {
      const out = Object.fromEntries(FIELDS.map(([k, , max]) => [k, (f[k] || DEFAULT_SETTINGS[k]).trim().slice(0, max)]));
      await setDoc(doc(db, "settings", "app"), out);
      setDirty(false);
      toast("تم حفظ النصوص، وستظهر في التطبيق فوراً");
    } catch (e) { toast(errMsg(e), "err"); }
    setBusy(false);
  };

  return (
    <>
      <PageHead title="نصوص التطبيق" sub="عدّل النصوص الظاهرة في الشاشة الرئيسية بدون تحديث التطبيق" />
      <fieldset className="form cols-1" disabled={busy}>
        {FIELDS.map(([k, label, max]) => (
          <label key={k}>{label}
            <input value={f[k]} maxLength={max} onChange={(e) => { setF({ ...f, [k]: e.target.value }); setDirty(true); }} />
          </label>
        ))}
      </fieldset>
      <div className="actions">
        <button className="btn" disabled={busy || !dirty} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
        <button className="btn ghost" disabled={busy} onClick={() => { setF(DEFAULT_SETTINGS); setDirty(true); }}>استعادة الافتراضي</button>
      </div>
    </>
  );
}
