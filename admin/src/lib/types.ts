import type { Timestamp } from "firebase/firestore";

export type Place = {
  id: string;
  name: string;
  section: string;
  services: string;
  address: string;
  hours: string;
  phone: string;
  whatsapp: string;
  status: "approved" | "hidden";
  ownerUid?: string;
  requestId?: string;
  featured?: boolean;
  image?: string; // صورة مصغّرة (data URL) تظهر في التطبيق
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type RequestDoc = {
  id: string;
  kind: "new" | "edit";
  placeId?: string | null;
  name: string;
  section: string;
  services: string;
  address: string;
  hours: string;
  phone: string;
  whatsapp: string;
  status: "pending" | "approved" | "rejected";
  rejectReason?: string;
  ownerUid: string;
  ownerPhone?: string; // طلبات قديمة (تسجيل بالهاتف)
  ownerEmail?: string;
  ownerName?: string;
  createdAt?: Timestamp;
  reviewedAt?: Timestamp;
};

/** قسم رئيسي في التطبيق؛ معرّف المستند هو مفتاح القسم المخزَّن في الأنشطة */
export type Section = {
  id: string;
  title: string;
  emoji?: string; // قديم: لم يعد يُستخدم، تُعرض الصورة المرفوعة بدلاً منه
  color: string; // #RRGGBB (لون خلفية الشارة عند غياب الصورة)
  examples?: string;
  image?: string;
  order?: number;
  active: boolean;
};

/** نصوص الواجهة القابلة للتعديل (settings/app) */
export type AppSettings = { tagline: string; searchHint: string };
export const DEFAULT_SETTINGS: AppSettings = {
  tagline: "كل ما تحتاجه في قريتك، جنبك.",
  searchHint: "ابحث عن محل أو مهنة أو خدمة",
};

export type Announcement = {
  id: string;
  title: string;
  body?: string;
  active: boolean;
  image?: string; // صورة الإعلان (data URL)
  link?: string; // رابط اختياري (https)
  pinned?: boolean;
  notify?: boolean;
  createdAt?: Timestamp;
  lastPushAt?: Timestamp;
  expiresAt?: Timestamp | null;
};

export type AuditEntry = {
  id: string;
  action: string;
  actorUid: string;
  targetId?: string;
  name?: string;
  reason?: string;
  createdAt?: Timestamp;
};

export type PlaceFields = Pick<Place, "name" | "section" | "services" | "address" | "hours" | "phone" | "whatsapp">;
export const EMPTY_FIELDS: PlaceFields = { name: "", section: "", services: "", address: "", hours: "", phone: "", whatsapp: "" };

export type Role = "owner" | "editor" | "moderator";
export const ROLE_LABELS: Record<Role, string> = { owner: "مالك", editor: "محرر", moderator: "مشرف طلبات" };
export type AdminDoc = { id: string; role?: Role; email?: string; updatedAt?: Timestamp };
export type StatDoc = { id: string; calls?: number; whatsapp?: number };
