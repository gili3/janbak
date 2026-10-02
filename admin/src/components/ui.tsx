import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

type ToastKind = "ok" | "err";
type ConfirmOpts = { title: string; body?: string; confirmLabel?: string; danger?: boolean };
type Ctx = {
  toast: (msg: string, kind?: ToastKind) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
};

const UiCtx = createContext<Ctx>({ toast: () => {}, confirm: async () => false });
export const useUi = () => useContext(UiCtx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: ToastKind }[]>([]);
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);

  const toast = useCallback((msg: string, kind: ToastKind = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })),
    []
  );
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null); };

  return (
    <UiCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}
      </div>
      {dlg && (
        <Modal title={dlg.title} onClose={() => close(false)} small>
          {dlg.body && <p className="muted">{dlg.body}</p>}
          <div className="actions">
            <button className={dlg.danger ? "btn danger" : "btn"} autoFocus onClick={() => close(true)}>{dlg.confirmLabel ?? "تأكيد"}</button>
            <button className="btn ghost" onClick={() => close(false)}>إلغاء</button>
          </div>
        </Modal>
      )}
    </UiCtx.Provider>
  );
}

export function Modal(p: { title: string; onClose: () => void; children: ReactNode; small?: boolean; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && p.onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [p]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div className={`modal${p.small ? " small" : ""}${p.wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={p.title}>
        <div className="modal-head">
          <h2>{p.title}</h2>
          <button className="icon" aria-label="إغلاق" onClick={p.onClose}>✕</button>
        </div>
        <div className="modal-body">{p.children}</div>
      </div>
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  pending: ["قيد المراجعة", "warn"],
  approved: ["مقبول", "ok"],
  rejected: ["مرفوض", "bad"],
  hidden: ["مخفي", "mute"],
};
export function StatusBadge({ status }: { status: string }) {
  const [label, cls] = STATUS[status] ?? [status, "mute"];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {body && <span>{body}</span>}
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
