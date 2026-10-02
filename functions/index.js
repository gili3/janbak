const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

// يجب أن تطابق منطقة قاعدة Firestore، وتطابق REGION في التطبيق (data/Repo.kt) ولوحة الإدارة (VITE_FIREBASE_REGION)
const REGION = "us-central1";
setGlobalOptions({ region: REGION, maxInstances: 10 });

const db = getFirestore();
const CHANNEL = "jenbak_default";
const { SECTIONS, ROLES, ValidationError, latin, cleanPlace, normName, roleOf, canEditContent: _canEdit, dayKey } = require("./lib");
const MAX_PENDING_PER_USER = 5;
const MAX_REQUESTS_PER_DAY = 10;

const one = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const bad = (msg) => new HttpsError("invalid-argument", msg);

/** يغلّف cleanPlace ليحوّل أخطاء التحقق إلى HttpsError */
function clean(d) {
  try {
    return cleanPlace(d);
  } catch (e) {
    if (e instanceof ValidationError) throw bad(e.message);
    throw e;
  }
}

/** يتحقق أن المستدعي مدير بدور مسموح، ويعيد { uid, role } */
async function requireAdmin(request, allowed = ROLES) {
  if (!request.auth) throw new HttpsError("unauthenticated", "سجّل الدخول أولاً");
  const snap = await db.doc(`admins/${request.auth.uid}`).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "هذه العملية للمدير فقط");
  const role = roleOf(snap.data());
  if (!allowed.includes(role)) throw new HttpsError("permission-denied", "دورك لا يسمح بهذه العملية");
  return { uid: request.auth.uid, role };
}

function audit(action, actorUid, extra = {}) {
  return { action, actorUid, createdAt: FieldValue.serverTimestamp(), ...extra };
}

/** إشعار لجهاز مستخدم واحد عبر رمز الجهاز المخزّن، دون إسقاط العملية عند الفشل */
async function pushToUser(uid, title, body, data = {}) {
  try {
    const ref = db.doc(`users/${uid}`);
    const snap = await ref.get();
    const token = snap.exists ? snap.get("fcmToken") : null;
    if (!token) return;
    try {
      await getMessaging().send({
        token,
        notification: { title, body },
        data,
        android: { priority: "high", notification: { channelId: CHANNEL } },
      });
    } catch (e) {
      if (e.code === "messaging/registration-token-not-registered" || e.code === "messaging/invalid-registration-token") {
        await ref.update({ fcmToken: FieldValue.delete() });
      } else {
        logger.warn("push failed", e.code || e.message);
      }
    }
  } catch (e) {
    logger.warn("pushToUser error", e.message);
  }
}

async function pushAnnouncement(id, d) {
  await getMessaging().send({
    topic: "all",
    notification: { title: d.title || "جنبك", body: d.body || "" },
    data: { type: "announcement", id },
    android: { priority: "high", notification: { channelId: CHANNEL } },
  });
}

// ───────────────────────── طلبات المستخدمين ─────────────────────────
/** إرسال طلب إضافة نشاط جديد أو تعديل نشاط يملكه المستخدم */
exports.submitRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "سجّل الدخول أولاً");
  const uid = request.auth.uid;
  const data = request.data || {};
  const kind = data.kind === "edit" ? "edit" : "new";
  const fields = clean(data);

  const pending = await db.collection("requests").where("ownerUid", "==", uid).where("status", "==", "pending").count().get();
  if (pending.data().count >= MAX_PENDING_PER_USER)
    throw new HttpsError("resource-exhausted", `لديك ${MAX_PENDING_PER_USER} طلبات قيد المراجعة، انتظر نتيجتها أولاً`);

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const recent = await db.collection("requests").where("ownerUid", "==", uid).where("createdAt", ">=", since).count().get();
  if (recent.data().count >= MAX_REQUESTS_PER_DAY)
    throw new HttpsError("resource-exhausted", "وصلت للحد اليومي من الطلبات، حاول غداً");

  let placeId = null;
  if (kind === "edit") {
    placeId = String(data.placeId || "");
    if (!placeId) throw bad("النشاط المراد تعديله غير محدد");
    const place = await db.doc(`places/${placeId}`).get();
    if (!place.exists || place.get("ownerUid") !== uid) throw new HttpsError("permission-denied", "هذا النشاط ليس لك");
    const dup = await db.collection("requests").where("placeId", "==", placeId).where("status", "==", "pending").limit(1).get();
    if (!dup.empty) throw new HttpsError("already-exists", "يوجد طلب تعديل قيد المراجعة لهذا النشاط");
  }

  // منع تكرار نفس النشاط (نفس الهاتف والاسم)
  const sameNumber = await db.collection("places").where("phone", "==", fields.phone).limit(10).get();
  if (sameNumber.docs.some((d) => d.id !== placeId && normName(d.get("name")) === normName(fields.name)))
    throw new HttpsError("already-exists", "هذا النشاط موجود مسبقاً في الدليل");

  const ref = await db.collection("requests").add({
    ...fields,
    kind,
    placeId,
    status: "pending",
    ownerUid: uid,
    ownerPhone: request.auth.token.phone_number || "",
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
});

/** قبول أو رفض طلب: عملية ذرّية واحدة تحدّث الطلب والنشاط وصندوق الإشعارات وسجل العمليات */
exports.reviewRequest = onCall(async (request) => {
  const { uid: adminUid } = await requireAdmin(request);
  const { id, decision, reason, edits } = request.data || {};
  if (!id || !["approve", "reject"].includes(decision)) throw bad("بيانات المراجعة غير صحيحة");
  const cleanReason = one(reason, 200);
  if (decision === "reject" && !cleanReason) throw bad("اكتب سبب الرفض");

  const reqRef = db.doc(`requests/${id}`);
  const result = await db.runTransaction(async (tx) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists) throw new HttpsError("not-found", "الطلب غير موجود");
    const r = reqSnap.data();
    if (r.status !== "pending") throw new HttpsError("failed-precondition", "تمت مراجعة هذا الطلب مسبقاً");

    const inboxRef = db.collection(`inbox/${r.ownerUid}/items`).doc();
    const auditRef = db.collection("auditLog").doc();
    let title, body, name = r.name;

    if (decision === "approve") {
      const merged = clean({ ...r, ...(edits || {}) });
      name = merged.name;
      const placeRef = db.doc(`places/${r.kind === "edit" ? r.placeId : id}`);
      if (r.kind === "edit") {
        const p = await tx.get(placeRef);
        if (!p.exists) throw new HttpsError("failed-precondition", "النشاط الأصلي لم يعد موجوداً");
        tx.update(placeRef, { ...merged, updatedAt: FieldValue.serverTimestamp() });
      } else {
        tx.set(placeRef, {
          ...merged,
          status: "approved",
          ownerUid: r.ownerUid,
          requestId: id,
          featured: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      tx.update(reqRef, { ...merged, status: "approved", reviewedAt: FieldValue.serverTimestamp(), reviewedBy: adminUid });
      title = r.kind === "edit" ? "تم قبول تعديلك ✅" : "تم قبول نشاطك ✅";
      body = r.kind === "edit" ? `تم تحديث "${name}" في جنبك` : `أصبح "${name}" ظاهراً الآن في جنبك`;
    } else {
      tx.update(reqRef, { status: "rejected", rejectReason: cleanReason, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: adminUid });
      title = "تعذّر قبول الطلب";
      body = `"${name}": ${cleanReason}`;
    }

    tx.set(inboxRef, { title, body, type: "request", requestId: id, read: false, createdAt: FieldValue.serverTimestamp() });
    tx.set(auditRef, audit(decision === "approve" ? "request.approve" : "request.reject", adminUid, { targetId: id, name, reason: cleanReason }));
    return { ownerUid: r.ownerUid, title, body };
  });

  await pushToUser(result.ownerUid, result.title, result.body, { type: "request", id });
  return { ok: true };
});

// ───────────────────────── الإعلانات ─────────────────────────
/** إعلان جديد فعّال مع تفعيل «إرسال إشعار» => إشعار لكل المستخدمين */
exports.notifyAnnouncement = onDocumentCreated("announcements/{id}", async (event) => {
  const d = event.data && event.data.data();
  if (!d || d.active === false || d.notify !== true) return;
  await pushAnnouncement(event.params.id, d);
  await event.data.ref.update({ lastPushAt: FieldValue.serverTimestamp() });
});

/** زر «إعادة إرسال» في لوحة الإدارة */
exports.resendAnnouncement = onCall(async (request) => {
  const { uid: adminUid } = await requireAdmin(request, ["owner", "editor"]);
  const id = String((request.data || {}).id || "");
  const ref = db.doc(`announcements/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "الإعلان غير موجود");
  const d = snap.data();
  if (d.active === false) throw new HttpsError("failed-precondition", "الإعلان غير فعّال");
  await pushAnnouncement(id, d);
  await ref.update({ lastPushAt: FieldValue.serverTimestamp() });
  await db.collection("auditLog").add(audit("announcement.push", adminUid, { targetId: id, name: d.title }));
  return { ok: true };
});

// ───────────────────────── حذف الحساب ─────────────────────────
/** يحذف حساب المستخدم وكل بياناته (متطلب متجر Google Play) */
exports.deleteAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "سجّل الدخول أولاً");
  const uid = request.auth.uid;
  const admin = await db.doc(`admins/${uid}`).get();
  if (admin.exists) throw new HttpsError("failed-precondition", "لا يمكن حذف حساب مدير من التطبيق");

  for (const col of ["requests", "places"]) {
    const snap = await db.collection(col).where("ownerUid", "==", uid).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db.recursiveDelete(db.doc(`inbox/${uid}`));
  await db.doc(`users/${uid}`).delete();
  await getAuth().deleteUser(uid);
  await db.collection("auditLog").add(audit("account.delete", uid));
  return { ok: true };
});

// ───────────────────────── إدارة المدراء (للمالك فقط) ─────────────────────────
/** إضافة مدير بالبريد (يجب أن يكون له حساب في Authentication) أو تغيير دوره */
exports.setAdmin = onCall(async (request) => {
  const { uid: actor } = await requireAdmin(request, ["owner"]);
  const email = one((request.data || {}).email, 200).toLowerCase();
  const role = String((request.data || {}).role || "");
  if (!email) throw bad("البريد مطلوب");
  if (!ROLES.includes(role)) throw bad("الدور غير صالح");

  let target;
  try {
    target = await getAuth().getUserByEmail(email);
  } catch (e) {
    throw new HttpsError("not-found", "لا يوجد حساب بهذا البريد. أنشئه أولاً من Authentication في Firebase");
  }
  const all = await db.collection("admins").get();
  const owners = all.docs.filter((d) => roleOf(d.data()) === "owner");
  const isLastOwner = owners.length === 1 && owners[0].id === target.uid;
  if (isLastOwner && role !== "owner") throw new HttpsError("failed-precondition", "لا يمكن إزالة صلاحية آخر مالك");

  await db.doc(`admins/${target.uid}`).set({ role, email, addedBy: actor, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.collection("auditLog").add(audit("admin.set", actor, { targetId: target.uid, name: email, reason: role }));
  return { ok: true };
});

exports.removeAdmin = onCall(async (request) => {
  const { uid: actor } = await requireAdmin(request, ["owner"]);
  const uid = String((request.data || {}).uid || "");
  if (!uid) throw bad("المدير غير محدد");
  if (uid === actor) throw new HttpsError("failed-precondition", "لا يمكنك إزالة نفسك");
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "المدير غير موجود");
  await snap.ref.delete();
  await db.collection("auditLog").add(audit("admin.remove", actor, { targetId: uid, name: snap.get("email") || "" }));
  return { ok: true };
});

// ───────────────────────── إحصائيات الاتصال ─────────────────────────
/** يُستدعى من التطبيق عند الضغط على اتصال/واتساب (بلا تسجيل دخول) */
exports.trackContact = onCall(async (request) => {
  const d = request.data || {};
  const placeId = String(d.placeId || "").slice(0, 100);
  const field = d.type === "whatsapp" ? "whatsapp" : d.type === "call" ? "calls" : null;
  if (!placeId || !field) return { ok: false };
  const place = await db.doc(`places/${placeId}`).get();
  if (!place.exists || place.get("status") !== "approved") return { ok: false };
  const inc = FieldValue.increment(1);
  const batch = db.batch();
  batch.set(db.doc(`stats/${placeId}`), { [field]: inc, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(db.doc(`statsDaily/${dayKey()}`), { [field]: inc }, { merge: true });
  await batch.commit();
  return { ok: true };
});
