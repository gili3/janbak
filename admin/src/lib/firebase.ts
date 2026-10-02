import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { collection, doc, getFirestore, runTransaction, serverTimestamp, writeBatch } from "firebase/firestore";
import { latinDigits, validPhone } from "./phone";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);

// لا توجد دوال سحابية (خطة Spark المجانية): كل العمليات هنا تُنفَّذ مباشرة على Firestore
// وتحميها قواعد firestore.rules (الدور، الحقول، ربط القبول بالنشاط والإشعار).

const one = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const multi = (v: unknown, max: number) =>
  String(v ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

class AdminError extends Error {}

function me(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new AdminError("سجّل الدخول أولاً");
  return uid;
}

/** ينظّف بيانات النشاط ويتحقق منها (كانت في الدالة السحابية) */
function cleanFields(d: Record<string, unknown>) {
  const out = {
    name: one(d.name, 100),
    section: String(d.section ?? ""),
    services: multi(d.services, 500),
    address: one(d.address, 200),
    hours: one(d.hours, 100),
    phone: latinDigits(String(d.phone ?? "")),
    whatsapp: latinDigits(String(d.whatsapp ?? "")),
  };
  if (!out.name) throw new AdminError("اسم النشاط مطلوب");
  if (!out.section) throw new AdminError("القسم غير صالح");
  if (!validPhone(out.phone)) throw new AdminError("رقم الهاتف يجب أن يبدأ بـ 0 ويتبعه 9 أرقام");
  if (out.whatsapp && !validPhone(out.whatsapp)) throw new AdminError("رقم الواتساب غير صالح");
  return out;
}

/** قبول أو رفض طلب: معاملة ذرّية واحدة تحدّث الطلب والنشاط وصندوق إشعارات صاحبه وسجل العمليات */
export async function reviewRequest(p: {
  id: string;
  decision: "approve" | "reject";
  reason?: string;
  edits?: Record<string, string>;
}) {
  const adminUid = me();
  const reason = one(p.reason, 200);
  if (p.decision === "reject" && !reason) throw new AdminError("اكتب سبب الرفض");

  await runTransaction(db, async (tx) => {
    const reqRef = doc(db, "requests", p.id);
    const snap = await tx.get(reqRef);
    if (!snap.exists()) throw new AdminError("الطلب غير موجود");
    const r = snap.data();
    if (r.status !== "pending") throw new AdminError("تمت مراجعة هذا الطلب مسبقاً");

    // القراءات كلها قبل أي كتابة داخل المعاملة: التأكد أن القسم المختار موجود
    if (p.decision === "approve") {
      const sec = String(p.edits?.section ?? r.section ?? "");
      if (!(await tx.get(doc(db, "sections", sec || "_"))).exists()) {
        throw new AdminError("القسم غير موجود، اختر قسماً صالحاً قبل القبول");
      }
    }

    const inboxRef = doc(collection(db, "inbox", r.ownerUid, "items"));
    const auditRef = doc(collection(db, "auditLog"));
    let title: string;
    let body: string;
    let name: string = r.name;

    if (p.decision === "approve") {
      const merged = cleanFields({ ...r, ...(p.edits ?? {}) });
      name = merged.name;
      if (r.kind === "edit") {
        const placeRef = doc(db, "places", r.placeId);
        if (!(await tx.get(placeRef)).exists()) throw new AdminError("النشاط الأصلي لم يعد موجوداً");
        tx.update(placeRef, { ...merged, requestId: p.id, updatedAt: serverTimestamp() });
      } else {
        tx.set(doc(db, "places", p.id), {
          ...merged, status: "approved", ownerUid: r.ownerUid, requestId: p.id, featured: false,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      }
      tx.update(reqRef, { ...merged, status: "approved", reviewedAt: serverTimestamp(), reviewedBy: adminUid });
      title = r.kind === "edit" ? "تم قبول تعديلك ✅" : "تم قبول نشاطك ✅";
      body = r.kind === "edit" ? `تم تحديث "${name}" في جنبك` : `أصبح "${name}" ظاهراً الآن في جنبك`;
    } else {
      tx.update(reqRef, { status: "rejected", rejectReason: reason, reviewedAt: serverTimestamp(), reviewedBy: adminUid });
      title = "تعذّر قبول الطلب";
      body = `"${name}": ${reason}`;
    }

    tx.set(inboxRef, { title, body: body.slice(0, 500), type: "request", requestId: p.id, read: false, createdAt: serverTimestamp() });
    tx.set(auditRef, {
      action: p.decision === "approve" ? "request.approve" : "request.reject",
      actorUid: adminUid, createdAt: serverTimestamp(), targetId: p.id, name, reason,
    });
  });
}

/**
 * إضافة مدير أو تغيير دوره (للمالك فقط). الإضافة بمعرّف المستخدم UID
 * (من Firebase ← Authentication ← عمود User UID) لأن البحث بالبريد يحتاج Admin SDK.
 */
export async function setAdmin(uid: string, role: string, email?: string) {
  const actor = me();
  const id = uid.trim();
  if (!id) throw new AdminError("المعرّف UID مطلوب");
  const data: Record<string, unknown> = { role, addedBy: actor, updatedAt: serverTimestamp() };
  if (email?.trim()) data.email = email.trim().toLowerCase();
  const batch = writeBatch(db);
  batch.set(doc(db, "admins", id), data, { merge: true });
  batch.set(doc(collection(db, "auditLog")), {
    action: "admin.set", actorUid: actor, createdAt: serverTimestamp(), targetId: id, name: email?.trim() || id, reason: role,
  });
  await batch.commit();
}

export async function removeAdmin(uid: string, label = "") {
  const actor = me();
  if (uid === actor) throw new AdminError("لا يمكنك إزالة نفسك");
  const batch = writeBatch(db);
  batch.delete(doc(db, "admins", uid));
  batch.set(doc(collection(db, "auditLog")), {
    action: "admin.remove", actorUid: actor, createdAt: serverTimestamp(), targetId: uid, name: label || uid,
  });
  await batch.commit();
}

/** رسالة عربية مفهومة من أي خطأ فايربيس */
export function errMsg(e: unknown): string {
  if (e instanceof AdminError) return e.message;
  const x = e as { code?: string; message?: string };
  if (x?.code === "permission-denied") return "ليست لديك صلاحية لهذه العملية";
  if (x?.code === "unavailable") return "تعذر الاتصال بالخادم";
  return x?.message?.replace(/^.*?: /, "") || "تعذر تنفيذ العملية";
}
