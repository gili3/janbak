import type { Place, RequestDoc } from "./types";

const DAY = 86400000;

/** عدد الأنشطة المضافة في كل أسبوع من آخر n أسبوعاً (الأقدم أولاً) */
export function weeklyNew(places: Place[], n: number, now = Date.now()): number[] {
  const out = new Array(n).fill(0);
  for (const p of places) {
    const t = p.createdAt?.toMillis();
    if (!t) continue;
    const w = Math.floor((now - t) / (7 * DAY));
    if (w >= 0 && w < n) out[n - 1 - w]++;
  }
  return out;
}

/** نسبة القبول من المراجَع فقط، أو null إن لم يُراجَع شيء */
export function approvalRate(reqs: RequestDoc[]): number | null {
  const a = reqs.filter((r) => r.status === "approved").length;
  const r = reqs.filter((r) => r.status === "rejected").length;
  return a + r === 0 ? null : Math.round((a / (a + r)) * 100);
}

/** متوسط ساعات المراجعة، أو null */
export function avgReviewHours(reqs: RequestDoc[]): number | null {
  const ds = reqs
    .filter((r) => r.status !== "pending" && r.createdAt && r.reviewedAt)
    .map((r) => (r.reviewedAt!.toMillis() - r.createdAt!.toMillis()) / 3600000);
  return ds.length ? Math.round((ds.reduce((x, y) => x + y, 0) / ds.length) * 10) / 10 : null;
}

/** أكثر القيم تكراراً: [القيمة، العدد] */
export function topCounts(values: string[], k: number): [string, number][] {
  const m = new Map<string, number>();
  for (const v of values.map((x) => x.trim()).filter(Boolean)) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar")).slice(0, k);
}

/** مفاتيح آخر n يوماً بصيغة yyyy-mm-dd (UTC) والأقدم أولاً */
export function lastDays(n: number, now = Date.now()): string[] {
  return Array.from({ length: n }, (_, i) => new Date(now - (n - 1 - i) * DAY).toISOString().slice(0, 10));
}
