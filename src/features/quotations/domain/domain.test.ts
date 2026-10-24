import { describe, expect, it } from "vitest";
import { fillDays, quoteTotals } from "./calc";
import { annualItem, initialItem, monthlyItem, quote } from "./fixtures";
import { quoteInputSchema } from "./schema";
import { visibleSections } from "./sections";

describe("quoteTotals", () => {
  it("aplica margen e IGV y proyecta el primer año", () => {
    const t = quoteTotals(quote({ initial: [initialItem], recurring: [monthlyItem, annualItem] }));
    expect(t.initial.sub).toBeCloseTo(1300);
    expect(t.initial.tot).toBeCloseTo(1534);
    expect(t.monthly.tot).toBeCloseTo(76.7);
    expect(t.annual.tot).toBeCloseTo(153.4);
    expect(t.firstYear).toBeCloseTo(1534 + 76.7 * 12 + 153.4);
  });

  it("respeta margen 0, sin IGV y 0 mensualidades", () => {
    const t = quoteTotals(quote({ margin: 0, igv: false, months: 0, initial: [initialItem], recurring: [monthlyItem] }));
    expect(t.initial.tot).toBe(1000);
    expect(t.firstYear).toBe(1000);
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
