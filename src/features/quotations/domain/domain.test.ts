import { describe, expect, it } from "vitest";
import { fillDays, lineTotal, quoteTotals, sums, unitPrice } from "./calc";
import { money } from "./format";
import { annualItem, initialItem, monthlyItem, quote } from "./fixtures";
import { quoteInputSchema } from "./schema";
import { visibleSections } from "./sections";

describe("quoteTotals (en céntimos)", () => {
  it("aplica margen e IGV y proyecta el primer año", () => {
    const t = quoteTotals(quote({ initial: [initialItem], recurring: [monthlyItem, annualItem] }));
    expect(t.initial).toEqual({ sub: 130_000, igv: 23_400, tot: 153_400 });
    expect(t.monthly.tot).toBe(7_670);
    expect(t.annual.tot).toBe(15_340);
    expect(t.firstYear).toBe(153_400 + 7_670 * 12 + 15_340);
  });

  it("respeta margen 0, sin IGV y 0 mensualidades", () => {
    const t = quoteTotals(quote({ margin: 0, igv: false, months: 0, initial: [initialItem], recurring: [monthlyItem] }));
    expect(t.initial.tot).toBe(100_000);
    expect(t.firstYear).toBe(100_000);
  });

  it("redondea el unitario al céntimo y el importe es unitario × cantidad", () => {
    const item = { desc: "x", detail: "", cant: 3, cost: 33.33 };
    // 33.33 × 1.30 = 43.329 → S/ 43.33
    expect(unitPrice(item, 30)).toBe(4_333);
    expect(lineTotal(item, 30)).toBe(12_999);
    // IGV: 129.99 × 18% = 23.3982 → S/ 23.40, una sola vez sobre el subtotal
    expect(sums([item], { margin: 30, igv: true })).toEqual({ sub: 12_999, igv: 2_340, tot: 15_339 });
  });

  it("no arrastra errores de coma flotante", () => {
    expect(unitPrice({ cost: 1.005 }, 0)).toBe(101);
    expect(sums(Array.from({ length: 10 }, () => ({ desc: "", detail: "", cant: 1, cost: 0.1 })), { margin: 0, igv: false }).tot).toBe(100);
  });
});

describe("money", () => {
  it("formatea céntimos como soles", () => {
    expect(money(153_400)).toBe("S/ 1,534.00");
    expect(money(5)).toBe("S/ 0.05");
  });
});

describe("visibleSections", () => {
  it("oculta todo lo vacío", () => {
    const s = visibleSections(quote({ cond: [] }));
    expect(s).toMatchObject({ initial: false, recurring: false, includes: [], conditions: [], summary: [] });
  });

  it("sin renovables no muestra renovables ni resumen", () => {
    const s = visibleSections(quote({ initial: [initialItem] }));
    expect(s.initial).toBe(true);
    expect(s.recurring).toBe(false);
    expect(s.summary).toEqual([]);
  });

  it("solo anual: muestra el bloque anual y resumen sin fila mensual", () => {
    const s = visibleSections(quote({ initial: [initialItem], recurring: [annualItem] }));
    expect(s.monthlyTotals).toBe(false);
    expect(s.annualTotals).toBe(true);
    expect(s.summary.map((r) => r.label)).toEqual(["Pago inicial (único)", "Renovación anual (dominios y similares)"]);
  });

  it("solo mensual: el resumen aporta la proyección anual", () => {
    const s = visibleSections(quote({ recurring: [monthlyItem] }));
    expect(s.summary).toHaveLength(1);
  });

  it("reemplaza {dias} en todas sus apariciones e ignora puntos vacíos", () => {
    const s = visibleSections(quote({ days: 20, cond: ["{dias} y {dias}", "  "] }));
    expect(s.conditions).toEqual(["20 y 20"]);
    expect(fillDays("{dias}", 5)).toBe("5");
  });
});

describe("quoteInputSchema", () => {
  it("acepta valores en 0 sin reemplazarlos", () => {
    const r = quoteInputSchema.parse(quote({ margin: 0, months: 0, days: 0 }));
    expect([r.margin, r.months, r.days]).toEqual([0, 0, 0]);
  });

  it("rechaza datos fuera de rango", () => {
    expect(quoteInputSchema.safeParse(quote({ months: 13 })).success).toBe(false);
    expect(quoteInputSchema.safeParse(quote({ code: " " })).success).toBe(false);
    expect(quoteInputSchema.safeParse(quote({ initial: [{ ...initialItem, cost: -1 }] })).success).toBe(false);
  });
});
