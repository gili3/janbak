import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useData, useSections } from "../components/data";
import ImagePicker from "../components/ImagePicker";
import SecIcon from "../components/SecIcon";
import { Empty, PageHead, useUi } from "../components/ui";
import { db, errMsg } from "../lib/firebase";
import type { Category } from "../lib/types";

export default function Categories() {
  const { categories, places } = useData();
  const secs = useSections();
  const { toast, confirm } = useUi();
  const [picked, setSection] = useState("");
  const section = picked || secs.list[0]?.id || "";
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);

  const used = (c: Category) => places.rows.filter((p) => p.section === c.section && p.category === c.name).length;
  const upd = async (c: Category, patch: Partial<Category>, ok = "تم الحفظ") => {
    try { await updateDoc(doc(db, "categories", c.id), patch); toast(ok); }
    catch (e) { toast(errMsg(e), "err"); }
  };

  const add = async () => {
    const n = name.trim();
    if (!n || !section) return;
    if (categories.rows.some((c) => c.section === section && c.name === n)) { toast("هذا التصنيف موجود في القسم", "err"); return; }
    setBusy(true);
    try {
      const order = categories.rows.filter((c) => c.section === section).length + 1;
      await addDoc(collection(db, "categories"), { name: n, section, order, image });
      setName("");
      setImage("");
      toast("تمت إضافة التصنيف");
    } catch (e) { toast(errMsg(e), "err"); }
    setBusy(false);
  };

  const rename = (c: Category, v: string) => { const n = v.trim(); if (n && n !== c.name) upd(c, { name: n }); };
  const reorder = (c: Category, v: string) => { const o = Number(v); if (!Number.isNaN(o) && o !== (c.order ?? 0)) upd(c, { order: o }, "تم تغيير الترتيب"); };
  const move = (c: Category, v: string) => { if (v && v !== c.section) upd(c, { section: v }, "تم نقل التصنيف"); };

  const remove = async (c: Category) => {
    const n = used(c);
    if (!(await confirm({ title: `حذف التصنيف «${c.name}»؟`, body: n ? `${n} نشاط يستخدمه، ولن يتأثروا (يبقى التصنيف ظاهراً لهم).` : undefined, confirmLabel: "حذف", danger: true }))) return;
    try { await deleteDoc(doc(db, "categories", c.id)); toast("تم الحذف"); } catch (e) { toast(errMsg(e), "err"); }
  };

  return (
    <>
      <PageHead title="التصنيفات" sub="التصنيفات الوحيدة التي تظهر في التطبيق داخل كل قسم وعند إضافة نشاط. ارفع صورة لكل تصنيف لتظهر بدل الأحرف" />
      <div className="toolbar">
        <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="القسم">
          {secs.list.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <ImagePicker round size={160} label="صورة" value={image} onChange={setImage} />
        <input className="search" placeholder={`تصنيف جديد${secs.find(section)?.examples ? `، مثال: ${secs.find(section)?.examples?.split("،")[0]}` : ""}`} value={name} maxLength={60}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn" disabled={busy || !name.trim() || !section} onClick={add}>إضافة</button>
      </div>
      {categories.error && <p className="notice bad">تعذرت قراءة التصنيفات ({categories.error})</p>}
      {secs.list.map((s) => {
        const rows = categories.rows.filter((c) => c.section === s.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "ar"));
        return (
          <section key={s.id} className="group">
            <h3><SecIcon s={s} size={24} /> {s.title} <small className="muted">({rows.length})</small></h3>
            {rows.length === 0 ? <p className="muted small">لا تصنيفات في هذا القسم. أضف تصنيفاً من الأعلى ليظهر في التطبيق.</p> : (
              <ul className="plain cats">
                {rows.map((c) => (
                  <li key={c.id} className="cat-line">
                    <ImagePicker round size={160} label="صورة" value={c.image} onChange={(v) => upd(c, { image: v }, v ? "تم حفظ الصورة" : "تم حذف الصورة")} />
                    <input className="grow" defaultValue={c.name} maxLength={60} aria-label="اسم التصنيف" onBlur={(e) => rename(c, e.target.value)} />
                    <select value={c.section} onChange={(e) => move(c, e.target.value)} aria-label="نقل إلى قسم" style={{ width: "auto" }}>
                      {secs.list.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                    </select>
                    <input className="order" type="number" defaultValue={c.order ?? 0} aria-label="الترتيب" title="الترتيب" onBlur={(e) => reorder(c, e.target.value)} />
                    <small className="muted nowrap">{used(c)} نشاط</small>
                    <button className="btn small danger-outline" onClick={() => remove(c)}>حذف</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {categories.ready && categories.rows.length === 0 && <Empty title="لم تُعرَّف تصنيفات بعد" body="أضف أول تصنيف من الأعلى" />}
    </>
  );
}
