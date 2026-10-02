import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { createContext, useContext } from "react";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { DataProvider, useData } from "./components/data";
import { UiProvider } from "./components/ui";
import Dashboard from "./pages/Dashboard";
import Requests from "./pages/Requests";
import Places from "./pages/Places";
import Sections from "./pages/Sections";
import Settings from "./pages/Settings";
import Announcements from "./pages/Announcements";
import Audit from "./pages/Audit";
import Stats from "./pages/Stats";
import Admins from "./pages/Admins";
import type { Role } from "./lib/types";

const RoleCtx = createContext<Role>("moderator");
export const useRole = () => useContext(RoleCtx);
const ROLE_NAME: Record<Role, string> = { owner: "مالك", editor: "محرر", moderator: "مشرف" };
const canEdit = (r: Role) => r === "owner" || r === "editor";

type Gate = { state: "loading" } | { state: "out" } | { state: "denied"; user: User } | { state: "admin"; user: User; role: Role };

function useTheme() {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("theme") ?? "auto");
  useEffect(() => {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "auto" ? "dark" : t === "dark" ? "light" : "auto"))] as const;
}

export default function App() {
  const [gate, setGate] = useState<Gate>({ state: "loading" });
  const [theme, cycleTheme] = useTheme();

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) return setGate({ state: "out" });
    setGate({ state: "loading" });
    try {
      const a = await getDoc(doc(db, "admins", u.uid));
      const r = a.exists() ? (a.data().role as Role | undefined) : undefined;
      setGate(a.exists() ? { state: "admin", user: u, role: r === "editor" || r === "moderator" ? r : "owner" } : { state: "denied", user: u });
    } catch {
      setGate({ state: "denied", user: u });
    }
  }), []);

  return (
    <UiProvider>
      {gate.state === "loading" && <div className="center muted">جارٍ التحميل…</div>}
      {gate.state === "out" && <Login />}
      {gate.state === "denied" && (
        <div className="login">
          <h1>لا تملك صلاحية الإدارة</h1>
          <p className="muted">حسابك <bdi dir="ltr">{gate.user.email}</bdi> غير مضاف كمدير. أنشئ مستنداً في Firestore باسم <bdi dir="ltr">admins/{gate.user.uid}</bdi> ثم أعد تحميل الصفحة.</p>
          <button className="btn ghost" onClick={() => signOut(auth)}>تسجيل الخروج</button>
        </div>
      )}
      {gate.state === "admin" && (
        <DataProvider>
          <RoleCtx.Provider value={gate.role}><Shell email={gate.user.email ?? ""} theme={theme} cycleTheme={cycleTheme} /></RoleCtx.Provider>
        </DataProvider>
      )}
    </UiProvider>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr("");
    try { await signInWithEmailAndPassword(auth, email.trim(), pw); }
    catch { setErr("البريد أو كلمة المرور غير صحيحة"); setBusy(false); }
  };
  const google = async () => {
    setBusy(true); setErr("");
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch { setErr("تعذر الدخول بجوجل (تأكد من إضافة نطاق اللوحة في Authorized domains)"); setBusy(false); }
  };
  return (
    <form className="login" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <h1>جنبك</h1>
      <p className="muted">لوحة الإدارة</p>
      <label>البريد الإلكتروني<input type="email" dir="ltr" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>كلمة المرور<input type="password" dir="ltr" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      {err && <p className="notice bad">{err}</p>}
      <button className="btn" disabled={busy || !email || !pw}>{busy ? "جارٍ الدخول…" : "دخول"}</button>
      <button type="button" className="btn ghost" disabled={busy} onClick={google}>الدخول بحساب جوجل</button>
    </form>
  );
}

function Shell({ email, theme, cycleTheme }: { email: string; theme: string; cycleTheme: () => void }) {
  const { pending } = useData();
  const role = useRole();
  const links: [string, string, number?][] = [
    ["/", "نظرة عامة"],
    ["/requests", "الطلبات", pending],
    ...(canEdit(role) ? ([["/places", "الأنشطة"], ["/sections", "الأقسام"], ["/announcements", "الإعلانات"], ["/settings", "نصوص التطبيق"]] as [string, string][]) : []),
    ["/stats", "الإحصائيات"],
    ["/audit", "سجل العمليات"],
    ...(role === "owner" ? ([["/admins", "المدراء"]] as [string, string][]) : []),
  ];
  return (
    <div className="shell">
      <aside>
        <div className="brand">جنبك<small>{ROLE_NAME[role]}</small></div>
        <nav>
          {links.map(([to, label, n]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "on" : "")}>
              {label}{n ? <span className="count">{n}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <button className="btn ghost small" onClick={cycleTheme}>المظهر: {theme === "auto" ? "تلقائي" : theme === "dark" ? "داكن" : "فاتح"}</button>
          <bdi dir="ltr" className="email">{email}</bdi>
          <button className="btn ghost small" onClick={() => signOut(auth)}>خروج</button>
        </div>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/requests" element={<Requests />} />
          {canEdit(role) && <Route path="/places" element={<Places />} />}
          {canEdit(role) && <Route path="/sections" element={<Sections />} />}
          {canEdit(role) && <Route path="/settings" element={<Settings />} />}
          {canEdit(role) && <Route path="/announcements" element={<Announcements />} />}
          <Route path="/stats" element={<Stats />} />
          <Route path="/audit" element={<Audit />} />
          {role === "owner" && <Route path="/admins" element={<Admins />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
