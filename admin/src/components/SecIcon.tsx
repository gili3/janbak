import type { Section } from "../lib/types";

/** شارة القسم: صورته المرفوعة من اللوحة، وإلا أول حرف من اسمه على لون القسم (بلا إيموجي) */
export default function SecIcon({ s, size = 28 }: { s?: Pick<Section, "title" | "image" | "color">; size?: number }) {
  const color = s?.color || "#64748B";
  return (
    <span className="secicon" style={{ width: size, height: size, background: `${color}29`, color, fontSize: size * 0.46 }} aria-hidden="true">
      {s?.image ? <img src={s.image} alt="" /> : (s?.title ?? "؟").trim().charAt(0)}
    </span>
  );
}
