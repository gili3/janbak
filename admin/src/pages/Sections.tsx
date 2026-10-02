import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useData, useSections } from "../components/data";
import ImagePicker from "../components/ImagePicker";
import { Empty, PageHead, useUi } from "../components/ui";
import { db, errMsg } from "../lib/firebase";
import type { Section } from "../lib/types";

const clean = (s: Omit<Section, "id">) => ({
  title: s.title, color: s.color, examples: s.examples ?? "", image: s.image ?? "", order: s.order ?? 0, active: s.active,
  ...(s.emoji ? { emoji: s.emoji } : {}), // يبقى القديم كما هو إن وُجد، ولا يُكتب في الجديد
});

const NEW = { title: "", color: "#2563EB", examples: "", image: "" };

export default function Sections() {
  const { places } = useData();
  const secs = useSections();
  const { toast, confirm } = useUi();
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(NEW);

  const count = (id: string) => places.rows.filter((p) => p.section === id).length;

  const add = async () => {
    const title = n.title.trim();
    if (!title) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "sections"), clean({ title, color: n.color, examples: n.examples.trim(), image: n.image, order: secs.list.length + 1, active: true }));
      setN(NEW);
      toast("تمت إضافة القسم وظهر في التطبيق");
    } catch (e) { toast(errMsg(e), "err"); }
    setBusy(false);
  };

  const save = async (s: Section, patch: Partial<Section>, ok = "تم الحفظ") => {
    try { await updateDoc(doc(db, "sections", s.id), clean({ ...s, ...patch })); toast(ok); }
    catch (e) { toast(errMsg(e), "err"); }
  };

  const remove = async (s: Section) => {
    const used = count(s.id);
    const body = used
      ? `${used} نشاط مرتبط بهذا القسم سيبقى في قاعدة البيانات لكنه لن يظهر في التطبيق. الأفضل «إخفاء» القسم بدل حذفه.`
      : undefined;
    if (!(await confirm({ title: `حذف القسم «${s.title}»؟`, body, confirmLabel: "حذف", danger: true }))) return;
    try { await deleteDoc(doc(db, "sections", s.id)); toast("تم الحذف"); } catch (e) { toast(errMsg(e), "err"); }
  };

  return (
    <>
      <PageHead title="الأقسام" sub="الأقسام الرئيسية في الشاشة الرئيسية للتطبيق: الاسم والصورة واللون والترتيب والإخفاء. لا توجد أقسام جاهزة، أنشئ ما تحتاجه." />

      <div className="sec-card">
        <b>قسم جديد</b>
        <div className="row">
          <ImagePicker size={256} label="صورة القسم" value={n.image} onChange={(v) => setN({ ...n, image: v })} />
          <label className="grow">الاسم *<input value={n.title} maxLength={40} placeholder="مثال: المحلات" onChange={(e) => setN({ ...n, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} /></label>
          <label className="grow">أمثلة (اختياري)<input value={n.examples} maxLength={120} placeholder="بقالة، صيدلية، مخبز" onChange={(e) => setN({ ...n, examples: e.target.value })} /></label>
          <label>اللون<input type="color" value={n.color} onChange={(e) => setN({ ...n, color: e.target.value })} /></label>
          <button className="btn" disabled={busy || !n.title.trim()} onClick={add}>إضافة</button>
        </div>
      </div>

      {secs.ready && secs.list.length === 0 && <Empty title="لا توجد أقسام بعد" body="أضف أول قسم من الأعلى ليظهر في التطبيق" />}

      {secs.list.map((s) => (
        <div key={s.id} className={`sec-card${s.active ? "" : " off"}`}>
          <div className="row">
            <ImagePicker size={256} label="صورة القسم" value={s.image} onChange={(v) => save(s, { image: v }, v ? "تم حفظ الصورة" : "تم حذف الصورة")} />
            <label className="grow">الاسم<input defaultValue={s.title} maxLength={40} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== s.title && save(s, { title: e.target.value.trim() })} /></label>
            <label>اللون<input type="color" defaultValue={s.color} onBlur={(e) => e.target.value !== s.color && save(s, { color: e.target.value })} /></label>
            <label>الترتيب<input type="number" style={{ width: 70 }} defaultValue={s.order ?? 0} onBlur={(e) => Number(e.target.value) !== (s.order ?? 0) && save(s, { order: Number(e.target.value) })} /></label>
          </div>
          <div className="row">
            <label className="grow">أمثلة تظهر للمستخدم<input defaultValue={s.examples ?? ""} maxLength={120} onBlur={(e) => e.target.value !== (s.examples ?? "") && save(s, { examples: e.target.value })} /></label>
            <span className="muted small">{count(s.id)} نشاط</span>
            <button className="btn small ghost" onClick={() => save(s, { active: !s.active }, s.active ? "تم إخفاء القسم من التطبيق" : "أصبح القسم ظاهراً")}>{s.active ? "إخفاء" : "إظهار"}</button>
            <button className="btn small danger-outline" onClick={() => remove(s)}>حذف</button>
          </div>
        </div>
      ))}
    </>
  );
}
