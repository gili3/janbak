const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanPlace, normName, roleOf, canEditContent, latin, dayKey, ValidationError } = require("../lib");

const base = { name: "  بقالة   النور ", section: "shops", phone: "٠٩١٢٣٤٥٦٧٨", whatsapp: "", category: "بقالة" };

test("cleanPlace ينظّف المسافات ويحوّل الأرقام العربية", () => {
  const r = cleanPlace(base);
  assert.equal(r.name, "بقالة النور");
  assert.equal(r.phone, "0912345678");
  assert.equal(r.whatsapp, "");
});

test("cleanPlace يرفض الاسم الفارغ والقسم الخاطئ والهاتف غير الصالح", () => {
  assert.throws(() => cleanPlace({ ...base, name: "   " }), ValidationError);
  assert.throws(() => cleanPlace({ ...base, section: "x" }), /القسم/);
  assert.throws(() => cleanPlace({ ...base, phone: "912345678" }), /الهاتف/);
  assert.throws(() => cleanPlace({ ...base, phone: "09123456789" }), /الهاتف/);
  assert.throws(() => cleanPlace({ ...base, whatsapp: "12" }), /الواتساب/);
});

test("cleanPlace يقصّ الحقول الطويلة ويقبل null", () => {
  const r = cleanPlace({ ...base, name: "ا".repeat(300), services: "س".repeat(900) });
  assert.equal(r.name.length, 100);
  assert.equal(r.services.length, 500);
  assert.throws(() => cleanPlace(null), ValidationError);
});

test("normName يكشف التكرار رغم الهمزات والتشكيل والمسافات", () => {
  assert.equal(normName("صيدلية الأمل"), normName("صيدليه  الامل"));
  assert.equal(normName("مَخبز النُّور"), normName("مخبز النور"));
  assert.notEqual(normName("مخبز النور"), normName("مخبز الأمل"));
});

test("الأدوار: القديم بلا role يعامل كمالك، والمشرف لا يعدّل المحتوى", () => {
  assert.equal(roleOf({}), "owner");
  assert.equal(roleOf({ role: "moderator" }), "moderator");
  assert.equal(roleOf({ role: "hacker" }), "owner");
  assert.equal(canEditContent("editor"), true);
  assert.equal(canEditContent("moderator"), false);
});

test("latin و dayKey", () => {
  assert.equal(latin("۰۹۱-٢٣"), "09123");
  assert.equal(dayKey(new Date("2026-10-02T23:59:00Z")), "2026-10-02");
});
