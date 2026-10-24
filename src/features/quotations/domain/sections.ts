import { fillDays, quoteTotals, type QuoteTotals } from "./calc";
import type { QuoteInput } from "./schema";

// Reglas de qué se muestra en el PDF (y en el resumen del editor).
// Una sección sin contenido no aparece y las numeradas se renumeran.

export type SummaryRow = { label: string; amount: number };

export interface VisibleSections {
  initial: boolean;
  recurring: boolean;
  monthlyTotals: boolean;
  annualTotals: boolean;
  includes: string[];
  conditions: string[];
  /** Filas del resumen de pagos; vacío si el resumen no aporta. */
  summary: SummaryRow[];
}

export function summaryRows(t: QuoteTotals): SummaryRow[] {
  const rows: SummaryRow[] = [];
  if (t.has.initial) rows.push({ label: "Pago inicial (único)", amount: t.initial.tot });
  if (t.has.monthly) rows.push({ label: "Renovación mensual (desde el mes 2 de servicio)", amount: t.monthly.tot });
  if (t.has.annual) rows.push({ label: "Renovación anual (dominios y similares)", amount: t.annual.tot });
  // Con un solo tipo de pago el resumen repetiría el total de su sección,
  // salvo que haya mensualidades: ahí el total del primer año sí aporta.
  return rows.length > 1 || t.has.monthly ? rows : [];
}

export function visibleSections(q: QuoteInput, t: QuoteTotals = quoteTotals(q)): VisibleSections {
  const lines = (list: string[]) => list.map((s) => fillDays(s, q.days)).filter((s) => s.trim());
  return {
    initial: t.has.initial,
    recurring: t.has.monthly || t.has.annual,
    monthlyTotals: t.has.monthly,
    annualTotals: t.has.annual,
    includes: lines(q.incl),
    conditions: lines(q.cond),
    summary: summaryRows(t),
  };
}
