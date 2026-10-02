import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useData, useSections } from "../components/data";
import { Empty, Modal, PageHead, StatusBadge, useUi } from "../components/ui";
import SecIcon from "../components/SecIcon";
import { errMsg, reviewRequest } from "../lib/firebase";
import { ago, fmt } from "../lib/format";
import { latinDigits, validPhone } from "../lib/phone";
import type { Place, PlaceFields, RequestDoc } from "../lib/types";

type Tab = "pending" | "approved" | "rejected" | "all";
const TABS: [Tab, string][] = [["pending", "قيد المراجعة"], ["approved", "مقبولة"], ["rejected", "مرفوضة"], ["all", "الكل"]];
const REASONS = ["بيانات ناقصة", "رقم الهاتف غير صحيح", "النشاط مكرر", "محتوى غير مناسب", "خارج نطاق الدليل"];
const FIELD_LABELS: Record<keyof PlaceFields, string> = {
  name: "الاسم", section: "القسم", services: "الخدمات",
  address: "الموقع", hours: "ساعات العمل", phone: "الهاتف", whatsapp: "واتساب",
};
const FIELD_KEYS = Object.keys(FIELD_LABELS) as (keyof PlaceFields)[];

export default function Requests() {
  const { requests, places, pending } = useData();
  const secs = useSections();
  const { toast, confirm } = useUi();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("pending");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const openId = params.get("open");
  const open = requests.rows.find((r) => r.id === openId) ?? null;
  const setOpen = (id: string | null) => setParams(id ? { open: id } : {}, { replace: true });

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return requests.rows
      .filter((r) => tab === "all" || r.status === tab)
      .filter((r) => !t || [r.name, r.phone, r.ownerPhone, r.ownerEmail, r.ownerName, r.services].some((x) => (x ?? "").toLowerCase().includes(t)))
      .sort((a, b) => {
        const d = (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0);
        return tab === "pending" ? d : -d;
      });
  }, [requests.rows, tab, q]);

  useEffect(() => { setSel(new Set()); }, [tab]);
  const selectable = list.filter((r) => r.status === "pending");
  const allSel = selectable.length > 0 && selectable.every((r) => sel.has(r.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulkApprove = async () => {
    const ids = [...sel];
    if (!(await confirm({ title: `قبول ${ids.length} طلب؟`, body: "ستُنشر الأنشطة فوراً وتصل النتيجة لأصحابها داخل التطبيق.", confirmLabel: "قبول الكل" }))) return;
    setBusy(true);
    let failed = 0;
    for (const id of ids) {
      try { await reviewRequest({ id, decision: "approve" }); } catch { failed++; }
    }
    setBusy(false);
    setSel(new Set());
    toast(failed ? `تم قبول ${ids.length - failed} وفشل ${failed}` : `تم قبول ${ids.length} طلب`, failed ? "err" : "ok");
  };

  return (
    <>
      <PageHead title="طلبات الإضافة والتعديل" sub="راجع الطلب، عدّل ما يلزم، ثم اقبله أو ارفضه مع ذكر السبب" />
      <div className="toolbar">
        <div className="tabs" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "tab on" : "tab"} onClick={() => setTab(k)}>
              {l}{k === "pending" && pending > 0 ? <span className="count">{pending}</span> : null}
            </button>
          ))}
        </div>
        <input className="search" placeholder="بحث بالاسم أو الهاتف…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {sel.size > 0 && (
        <div className="bulk">
          <span>{sel.size} محدد</span>
          <button className="btn" disabled={busy} onClick={bulkApprove}>{busy ? "جارٍ القبول…" : "قبول المحدد"}</button>
          <button className="btn ghost" onClick={() => setSel(new Set())}>إلغاء التحديد</button>
        </div>
      )}

      {requests.error && <p className="notice bad">تعذرت قراءة الطلبات ({requests.error})</p>}
      {requests.ready && list.length === 0 ? (
        <Empty title={tab === "pending" ? "لا توجد طلبات معلّقة" : "لا توجد طلبات"} body={q ? "جرّب كلمة بحث أخرى" : undefined} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="check">
                  {selectable.length > 0 && (
                    <input type="checkbox" aria-label="تحديد الكل" checked={allSel}
                      onChange={() => setSel(allSel ? new Set() : new Set(selectable.map((r) => r.id)))} />
                  )}
                </th>
                <th>النشاط</th><th>النوع</th><th>المرسل</th><th>الحالة</th><th>الوصول</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="click" onClick={() => setOpen(r.id)}>
                  <td className="check" onClick={(e) => e.stopPropagation()}>
                    {r.status === "pending" && <input type="checkbox" aria-label={`تحديد ${r.name}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} />}
                  </td>
                  <td><b className="line-flex"><SecIcon s={secs.find(r.section)} size={22} />{r.name}</b><small className="sub">{secs.title(r.section)}</small></td>
                  <td>{r.kind === "edit" ? "تعديل" : "إضافة"}</td>
                  <td dir="ltr" className="nowrap">{r.ownerEmail || r.ownerPhone || "—"}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="nowrap muted">{ago(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <ReviewModal req={open} current={open.placeId ? places.rows.find((p) => p.id === open.placeId) : undefined} onClose={() => setOpen(null)} />}
    </>
  );
}

function ReviewModal({ req, current, onClose }: { req: RequestDoc; current?: Place; onClose: () => void }) {
  const { toast } = useUi();
  const secs = useSections();
  const show = (k: keyof PlaceFields, v: string) => (k === "section" ? secs.title(v) : v || "—");
  const [f, setF] = useState<PlaceFields>({
    name: req.name, section: req.section, services: req.services,
    address: req.address, hours: req.hours, phone: req.phone, whatsapp: req.whatsapp,
  });
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const isPending = req.status === "pending";
  const set = (k: keyof PlaceFields, v: string) => setF((x) => ({ ...x, [k]: v }));

  const changed = req.kind === "edit" && current ? FIELD_KEYS.filter((k) => (current[k] ?? "") !== (req[k] ?? "")) : [];
  const problem = !f.name.trim() ? "اسم النشاط مطلوب" : !validPhone(f.phone) ? "رقم الهاتف غير صالح" : f.whatsapp && !validPhone(f.whatsapp) ? "رقم الواتساب غير صالح" : "";

  const run = async (decision: "approve" | "reject") => {
    setBusy(true);
    try {
      await reviewRequest({ id: req.id, decision, reason: reason.trim(), edits: decision === "approve" ? { ...f } : undefined });
      toast(decision === "approve" ? "تم القبول وستظهر النتيجة في إشعارات صاحب الطلب داخل التطبيق" : "تم الرفض وستظهر النتيجة في إشعارات صاحب الطلب داخل التطبيق");
      onClose();
    } catch (e) {
      toast(errMsg(e), "err");
      setBusy(false);
    }
  };

  return (
    <Modal title={req.kind === "edit" ? "طلب تعديل" : "طلب إضافة نشاط"} onClose={onClose} wide>
      <div className="meta">
        <StatusBadge status={req.status} />
        <span>المرسل: {req.ownerName ? <b>{req.ownerName} </b> : null}<bdi dir="ltr">{req.ownerEmail || req.ownerPhone || "—"}</bdi></span>
        <span>{fmt(req.createdAt)}</span>
        {req.ownerEmail && <a href={`mailto:${req.ownerEmail}`}>مراسلة المرسل</a>}
        {!req.ownerEmail && req.ownerPhone && <a href={`https://wa.me/${req.ownerPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">مراسلة المرسل</a>}
      </div>

      {req.kind === "edit" && (
        <div className="diff">
          <h4>التغييرات المقترحة</h4>
          {!current ? <p className="muted">النشاط الأصلي لم يعد موجوداً.</p> : changed.length === 0 ? <p className="muted">لا تغييرات عن النسخة المنشورة.</p> : (
            <ul className="plain">
              {changed.map((k) => (
                <li key={k}><b>{FIELD_LABELS[k]}</b><del>{show(k, current[k] ?? "")}</del><ins>{show(k, req[k] ?? "")}</ins></li>
              ))}
            </ul>
          )}
        </div>
      )}

      {req.status === "rejected" && req.rejectReason && <p className="notice bad">سبب الرفض: {req.rejectReason}</p>}

      <fieldset disabled={!isPending || busy} className="form">
        <label>الاسم<input value={f.name} maxLength={100} onChange={(e) => set("name", e.target.value)} /></label>
        <label>القسم
          <select value={f.section} onChange={(e) => set("section", e.target.value)}>
            {secs.list.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
        <label>الهاتف<input dir="ltr" inputMode="numeric" value={f.phone} onChange={(e) => set("phone", latinDigits(e.target.value))} /></label>
        <label>واتساب<input dir="ltr" inputMode="numeric" value={f.whatsapp} onChange={(e) => set("whatsapp", latinDigits(e.target.value))} /></label>
        <label>الموقع<input value={f.address} maxLength={200} onChange={(e) => set("address", e.target.value)} /></label>
        <label>ساعات العمل<input value={f.hours} maxLength={100} onChange={(e) => set("hours", e.target.value)} /></label>
        <label className="full">الخدمات<textarea rows={3} value={f.services} maxLength={500} onChange={(e) => set("services", e.target.value)} /></label>
      </fieldset>

      {isPending && !rejecting && (
        <div className="actions">
          <button className="btn" disabled={busy || !!problem} title={problem} onClick={() => run("approve")}>{busy ? "جارٍ التنفيذ…" : req.kind === "edit" ? "قبول التعديل" : "قبول ونشر"}</button>
          <button className="btn danger-outline" disabled={busy} onClick={() => setRejecting(true)}>رفض…</button>
          {problem && <span className="muted small">{problem}</span>}
        </div>
      )}

      {isPending && rejecting && (
        <div className="reject">
          <h4>سبب الرفض (يصل لصاحب الطلب)</h4>
          <div className="chips">
            {REASONS.map((r) => <button key={r} type="button" className={reason === r ? "chip on" : "chip"} onClick={() => setReason(r)}>{r}</button>)}
          </div>
          <textarea rows={2} placeholder="أو اكتب سبباً آخر…" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="actions">
            <button className="btn danger" disabled={busy || !reason.trim()} onClick={() => run("reject")}>{busy ? "جارٍ التنفيذ…" : "تأكيد الرفض"}</button>
            <button className="btn ghost" disabled={busy} onClick={() => setRejecting(false)}>رجوع</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
