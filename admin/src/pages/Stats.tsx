import { useData, useSections } from "../components/data";
import { Empty, PageHead } from "../components/ui";
import SecIcon from "../components/SecIcon";
import { ago } from "../lib/format";
import { approvalRate, avgReviewHours, lastDays, topCounts, weeklyNew } from "../lib/stats";

function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="cols" role="img" aria-label="رسم أعمدة">
      {values.map((v, i) => (
        <div key={i} className="col" title={`${labels[i]}: ${v}`}>
          <span className="col-n">{v || ""}</span>
          <span className="col-bar" style={{ height: `${(v / max) * 100}%` }} />
          <span className="col-l">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export default function Stats() {
  const { places, requests, stats, daily } = useData();
  const secs = useSections();
  const rate = approvalRate(requests.rows);
  const hours = avgReviewHours(requests.rows);
  const oldest = requests.rows.filter((r) => r.status === "pending").sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0))[0];
  const weeks = weeklyNew(places.rows, 8);
  const days = lastDays(14);
  const dailyMap = new Map(daily.rows.map((d) => [d.id, (d.calls ?? 0) + (d.whatsapp ?? 0)]));
  const dayVals = days.map((d) => dailyMap.get(d) ?? 0);
  const top = stats.rows
    .map((s) => ({ s, p: places.rows.find((p) => p.id === s.id) }))
    .filter((x) => x.p)
    .sort((a, b) => (b.s.calls ?? 0) + (b.s.whatsapp ?? 0) - (a.s.calls ?? 0) - (a.s.whatsapp ?? 0))
    .slice(0, 10);
  const cats = topCounts(places.rows.map((p) => secs.title(p.section)), 8);
  const totalContacts = dayVals.reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHead title="الإحصائيات" sub="نمو الدليل، أداء المراجعة، واستخدام الناس له" />

      <dl className="figures">
        <div><dt>نسبة قبول الطلبات</dt><dd>{rate === null ? "—" : `${rate}%`}</dd></div>
        <div><dt>متوسط زمن المراجعة</dt><dd>{hours === null ? "—" : `${hours} ساعة`}</dd></div>
        <div><dt>أقدم طلب معلّق</dt><dd>{oldest ? ago(oldest.createdAt) : "لا يوجد"}</dd></div>
        <div><dt>اتصالات آخر 14 يوماً</dt><dd>{totalContacts}</dd></div>
      </dl>

      <div className="grid-2">
        <section className="panel">
          <h3>أنشطة جديدة (آخر 8 أسابيع)</h3>
          <Bars values={weeks} labels={weeks.map((_, i) => (i === weeks.length - 1 ? "الحالي" : `-${weeks.length - 1 - i}`))} />
        </section>
        <section className="panel">
          <h3>الاتصال والواتساب (آخر 14 يوماً)</h3>
          {totalContacts === 0 ? <p className="muted small">لا بيانات بعد. تبدأ الإحصائية عند أول ضغطة اتصال من التطبيق.</p> : (
            <Bars values={dayVals} labels={days.map((d) => d.slice(8))} />
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h3>الأكثر تواصلاً</h3>
          {top.length === 0 ? <Empty title="لا بيانات بعد" /> : (
            <ol className="rank">
              {top.map(({ s, p }) => (
                <li key={s.id}><span className="grow"><SecIcon s={secs.find(p!.section)} size={20} /> {p!.name}</span><b>{(s.calls ?? 0) + (s.whatsapp ?? 0)}</b><small className="muted">اتصال {s.calls ?? 0} · واتساب {s.whatsapp ?? 0}</small></li>
              ))}
            </ol>
          )}
        </section>
        <section className="panel">
          <h3>أكثر الأقسام أنشطة</h3>
          {cats.length === 0 ? <Empty title="لا أنشطة بعد" /> : (
            <ol className="rank">
              {cats.map(([c, n]) => <li key={c}><span className="grow">{c}</span><b>{n}</b></li>)}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
