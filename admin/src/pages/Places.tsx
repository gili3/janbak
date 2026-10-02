import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { useData, useSections } from "../components/data";
import ImagePicker from "../components/ImagePicker";
import { Empty, Modal, PageHead, StatusBadge, useUi } from "../components/ui";
import SecIcon from "../components/SecIcon";
import { db, errMsg } from "../lib/firebase";
import { download, parseCsv, toCsv } from "../lib/format";
import { latinDigits, validPhone } from "../lib/phone";
import { EMPTY_FIELDS, Place, PlaceFields, Section } from "../lib/types";

const PAGE = 25;

export default function Places() {
  const { places } = useData();
  const secs = useSections();
  const { toast, confirm } = useUi();
  const [q, setQ] = useState("");
  const [sec, setSec] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<Place | "new" | null>(null);
  const [importing, setImporting] = useState(false);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return places.rows
      .filter((p) => (!sec || p.section === sec) && (!status || p.status === status))
      .filter((p) => !t || [p.name, p.phone, p.services, p.address].some((x) => (x ?? "").toLowerCase().includes(t)))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [places.rows, q, sec, status]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const rows = list.slice(cur * PAGE, cur * PAGE + PAGE);

  const toggleHidden = async (p: Place) => {
    try {
      await updateDoc(doc(db, "places", p.id), { status: p.status === "hidden" ? "approved" : "hidden", updatedAt: serverTimestamp() });
      toast(p.status === "hidden" ? "أصبح النشاط ظاهراً" : "تم إخفاء النشاط");
    } catch (e) { toast(errMsg(e), "err"); }
  };

  const remove = async (p: Place) => {
    if (!(await confirm({ title: `حذف «${p.name}»؟`, body: "الحذف نهائي. للإخفاء المؤقت استخدم زر «إخفاء».", confirmLabel: "حذف نهائي", danger: true }))) return;
    try { await deleteDoc(doc(db, "places", p.id)); toast("تم الحذف"); } catch (e) { toast(errMsg(e), "err"); }
  };

  const exportCsv = () => {
    const head = ["name", "section", "services", "address", "hours", "phone", "whatsapp", "status"];
    download("jenbak-places.csv", toCsv([head, ...list.map((p) => [p.name, p.section, p.services, p.address, p.hours, p.phone, p.whatsapp, p.status])]));
  };

  return (
    <>
      <PageHead title="الأنشطة" sub={`${places.rows.length} نشاط في الدليل`}>
        <button className="btn ghost" onClick={exportCsv} disabled={list.length === 0}>تصدير CSV</button>
        <button className="btn ghost" onClick={() => setImporting(true)}>استيراد CSV</button>
        <button className="btn" onClick={() => setForm("new")}>+ إضافة نشاط</button>
      </PageHead>

      <div className="toolbar">
        <input className="search" placeholder="بحث بالاسم أو الهاتف أو الخدمة…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select value={sec} onChange={(e) => { setSec(e.target.value); setPage(0); }} aria-label="القسم">
          <option value="">كل الأقسام</option>
          {secs.list.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="الحالة">
          <option value="">كل الحالات</option>
          <option value="approved">منشور</option>
          <option value="hidden">مخفي</option>
        </select>
        <span className="muted small">{list.length} نتيجة</span>
      </div>

      {places.error && <p className="notice bad">تعذرت قراءة الأنشطة ({places.error}). تأكد من نشر القواعد ومن وجود admins/‎&lt;UID&gt;.</p>}
      {places.ready && list.length === 0 ? (
        <Empty title={places.rows.length === 0 ? "الدليل فارغ" : "لا توجد نتائج"} body={places.rows.length === 0 ? "أضف نشاطاً أو استورد ملف CSV للبدء" : "غيّر البحث أو الفلاتر"} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>النشاط</th><th>القسم</th><th>الهاتف</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><div className="line-flex">{p.image ? <span className="thumb sm"><img src={p.image} alt="" /></span> : null}<span><b>{p.name}</b><small className="sub">{secs.title(p.section)}{p.ownerUid ? " · من مستخدم" : ""}</small></span></div></td>
                  <td className="nowrap"><span className="line-flex"><SecIcon s={secs.find(p.section)} size={22} />{secs.title(p.section)}</span></td>
                  <td dir="ltr" className="nowrap">{p.phone}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="row-actions">
                    <button className="btn small ghost" onClick={() => setForm(p)}>تعديل</button>
                    <button className="btn small ghost" onClick={() => toggleHidden(p)}>{p.status === "hidden" ? "إظهار" : "إخفاء"}</button>
                    <button className="btn small danger-outline" onClick={() => remove(p)}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="pager">
          <button className="btn small ghost" disabled={cur === 0} onClick={() => setPage(cur - 1)}>السابق</button>
          <span className="muted">{cur + 1} / {pages}</span>
          <button className="btn small ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>التالي</button>
        </div>
      )}

      {form && <PlaceForm place={form === "new" ? null : form} sections={secs.list} onClose={() => setForm(null)} />}
      {importing && <ImportModal sections={secs.list} onClose={() => setImporting(false)} />}
    </>
  );
}

// ───────────────────────── نموذج إضافة/تعديل ─────────────────────────
function PlaceForm({ place, sections, onClose }: { place: Place | null; sections: Section[]; onClose: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState<PlaceFields>(place ? {
    name: place.name, section: place.section, services: place.services ?? "",
    address: place.address ?? "", hours: place.hours ?? "", phone: place.phone, whatsapp: place.whatsapp ?? "",
  } : { ...EMPTY_FIELDS, section: sections.find((s) => s.active)?.id ?? sections[0]?.id ?? "" });
  const [image, setImage] = useState<string>(place?.image ?? "");
  const [status, setStatus] = useState<Place["status"]>(place?.status ?? "approved");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof PlaceFields, v: string) => setF((x) => ({ ...x, [k]: v }));
  const problem = !f.name.trim() ? "اسم النشاط مطلوب" : !f.section ? "اختر القسم" : !validPhone(f.phone) ? "رقم الهاتف: 0 ثم 9 أرقام" : f.whatsapp && !validPhone(f.whatsapp) ? "رقم الواتساب غير صالح" : "";

  const save = async () => {
    setBusy(true);
    const data = { ...f, name: f.name.trim(), status, image, updatedAt: serverTimestamp() };
    try {
      if (place) await updateDoc(doc(db, "places", place.id), data);
      else await addDoc(collection(db, "places"), { ...data, createdAt: serverTimestamp() });
      toast(place ? "تم حفظ التعديلات" : "تمت إضافة النشاط");
      onClose();
    } catch (e) {
      toast(errMsg(e), "err");
      setBusy(false);
    }
  };

  return (
    <Modal title={place ? "تعديل نشاط" : "إضافة نشاط"} onClose={onClose} wide>
      <fieldset className="form" disabled={busy}>
        <label>الاسم *<input autoFocus value={f.name} maxLength={100} onChange={(e) => set("name", e.target.value)} /></label>
        <label>القسم *
          <select value={f.section} onChange={(e) => set("section", e.target.value)}>
            {!f.section && <option value="">اختر القسم…</option>}
            {sections.map((s) => <option key={s.id} value={s.id}>{s.title}{s.active ? "" : " (مخفي)"}</option>)}
          </select>
        </label>
        <label>الحالة
          <select value={status} onChange={(e) => setStatus(e.target.value as Place["status"])}>
            <option value="approved">منشور</option>
            <option value="hidden">مخفي</option>
          </select>
        </label>
        <label>الهاتف *<input dir="ltr" inputMode="numeric" placeholder="0912345678" value={f.phone} onChange={(e) => set("phone", latinDigits(e.target.value))} /></label>
        <label>واتساب<input dir="ltr" inputMode="numeric" placeholder="اختياري" value={f.whatsapp} onChange={(e) => set("whatsapp", latinDigits(e.target.value))} /></label>
        <label>الموقع<input value={f.address} maxLength={200} onChange={(e) => set("address", e.target.value)} /></label>
        <label>ساعات العمل<input value={f.hours} maxLength={100} onChange={(e) => set("hours", e.target.value)} /></label>
        <div className="full"><span className="lbl">صورة النشاط (اختياري)</span><ImagePicker value={image} onChange={setImage} size={192} label="صورة" /></div>
        <label className="full">الخدمات<textarea rows={3} value={f.services} maxLength={500} onChange={(e) => set("services", e.target.value)} /></label>
      </fieldset>
      <div className="actions">
        <button className="btn" disabled={busy || !!problem} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
        <button className="btn ghost" onClick={onClose}>إلغاء</button>
        {problem && <span className="muted small">{problem}</span>}
      </div>
    </Modal>
  );
}

// ───────────────────────── استيراد CSV ─────────────────────────
const HEADERS: Record<string, keyof PlaceFields> = {
  name: "name", الاسم: "name", اسم: "name",
  section: "section", القسم: "section",
  services: "services", الخدمات: "services",
  address: "address", العنوان: "address", الموقع: "address",
  hours: "hours", "ساعات العمل": "hours", الساعات: "hours",
  phone: "phone", الهاتف: "phone", الجوال: "phone",
  whatsapp: "whatsapp", واتساب: "whatsapp",
};

type ParsedRow = { data: PlaceFields; error: string };

function parseRows(text: string, sections: Section[]): ParsedRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const cols = rows[0].map((h) => HEADERS[h.trim().toLowerCase()] ?? HEADERS[h.trim()]);
  return rows.slice(1).map((r) => {
    const d: PlaceFields = { ...EMPTY_FIELDS, section: "" };
    cols.forEach((k, i) => { if (k) d[k] = (r[i] ?? "").trim(); });
    const s = sections.find((x) => x.id === d.section || x.title === d.section);
    d.section = s?.id ?? d.section;
    // إكسل يحذف الصفر الأول من الأرقام
    const fix = (v: string) => { const n = latinDigits(v); return n.length === 9 ? "0" + n : n; };
    d.phone = fix(d.phone);
    d.whatsapp = d.whatsapp ? fix(d.whatsapp) : "";
    const error = !d.name ? "الاسم فارغ" : !s ? "قسم غير معروف" : !validPhone(d.phone) ? "هاتف غير صالح" : d.whatsapp && !validPhone(d.whatsapp) ? "واتساب غير صالح" : "";
    return { data: d, error };
  });
}

function ImportModal({ sections, onClose }: { sections: Section[]; onClose: () => void }) {
  const { toast } = useUi();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const ok = rows.filter((r) => !r.error);

  const onFile = async (file?: File) => { if (file) setRows(parseRows(await file.text(), sections)); };
  const template = () => download("jenbak-template.csv", toCsv([
    ["name", "section", "services", "address", "hours", "phone", "whatsapp"],
    ["بقالة النور", "المحلات", "مواد غذائية ومشروبات", "السوق الرئيسي", "7ص - 10م", "0912345678", ""],
  ]));

  const run = async () => {
    setBusy(true);
    try {
      for (let i = 0; i < ok.length; i += 400) {
        const batch = writeBatch(db);
        ok.slice(i, i + 400).forEach((r) =>
          batch.set(doc(collection(db, "places")), { ...r.data, status: "approved", createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        );
        await batch.commit();
      }
      toast(`تم استيراد ${ok.length} نشاط`);
      onClose();
    } catch (e) {
      toast(errMsg(e), "err");
      setBusy(false);
    }
  };

  return (
    <Modal title="استيراد أنشطة من CSV" onClose={onClose} wide>
      <p className="muted">الأعمدة: name, section, services, address, hours, phone, whatsapp (أو أسماؤها بالعربية). القسم بمفتاحه أو باسمه العربي.</p>
      <div className="actions">
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
        <button className="btn ghost small" onClick={template}>تنزيل قالب</button>
      </div>
      {rows.length > 0 && (
        <>
          <p><b>{ok.length}</b> صالح{rows.length - ok.length > 0 ? <> · <span className="bad-text">{rows.length - ok.length} به أخطاء (سيُتجاوز)</span></> : null}</p>
          <div className="table-wrap short">
            <table>
              <thead><tr><th>الاسم</th><th>القسم</th><th>الهاتف</th><th>الحالة</th></tr></thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td>{r.data.name || "—"}</td><td>{sections.find((x) => x.id === r.data.section)?.title || "—"}</td>
                    <td dir="ltr">{r.data.phone}</td>
                    <td>{r.error ? <span className="badge bad">{r.error}</span> : <span className="badge ok">جاهز</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="actions">
        <button className="btn" disabled={busy || ok.length === 0} onClick={run}>{busy ? "جارٍ الاستيراد…" : `استيراد ${ok.length || ""}`}</button>
        <button className="btn ghost" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
