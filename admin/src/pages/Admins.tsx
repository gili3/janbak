import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db, errMsg, removeAdmin, setAdmin } from "../lib/firebase";
import { Empty, PageHead, useUi } from "../components/ui";
import { ago } from "../lib/format";
import { AdminDoc, ROLE_LABELS, Role } from "../lib/types";

const ROLES: Role[] = ["owner", "editor", "moderator"];
const HINT: Record<Role, string> = {
  owner: "كل شيء + إدارة المدراء",
  editor: "الأنشطة والأقسام والإعلانات + الطلبات",
  moderator: "مراجعة الطلبات فقط",
};

export default function Admins() {
  const { toast, confirm } = useUi();
  const [rows, setRows] = useState<AdminDoc[]>([]);
  const [err, setErr] = useState("");
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("moderator");
  const [busy, setBusy] = useState(false);
  const me = auth.currentUser?.uid;

  useEffect(() => onSnapshot(collection(db, "admins"),
    (s) => setRows(s.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as unknown as AdminDoc)),
    (e) => setErr(e.code)), []);

  const add = async () => {
    setBusy(true);
    try { await setAdmin(uid, role, email); toast("تم حفظ المدير"); setUid(""); setEmail(""); } catch (e) { toast(errMsg(e), "err"); }
    setBusy(false);
  };
  const change = async (a: AdminDoc, r: Role) => {
    try { await setAdmin(a.id, r); toast("تم تغيير الدور"); } catch (e) { toast(errMsg(e), "err"); }
  };
  const remove = async (a: AdminDoc) => {
    if (!(await confirm({ title: `إزالة ${a.email ?? a.id}؟`, body: "سيفقد صلاحية الدخول للوحة فوراً.", confirmLabel: "إزالة", danger: true }))) return;
    try { await removeAdmin(a.id, a.email ?? ""); toast("تمت الإزالة"); } catch (e) { toast(errMsg(e), "err"); }
  };

  return (
    <>
      <PageHead title="المدراء" sub="للمالك فقط. أنشئ حساب البريد من Authentication في Firebase، وانسخ معرّفه User UID والصقه هنا" />
      <div className="toolbar">
        <input className="search" dir="ltr" placeholder="User UID (من Authentication)" value={uid} onChange={(e) => setUid(e.target.value)} />
        <input className="search" type="email" dir="ltr" placeholder="البريد (للعرض فقط، اختياري)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="الدور">
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <button className="btn" disabled={busy || uid.trim().length < 20} onClick={add}>إضافة / تحديث</button>
      </div>
      <p className="muted small">{HINT[role]}</p>
      {err && <p className="notice bad">تعذرت قراءة المدراء ({err})</p>}
      {rows.length === 0 ? <Empty title="لا يوجد مدراء" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>المدير</th><th>الدور</th><th>آخر تعديل</th><th></th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><b dir="ltr">{a.email ?? "—"}</b>{a.id === me && <small className="sub">أنت</small>}{!a.email && <small className="sub">مضاف يدوياً</small>}</td>
                  <td>
                    <select value={a.role ?? "owner"} disabled={a.id === me} onChange={(e) => change(a, e.target.value as Role)} aria-label="الدور">
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td className="nowrap muted">{ago(a.updatedAt)}</td>
                  <td className="row-actions">{a.id !== me && <button className="btn small danger-outline" onClick={() => remove(a)}>إزالة</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
