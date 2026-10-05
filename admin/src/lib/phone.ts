const AR = "٠١٢٣٤٥٦٧٨٩";
const FA = "۰۱۲۳۴۵۶۷۸۹";
/** يحوّل الأرقام العربية/الفارسية إلى لاتينية ويحذف أي رمز غير رقمي */
export const latinDigits = (s: string) =>
  s
    .replace(/[٠-٩۰-۹]/g, (c) => String(AR.includes(c) ? AR.indexOf(c) : FA.indexOf(c)))
    .replace(/\D/g, "")
    .slice(0, 10);
/** الرقم الأول 0 ثم 9 أرقام */
export const validPhone = (s: string) => /^0[0-9]{9}$/.test(s);
