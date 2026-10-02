// يحتاج محاكي Firestore:  npx firebase-tools emulators:exec --only firestore "npm run test:rules"
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, serverTimestamp, increment, writeBatch } = require("firebase/firestore");

let env;
const good = { name: "بقالة", section: "shops", phone: "0912345678", status: "approved" };

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: "jenbak-rules-test",
    firestore: { rules: fs.readFileSync(path.join(__dirname, "../../firestore.rules"), "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "admins/owner1"), { role: "owner" });
    await setDoc(doc(db, "sections/shops"), { title: "المحلات", color: "#D97706", active: true, order: 1 });
    await setDoc(doc(db, "admins/legacy"), { note: "قديم بلا role" });
    await setDoc(doc(db, "admins/editor1"), { role: "editor" });
    await setDoc(doc(db, "admins/mod1"), { role: "moderator" });
    await setDoc(doc(db, "places/p1"), { ...good, ownerUid: "u1" });
    await setDoc(doc(db, "places/hidden1"), { ...good, status: "hidden", ownerUid: "u1" });
    await setDoc(doc(db, "requests/r1"), { name: "x", section: "shops", phone: "0912345678", kind: "new", status: "pending", ownerUid: "u1" });
    await setDoc(doc(db, "requests/r2"), { name: "y", status: "rejected", ownerUid: "u1" });
    await setDoc(doc(db, "inbox/u1/items/i1"), { title: "t", read: false });
    await setDoc(doc(db, "inbox/u1/items/i2"), { title: "t", read: false });
  });
});
test.after(async () => env.cleanup());

// حساب جوجل حقيقي (يحمل بريداً) وضيف مجهول
const as = (uid) => env.authenticatedContext(uid, { email: `${uid}@test.com`, firebase: { sign_in_provider: "google.com" } }).firestore();
const guest = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

test("الزائر يقرأ المنشور فقط ولا يقرأ المخفي", async () => {
  await assertSucceeds(getDoc(doc(anon(), "places/p1")));
  await assertFails(getDoc(doc(anon(), "places/hidden1")));
  await assertSucceeds(getDocs(query(collection(anon(), "places"), where("status", "==", "approved"))));
  await assertFails(getDocs(collection(anon(), "places")));
});

test("المالك يقرأ نشاطه المخفي عبر استعلام ownerUid", async () => {
  await assertSucceeds(getDocs(query(collection(as("u1"), "places"), where("ownerUid", "==", "u1"))));
  await assertFails(getDoc(doc(as("u2"), "places/hidden1")));
});

test("المستخدم العادي لا يكتب في الأنشطة ولا يعدّل الطلبات", async () => {
  await assertFails(setDoc(doc(as("u1"), "places/new"), good));
  await assertFails(updateDoc(doc(as("u1"), "places/p1"), { name: "تعديل" }));
  await assertFails(updateDoc(doc(as("u1"), "requests/r1"), { status: "approved" }));
});

const newReq = (uid, extra = {}) => ({
  name: "بقالة الأمل", section: "shops", phone: "0912345678", kind: "new", status: "pending",
  ownerUid: uid, ownerEmail: `${uid}@test.com`, ownerName: "مستخدم", createdAt: serverTimestamp(), ...extra,
});

test("إنشاء طلب مباشرة: صحيح فقط بحالة pending وبمالكه وبريد حسابه", async () => {
  await assertSucceeds(setDoc(doc(as("u1"), "requests/n1"), newReq("u1")));
  await assertFails(setDoc(doc(as("u1"), "requests/n2"), newReq("u1", { status: "approved" })));
  await assertFails(setDoc(doc(as("u1"), "requests/n3"), newReq("u2")));
  await assertFails(setDoc(doc(as("u1"), "requests/n4"), newReq("u1", { phone: "123" })));
  await assertFails(setDoc(doc(as("u1"), "requests/n5"), newReq("u1", { ownerEmail: "evil@x.com" })));
  await assertFails(setDoc(doc(as("u1"), "requests/n6"), newReq("u1", { hacked: true })));
  await assertFails(setDoc(doc(anon(), "requests/n7"), newReq("u1")));
});

test("الضيف المجهول لا يرسل طلبات", async () => {
  await assertFails(setDoc(doc(guest("g1"), "requests/g1"), newReq("g1", { ownerEmail: "" })));
});

test("الأقسام: القراءة للجميع والكتابة للمالك/المحرر بحقول صحيحة فقط", async () => {
  const sec = { title: "صيدليات", emoji: "💊", color: "#0EA5E9", examples: "صيدلية", order: 6, active: true };
  await assertSucceeds(getDoc(doc(anon(), "sections/s1")));
  await assertSucceeds(setDoc(doc(as("editor1"), "sections/pharm"), sec));
  await assertFails(setDoc(doc(as("mod1"), "sections/pharm2"), sec));
  await assertFails(setDoc(doc(as("u1"), "sections/pharm3"), sec));
  await assertFails(setDoc(doc(as("editor1"), "sections/bad1"), { ...sec, color: "red" }));
  await assertFails(setDoc(doc(as("editor1"), "sections/bad2"), { ...sec, hacked: 1 }));
  await assertFails(setDoc(doc(as("editor1"), "sections/bad3"), { ...sec, title: "" }));
});

test("قسم جديد من اللوحة يُقبل في الأنشطة، وصور الأنشطة", async () => {
  const sec = { title: "مطاعم", emoji: "🍽️", color: "#F59E0B", active: true };
  await assertSucceeds(setDoc(doc(as("editor1"), "sections/food"), sec));
  await assertSucceeds(setDoc(doc(as("editor1"), "places/f1"), { ...good, section: "food", image: "data:image/jpeg;base64,AAAA" }));
  await assertFails(setDoc(doc(as("editor1"), "places/f2"), { ...good, image: 5 }));
  await assertSucceeds(setDoc(doc(as("editor1"), "settings/app"), { tagline: "مرحباً" }));
  await assertFails(setDoc(doc(as("editor1"), "settings/other"), { tagline: "x" }));
  await assertFails(setDoc(doc(as("u1"), "settings/app"), { tagline: "x" }));
});

test("طلب تعديل: لصاحب النشاط فقط", async () => {
  await assertSucceeds(setDoc(doc(as("u1"), "requests/e1"), newReq("u1", { kind: "edit", placeId: "p1" })));
  await assertFails(setDoc(doc(as("u2"), "requests/e2"), newReq("u2", { kind: "edit", placeId: "p1" })));
});

test("مراجعة الطلب: المشرف يقبل ويكتب النشاط والإشعار والسجل في عملية واحدة", async () => {
  const db = as("mod1");
  const b = writeBatch(db);
  b.update(doc(db, "requests/r1"), { status: "approved", reviewedAt: serverTimestamp(), reviewedBy: "mod1" });
  b.set(doc(db, "places/r1"), { ...good, ownerUid: "u1", requestId: "r1", featured: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  b.set(doc(db, "inbox/u1/items/new1"), { title: "t", body: "b", type: "request", requestId: "r1", read: false, createdAt: serverTimestamp() });
  b.set(doc(db, "auditLog/a1"), { action: "request.approve", actorUid: "mod1", createdAt: serverTimestamp(), targetId: "r1" });
  await assertSucceeds(b.commit());
});

test("المشرف لا يكتب نشاطاً بلا طلب مقبول في نفس العملية، والمستخدم لا يراجع", async () => {
  await assertFails(setDoc(doc(as("mod1"), "places/x"), { ...good, requestId: "r2" }));
  await assertFails(setDoc(doc(as("u1"), "inbox/u1/items/fake"), { title: "x", body: "y", type: "request", read: false, createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as("u1"), "auditLog/fake"), { action: "x", actorUid: "u1", createdAt: serverTimestamp() }));
});

test("الطلبات: صاحبها يقرأ ويحذف طلبه، والغريب لا يقرأ", async () => {
  await assertSucceeds(getDoc(doc(as("u1"), "requests/r2")));
  await assertFails(getDoc(doc(as("u2"), "requests/r2")));
  await assertFails(deleteDoc(doc(as("u2"), "requests/r2")));
  await assertSucceeds(deleteDoc(doc(as("u1"), "requests/r2")));
});

test("المالك والمحرر يكتبان الأنشطة، والمشرف لا", async () => {
  await assertSucceeds(setDoc(doc(as("owner1"), "places/a"), good));
  await assertSucceeds(setDoc(doc(as("legacy"), "places/b"), good));
  await assertSucceeds(setDoc(doc(as("editor1"), "places/c"), good));
  await assertFails(setDoc(doc(as("mod1"), "places/d"), good));
});

test("المشرف يقرأ الطلبات والسجل لكن لا يعدّل التصنيفات", async () => {
  await assertSucceeds(getDoc(doc(as("mod1"), "requests/r2")));
  await assertSucceeds(getDocs(collection(as("mod1"), "auditLog")));
});

test("التحقق من البيانات: هاتف خاطئ وحقل غريب وحالة غير معروفة", async () => {
  const db = as("owner1");
  await assertFails(setDoc(doc(db, "places/e1"), { ...good, phone: "123" }));
  await assertFails(setDoc(doc(db, "places/e2"), { ...good, hacked: true }));
  await assertFails(setDoc(doc(db, "places/e3"), { ...good, status: "weird" }));
  await assertFails(setDoc(doc(db, "places/e4"), { ...good, section: "x" }));
});

test("المدراء: المالك فقط يستعرضهم ويديرهم، ولا يزيل نفسه", async () => {
  await assertSucceeds(getDocs(collection(as("owner1"), "admins")));
  await assertFails(getDocs(collection(as("editor1"), "admins")));
  await assertSucceeds(getDoc(doc(as("editor1"), "admins/editor1")));
  await assertFails(getDoc(doc(as("u1"), "admins/owner1")));
  await assertSucceeds(setDoc(doc(as("owner1"), "admins/newmod"), { role: "moderator", email: "a@b.c", addedBy: "owner1", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as("owner1"), "admins/bad"), { role: "god" }));
  await assertFails(setDoc(doc(as("editor1"), "admins/x"), { role: "owner" }));
  await assertFails(setDoc(doc(as("owner1"), "admins/owner1"), { role: "editor" }));
  await assertFails(deleteDoc(doc(as("owner1"), "admins/owner1")));
  await assertSucceeds(deleteDoc(doc(as("owner1"), "admins/newmod")));
});

test("الإحصائيات: الزيادة بمقدار 1 فقط من أي زائر، والقراءة للمدراء", async () => {
  await assertFails(getDoc(doc(as("u1"), "stats/p1")));
  await assertSucceeds(getDoc(doc(as("mod1"), "stats/p1")));
  await assertSucceeds(setDoc(doc(anon(), "stats/p1"), { calls: increment(1), updatedAt: serverTimestamp() }, { merge: true }));
  await assertSucceeds(setDoc(doc(anon(), "stats/p1"), { calls: increment(1), updatedAt: serverTimestamp() }, { merge: true }));
  await assertFails(setDoc(doc(anon(), "stats/p1"), { calls: increment(50) }, { merge: true }));
  await assertFails(setDoc(doc(anon(), "stats/p1"), { calls: increment(-1) }, { merge: true }));
  await assertFails(setDoc(doc(anon(), "stats/nope"), { calls: increment(1) }, { merge: true }));
  await assertSucceeds(setDoc(doc(anon(), "statsDaily/2026-10-02"), { whatsapp: increment(1) }, { merge: true }));
  await assertFails(setDoc(doc(anon(), "statsDaily/anything"), { whatsapp: increment(1) }, { merge: true }));
});

test("حذف الحساب: المستخدم يحذف مستنده وأنشطته وطلباته وصندوقه", async () => {
  await assertSucceeds(deleteDoc(doc(as("u1"), "inbox/u1/items/i2")));
  await assertSucceeds(deleteDoc(doc(as("u1"), "users/u1")));
  await assertSucceeds(deleteDoc(doc(as("u1"), "places/p1")));
  await assertFails(deleteDoc(doc(as("u2"), "places/hidden1")));
});

test("صندوق الإشعارات: صاحبه يعلّم مقروءاً فقط ولا ينشئ", async () => {
  await assertSucceeds(updateDoc(doc(as("u1"), "inbox/u1/items/i1"), { read: true }));
  await assertFails(updateDoc(doc(as("u1"), "inbox/u1/items/i1"), { title: "تلاعب" }));
  await assertFails(setDoc(doc(as("u1"), "inbox/u1/items/i9"), { title: "x", read: false }));
  await assertFails(getDoc(doc(as("u2"), "inbox/u1/items/i1")));
});

test("رمز الجهاز: صاحبه فقط وبحقول محددة", async () => {
  await assertSucceeds(setDoc(doc(as("u1"), "users/u1"), { fcmToken: "abc", platform: "android" }));
  await assertFails(setDoc(doc(as("u1"), "users/u1"), { fcmToken: "abc", role: "admin" }));
  await assertFails(setDoc(doc(as("u2"), "users/u1"), { fcmToken: "abc" }));
});

test("الإعلان: المحرر يضيف تاريخ انتهاء صالحاً فقط", async () => {
  const ed = as("editor1");
  const base = { title: "إعلان", body: "نص", active: true, pinned: false, createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(ed, "announcements/a1"), { ...base, expiresAt: new Date(Date.now() + 86400000) }));
  await assertSucceeds(setDoc(doc(ed, "announcements/a2"), { ...base, expiresAt: null }));
  await assertFails(setDoc(doc(ed, "announcements/a3"), { ...base, expiresAt: "غداً" }));
  await assertFails(setDoc(doc(as("mod1"), "announcements/a4"), base));
});

test("القسم غير الموجود مرفوض (لا مفاتيح ثابتة)، والإعلان يقبل صورة بحجم معقول", async () => {
  await assertFails(setDoc(doc(as("editor1"), "places/ghost"), { ...good, section: "crafts" }));
  const ann = { title: "افتتاح", body: "نص", active: true, pinned: false, image: "data:image/jpeg;base64,AAAA" };
  await assertSucceeds(setDoc(doc(as("editor1"), "announcements/a1"), ann));
  await assertFails(setDoc(doc(as("editor1"), "announcements/a2"), { ...ann, image: 5 }));
  await assertFails(setDoc(doc(as("editor1"), "announcements/a3"), { ...ann, image: "x".repeat(300001) }));
  await assertSucceeds(setDoc(doc(as("editor1"), "sections/noemoji"), { title: "بلا رمز", color: "#112233", active: true, image: "data:image/jpeg;base64,AAAA" }));
});
