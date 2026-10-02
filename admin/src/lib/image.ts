/**
 * يصغّر صورة محلية ويحوّلها إلى data URL (JPEG) لتُخزَّن مباشرة في مستند Firestore.
 * هذا يعمل على خطة Spark المجانية بلا Firebase Storage. الحجم الناتج بضعة كيلوبايتات.
 */
export async function fileToDataUrl(file: File, maxSide = 256, quality = 0.8, maxChars = 110000): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("اختر ملف صورة");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("تعذرت قراءة الصورة"));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("المتصفح لا يدعم معالجة الصور");
    ctx.fillStyle = "#fff"; // خلفية بيضاء للصور الشفافة (JPEG لا يدعم الشفافية)
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    // نخفّض الجودة تدريجياً حتى يدخل الحجم في حد قواعد Firestore
    let q = quality;
    let out = canvas.toDataURL("image/jpeg", q);
    while (out.length > maxChars && q > 0.3) { q -= 0.1; out = canvas.toDataURL("image/jpeg", q); }
    if (out.length > maxChars) throw new Error("الصورة كبيرة جداً، اختر صورة أصغر");
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
