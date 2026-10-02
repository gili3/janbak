import type { Section } from "./types";

// لا توجد أقسام ثابتة: كل الأقسام تُنشأ وتُدار من صفحة «الأقسام» (مجموعة sections في Firestore).
export const byOrder = (a: Section, b: Section) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title, "ar");
