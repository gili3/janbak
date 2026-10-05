import { describe, expect, it } from "vitest";
import { parseCsv, toCsv, toMs } from "./format";
import { latinDigits, validPhone } from "./phone";
import { approvalRate, lastDays, topCounts, weeklyNew } from "./stats";
import type { Place, RequestDoc } from "./types";

const ts = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) }) as never;

describe("phone", () => {
  it("يحوّل الأرقام العربية ويقصّ على 10", () => {
    expect(latinDigits("٠٩١٢٣٤٥٦٧٨٩٠")).toBe("0912345678");
    expect(latinDigits("09-12 34")).toBe("091234");
  });
  it("يتحقق من الصيغة", () => {
    expect(validPhone("0912345678")).toBe(true);
    expect(validPhone("912345678")).toBe(false);
    expect(validPhone("09123456789")).toBe(false);
  });
});

describe("csv", () => {
  it("يدعم الاقتباس والفاصلة والسطر داخل الحقل", () => {
    const rows = parseCsv('name,services\n"بقالة, النور","سطر1\nسطر2"\nمخبز,خبز');
    expect(rows).toEqual([["name", "services"], ["بقالة, النور", "سطر1\nسطر2"], ["مخبز", "خبز"]]);
  });
  it("يدعم BOM والفاصلة المنقوطة العربية وCRLF", () => {
    expect(parseCsv("\uFEFFa؛b\r\n1؛2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("يعيد التصدير ثم القراءة بنفس القيم", () => {
    const data = [["a", 'q"uote'], ["x,y", "z"]];
    expect(parseCsv(toCsv(data))).toEqual(data);
  });
});

describe("stats", () => {
  const now = Date.UTC(2026, 9, 2);
  it("weeklyNew يوزع الأنشطة على الأسابيع", () => {
    const mk = (d: number) => ({ createdAt: ts(now - d * 86400000) }) as unknown as Place;
    expect(weeklyNew([mk(1), mk(2), mk(8), mk(60)], 4, now)).toEqual([0, 0, 1, 2]);
  });
  it("approvalRate يتجاهل المعلّق", () => {
    const r = (status: string) => ({ status }) as unknown as RequestDoc;
    expect(approvalRate([r("approved"), r("approved"), r("rejected"), r("pending")])).toBe(67);
    expect(approvalRate([r("pending")])).toBeNull();
  });
  it("topCounts و lastDays", () => {
    expect(topCounts(["بقالة", " بقالة", "مخبز", ""], 5)).toEqual([["بقالة", 2], ["مخبز", 1]]);
    expect(lastDays(3, now)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("toMs", () => {
  it("يتحمل أشكال الوقت المختلفة بلا انهيار", () => {
    expect(toMs(ts(5000))).toBe(5000);
    expect(toMs({ seconds: 2, nanoseconds: 0 })).toBe(2000);
    expect(toMs(new Date(7000))).toBe(7000);
    expect(toMs(1_700_000_000)).toBe(1_700_000_000_000);
    expect(toMs("2026-01-01T00:00:00Z")).toBe(Date.parse("2026-01-01T00:00:00Z"));
    expect(toMs(null)).toBeNull();
    expect(toMs("غير تاريخ")).toBeNull();
    expect(toMs({ foo: 1 })).toBeNull();
  });
});
