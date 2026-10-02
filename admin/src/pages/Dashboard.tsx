import { Link } from "react-router-dom";
import { useData, useSections } from "../components/data";
import { Empty, PageHead } from "../components/ui";
import SecIcon from "../components/SecIcon";
import { ago } from "../lib/format";
import { actionLabel } from "./Audit";

export default function Dashboard() {
  const { places, requests, announcements, audit, pending } = useData();
  const secs = useSections();
  const queue = requests.rows
    .filter((r) => r.status === "pending")
    .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
  const published = places.rows.filter((p) => p.status === "approved");
  const hidden = places.rows.length - published.length;
  const max = Math.max(1, ...secs.list.map((s) => places.rows.filter((p) => p.section === s.id).length));
  const err = places.error || requests.error;

  return (
    <>
      <PageHead title="نظرة عامة" sub="ما يحتاج انتباهك الآن وحالة الدليل" />
      {err && <p className="notice bad">تعذرت قراءة البيانات ({err}). تأكد من نشر قواعد Firestore ومن وجود المستند admins/‎&lt;UID&gt;.</p>}

      <section className="queue">
        <div className="queue-head">
          <h2>{pending === 0 ? "لا توجد طلبات تنتظر المراجعة" : `${pending} ${pending === 1 ? "طلب ينتظر" : "طلبات تنتظر"} مراجعتك`}</h2>
          {pending > 0 && <Link className="btn" to="/requests">راجع الطلبات</Link>}
        </div>
        {queue.length === 0 ? (
          <p className="muted">الطلبات الجديدة من المستخدمين تظهر هنا فور وصولها.</p>
        ) : (
          <ul className="plain">
            {queue.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link to={`/requests?open=${r.id}`} className="line">
                  <SecIcon s={secs.find(r.section)} size={32} />
                  <span className="grow">
                    <b>{r.name}</b>
                    <small>{r.kind === "edit" ? "طلب تعديل" : "طلب إضافة"} · {secs.title(r.section)}</small>
                  </span>
                  <small className="muted">{ago(r.createdAt)}</small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid-2">
        <section className="panel">
          <h3>الأنشطة حسب القسم</h3>
          <p className="muted small">{published.length} منشور{hidden > 0 ? ` · ${hidden} مخفي` : ""}</p>
          <ul className="bars">
            {secs.list.map((s) => {
              const n = places.rows.filter((p) => p.section === s.id).length;
              return (
                <li key={s.id}>
                  <span className="bar-label line-flex"><SecIcon s={s} size={20} />{s.title}</span>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${(n / max) * 100}%` }} /></span>
                  <span className="bar-n">{n}</span>
                </li>
              );
            })}
          </ul>
          {places.ready && places.rows.length === 0 && (
            <p className="muted small">الدليل فارغ. أضف أنشطة من صفحة «الأنشطة» أو استوردها من ملف CSV.</p>
          )}
        </section>

        <section className="panel">
          <h3>آخر العمليات</h3>
          {audit.rows.length === 0 ? (
            <Empty title="لا توجد عمليات بعد" body="تظهر هنا مراجعات الطلبات وتغييرات المدراء" />
          ) : (
            <ul className="plain">
              {audit.rows.slice(0, 7).map((a) => (
                <li key={a.id} className="line">
                  <span className="grow"><b>{actionLabel(a.action)}</b>{a.name ? <small> — {a.name}</small> : null}</span>
                  <small className="muted">{ago(a.createdAt)}</small>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">{announcements.rows.filter((a) => a.active).length} إعلان فعّال</p>
        </section>
      </div>
    </>
  );
}
