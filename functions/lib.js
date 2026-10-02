// منطق نقي بلا اعتماد على Firebase، لسهولة الاختبار
const SECTIONS = ["shops", "crafts", "transport", "public", "numbers"];
const ROLES = ["owner", "editor", "moderator"];

class ValidationError extends Error {}

const AR = "٠١٢٣٤٥٦٧٨٩";
const FA = "۰۱۲۳۴۵۶۷۸۹";
const latin = (s) =>
  String(s ?? "")
    .replace(/[٠-٩]/g, (c) => AR.indexOf(c))
    .replace(/[۰-۹]/g, (c) => FA.indexOf(c))
    .replace(/\D/g, "");
const one = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const multi = (v, max) => String(v ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

/** يتحقق من بيانات النشاط ويعيدها منظّفة، أو يرمي ValidationError برسالة عربية */
function cleanPlace(d) {
  d = d || {};
  const out = {
    name: one(d.name, 100),
    section: String(d.section ?? ""),
    category: one(d.category, 60),
    services: multi(d.services, 500),
    address: one(d.address, 200),
    hours: one(d.hours, 100),
    phone: latin(d.phone),
    whatsapp: latin(d.whatsapp),
  };
  if (!out.name) throw new ValidationError("اسم النشاط مطلوب");
  if (!SECTIONS.includes(out.section)) throw new ValidationError("القسم غير صالح");
  if (!/^0[0-9]{9}$/.test(out.phone)) throw new ValidationError("رقم الهاتف يجب أن يبدأ بـ 0 ويتبعه 9 أرقام");
  if (out.whatsapp && !/^0[0-9]{9}$/.test(out.whatsapp)) throw new ValidationError("رقم الواتساب غير صالح");
  return out;
}

/** تطبيع الاسم لكشف التكرار: بلا تشكيل ولا مسافات، وبتوحيد الهمزات والتاء المربوطة */
function normName(s) {
  return String(s ?? "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** الدور الافتراضي للمستندات القديمة بلا حقل role هو owner */
const roleOf = (doc) => (doc && ROLES.includes(doc.role) ? doc.role : "owner");
const canEditContent = (role) => role === "owner" || role === "editor";

/** يُرجع نص مفتاح اليوم UTC بصيغة yyyy-mm-dd */
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

module.exports = { SECTIONS, ROLES, ValidationError, latin, cleanPlace, normName, roleOf, canEditContent, dayKey };
