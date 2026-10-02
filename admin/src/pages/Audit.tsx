import { useData } from "../components/data";
import { Empty, PageHead } from "../components/ui";
import { fmt } from "../lib/format";

const LABELS: Record<string, string> = {
  "request.approve": "قبول طلب",
  "request.reject": "رفض طلب",
  "announcement.push": "إرسال إشعار إعلان",
  "account.delete": "حذف حساب مستخدم",
  "admin.set": "إضافة/تعديل مدير",
  "admin.remove": "إزالة مدير",
};
export const actionLabel = (a: string) => LABELS[a] ?? a;

export default function Audit() {
  const { audit } = useData();
  return (
    <>
      <PageHead title="سجل العمليات" sub="آخر 100 عملية مراجعة وإرسال" />
      {audit.error && <p className="notice bad">تعذرت قراءة السجل ({audit.error})</p>}
      {audit.ready && audit.rows.length === 0 ? (
        <Empty title="لا توجد عمليات بعد" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>العملية</th><th>العنصر</th><th>السبب</th><th>الوقت</th></tr></thead>
            <tbody>
              {audit.rows.map((a) => (
                <tr key={a.id}>
                  <td>{actionLabel(a.action)}</td>
                  <td>{a.name || "—"}</td>
                  <td>{a.reason || "—"}</td>
                  <td className="nowrap">{fmt(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
