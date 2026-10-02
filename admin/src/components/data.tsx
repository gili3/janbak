import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { byOrder } from "../lib/sections";
import type { Announcement, AuditEntry, Place, RequestDoc, Section, StatDoc } from "../lib/types";

type Feed<T> = { rows: T[]; ready: boolean; error: string };
type Data = {
  places: Feed<Place>;
  requests: Feed<RequestDoc>;
  sections: Feed<Section>;
  announcements: Feed<Announcement>;
  audit: Feed<AuditEntry>;
  stats: Feed<StatDoc>;
  daily: Feed<StatDoc>;
  pending: number;
};

const empty = <T,>(): Feed<T> => ({ rows: [], ready: false, error: "" });
const Ctx = createContext<Data>({
  places: empty(), requests: empty(), sections: empty(), announcements: empty(), audit: empty(), stats: empty(), daily: empty(), pending: 0,
});
export const useData = () => useContext(Ctx);

function useFeed<T extends { id: string }>(name: string, order?: [string, "asc" | "desc"], max?: number): Feed<T> {
  const [feed, setFeed] = useState<Feed<T>>(empty());
  useEffect(() => {
    let q = query(collection(db, name));
    if (order) q = query(collection(db, name), orderBy(order[0], order[1]), limit(max ?? 100));
    return onSnapshot(
      q,
      (s) => setFeed({ rows: s.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as unknown as T), ready: true, error: "" }),
      (e) => setFeed({ rows: [], ready: true, error: e.code })
    );
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps
  return feed;
}

/** كل المجموعات تُراقب مرة واحدة هنا وتُشارَك بين الصفحات */
export function DataProvider({ children }: { children: ReactNode }) {
  const places = useFeed<Place>("places");
  const requests = useFeed<RequestDoc>("requests");
  const sections = useFeed<Section>("sections");
  const announcements = useFeed<Announcement>("announcements");
  const audit = useFeed<AuditEntry>("auditLog", ["createdAt", "desc"], 100);
  const stats = useFeed<StatDoc>("stats");
  // معرّف المستند = تاريخ اليوم (yyyy-mm-dd)، فنقرأ آخر 30 يوماً فقط بدل كل السجل
  const daily = useFeed<StatDoc>("statsDaily", ["__name__", "desc"], 30);
  const pending = requests.rows.filter((r) => r.status === "pending").length;
  return <Ctx.Provider value={{ places, requests, sections, announcements, audit, stats, daily, pending }}>{children}</Ctx.Provider>;
}

/** قائمة الأقسام للوحة كما هي في Firestore (مرتّبة). لا بيانات افتراضية. */
export function useSections() {
  const { sections } = useData();
  return useMemo(() => {
    const list = [...sections.rows].sort(byOrder);
    const find = (k: string) => list.find((s) => s.id === k);
    return {
      list,
      ready: sections.ready,
      find,
      title: (k: string) => find(k)?.title ?? k,
    };
  }, [sections.rows, sections.ready]);
}
