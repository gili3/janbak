import { useState } from "react";
import { Timestamp } from "firebase/firestore";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useData } from "../components/data";
import ImagePicker from "../components/ImagePicker";
import { Empty, Modal, PageHead, useUi } from "../components/ui";
import { db, errMsg } from "../lib/firebase";
import { fmt, toMs } from "../lib/format";
import type { Announcement } from "../lib/types";

const isExpired = (a: Announcement) => { const e = toMs(a.expiresAt); return e !== null && e <= Date.now(); };
/** قيمة حقل datetime-local بالتوقيت المحلي */
const toLocalInput = (t?: unknown) => {
  const ms = toMs(t);
  if (ms === null) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function Announcements() {
  const { announcements } = useData();
  const { toast, confirm } = useUi();
  const [form, setForm] = useState<Announcement | "new" | null>(null);

  const rows = [...announcements.rows].sort((a, b) => (toMs(b.createdAt) ?? 0) - (toMs(a.createdAt) ?? 0));

  const remove = async (a: Announcement) => {
    if (!(await confirm({ title: `حذف «${a.title}»؟`, confirmLabel: "حذف", danger: true }))) return;
    try { await deleteDoc(doc(db, "announcements", a.id)); toast("تم الحذف"); } catch (e) { toast(errMsg(e), "err"); }
  };

  const toggleActive = async (a: Announcement) => {
    try { await updateDoc(doc(db, "announcements", a.id), { active: !a.active }); } catch (e) { toast(errMsg(e), "err"); }
  };

  return (
    <>
      <PageHead title="الإعلانات" sub="الإعلانات الفعّالة تظهر في التطبيق فوراً لكل من يفتحه">
        <button className="btn" onClick={() => setForm("new")}>+ إعلان جديد</button>
      </PageHead>
      {announcements.error && <p className="notice bad">تعذرت قراءة الإعلانات ({announcements.error})</p>}
      {announcements.ready && rows.length === 0 ? <Empty title="لا توجد إعلانات" body="أنشئ أول إعلان ليصل لأهل القرية" /> : (
        <div className="ann-grid">
          {rows.map((a) => {
            const live = a.active && !isExpired(a);
            return (
              <article key={a.id} className={`ann-card${live ? "" : " off"}`}>
                <div className="ann-media">
                  {a.image ? <img src={a.image} alt="" /> : <span className="muted small">بلا صورة</span>}
                  <span className="ann-badges">
                    {a.pinned && <span className="badge pin">مثبّت</span>}
                    <span className={`badge ${isExpired(a) ? "bad" : a.active ? "ok" : "off"}`}>{isExpired(a) ? "منتهٍ" : a.active ? "فعّال" : "غير فعّال"}</span>
                  </span>
                </div>
                <div className="ann-body">
                  <h3>{a.title}</h3>
                  {a.body && <p>{a.body}</p>}
                  <small className="muted">أُنشئ {fmt(a.createdAt)}{a.expiresAt ? ` · ينتهي ${fmt(a.expiresAt)}` : ""}</small>
                </div>
                <div className="row-actions">
                  <button className="btn small ghost" onClick={() => setForm(a)}>تعديل</button>
                  <button className="btn small ghost" onClick={() => toggleActive(a)}>{a.active ? "إيقاف" : "تفعيل"}</button>
                  <button className="btn small danger-outline" onClick={() => remove(a)}>حذف</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {form && <AnnForm ann={form === "new" ? null : form} onClose={() => setForm(null)} />}
    </>
  );
}

function AnnForm({ ann, onClose }: { ann: Announcement | null; onClose: () => void }) {
  const { toast } = useUi();
  const [title, setTitle] = useState(ann?.title ?? "");
  const [body, setBody] = useState(ann?.body ?? "");
  const [active, setActive] = useState(ann?.active ?? true);
  const [pinned, setPinned] = useState(ann?.pinned ?? false);
  const [image, setImage] = useState(ann?.image ?? "");
  const [link, setLink] = useState(ann?.link ?? "");
  const linkOk = !link.trim() || /^https?:\/\/.+/i.test(link.trim());
  const [expires, setExpires] = useState(toLocalInput(ann?.expiresAt));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const expiresAt = expires ? Timestamp.fromDate(new Date(expires)) : null;
      if (ann) await updateDoc(doc(db, "announcements", ann.id), { title: title.trim(), body: body.trim(), image, link: link.trim(), active, pinned, expiresAt });
      else await addDoc(collection(db, "announcements"), { title: title.trim(), body: body.trim(), image, link: link.trim(), active, pinned, expiresAt, createdAt: serverTimestamp() });
      toast(ann ? "تم الحفظ" : "تم النشر");
      onClose();
    } catch (e) { toast(errMsg(e), "err"); setBusy(false); }
  };

  return (
    <Modal title={ann ? "تعديل إعلان" : "إعلان جديد"} onClose={onClose}>
      <fieldset className="form one" disabled={busy}>
        <ImagePicker wide size={800} maxChars={250000} label="صورة الإعلان" value={image} onChange={setImage} />
        <small className="muted">الأفضل صورة أفقية بنسبة 16:9 (مثل 1280×720) حتى تظهر كاملة في التطبيق.</small>
        <label>العنوان *<input autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>النص<textarea rows={4} value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} /></label>
        <label>رابط (اختياري، يظهر زر «فتح الرابط» في الإعلان)<input dir="ltr" placeholder="https://" value={link} maxLength={300} onChange={(e) => setLink(e.target.value)} /></label>
        {!linkOk && <small className="notice bad">الرابط يجب أن يبدأ بـ https://</small>}
        <label>تاريخ الانتهاء (اختياري، يختفي الإعلان من التطبيق بعده)<input type="datetime-local" dir="ltr" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
        <label className="check-row"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> فعّال (يظهر في التطبيق)</label>
        <label className="check-row"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> تثبيت في أعلى القائمة</label>
      </fieldset>
      <div className="actions">
        <button className="btn" disabled={busy || !title.trim() || !linkOk} onClick={save}>{busy ? "جارٍ الحفظ…" : ann ? "حفظ" : "نشر"}</button>
        <button className="btn ghost" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
