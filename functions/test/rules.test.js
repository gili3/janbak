// يحتاج محاكي Firestore:  npx firebase-tools emulators:exec --only firestore "npm run test:rules"
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where } = require("firebase/firestore");

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
    await setDoc(doc(db, "requests/r1"), { name: "x", status: "pending", ownerUid: "u1" });
    await setDoc(doc(db, "requests/r2"), { name: "y", status: "rejected", ownerUid: "u1" });
    await setDoc(doc(db, "inbox/u1/items/i1"), { title: "t", read: false });
  });
});
test.after(async () => env.cleanup());

const as = (uid) => env.authenticatedContext(uid).firestore();
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

test("المستخدم العادي لا يكتب في الأنشطة ولا ينشئ طلبات مباشرة", async () => {
  await assertFails(setDoc(doc(as("u1"), "places/new"), good));
  await assertFails(updateDoc(doc(as("u1"), "places/p1"), { name: "تعديل" }));
  await assertFails(setDoc(doc(as("u1"), "requests/new"), { name: "x", status: "approved", ownerUid: "u1" }));
  await assertFails(updateDoc(doc(as("u1"), "requests/r1"), { status: "approved" }));
});

test("الطلبات: صاحبها يقرأ ويلغي المعلّق فقط، والغريب لا يقرأ", async () => {
  await assertSucceeds(getDoc(doc(as("u1"), "requests/r1")));
  await assertFails(getDoc(doc(as("u2"), "requests/r1")));
  await assertFails(deleteDoc(doc(as("u1"), "requests/r2")));
  await assertSucceeds(deleteDoc(doc(as("u1"), "requests/r1")));
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

test("المدراء: المالك فقط يستعرضهم، ولا أحد يكتب مباشرة", async () => {
  await assertSucceeds(getDocs(collection(as("owner1"), "admins")));
  await assertFails(getDocs(collection(as("editor1"), "admins")));
  await assertSucceeds(getDoc(doc(as("editor1"), "admins/editor1")));
  await assertFails(getDoc(doc(as("u1"), "admins/owner1")));
  await assertFails(setDoc(doc(as("owner1"), "admins/x"), { role: "owner" }));
});

test("الإحصائيات والسجل للمدراء فقط، ولا كتابة من العميل", async () => {
  await assertFails(getDoc(doc(as("u1"), "stats/p1")));
  await assertSucceeds(getDoc(doc(as("mod1"), "stats/p1")));
  await assertFails(setDoc(doc(as("owner1"), "stats/p1"), { calls: 99 }));
  await assertFails(setDoc(doc(as("owner1"), "auditLog/x"), { action: "x" }));
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
