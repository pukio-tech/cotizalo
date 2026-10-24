import type { QuoteInput, QuoteItem, RecurringItem } from "./schema";

export const IGV_RATE = 0.18;

type Pricing = Pick<QuoteInput, "margin" | "igv">;

/** Precio unitario de venta: costo base + margen. */
export const unitPrice = (item: Pick<QuoteItem, "cost">, margin: number) =>
  (Number(item.cost) || 0) * (1 + (Number(margin) || 0) / 100);

export interface Sums {
  sub: number;
  igv: number;
  tot: number;
}

export function sums(list: QuoteItem[], { margin, igv }: Pricing): Sums {
  const sub = list.reduce((s, i) => s + unitPrice(i, margin) * (Number(i.cant) || 1), 0);
  const tax = igv ? sub * IGV_RATE : 0;
  return { sub, igv: tax, tot: sub + tax };
}

export const isAnnual = (item: RecurringItem) => item.per === "anual";

export interface QuoteTotals {
  initial: Sums;
  monthly: Sums;
  annual: Sums;
  /** Pago inicial + mensualidades del primer año + renovaciones anuales. */
  firstYear: number;
  /** Qué bloques tienen al menos un servicio (decide qué secciones se muestran). */
  has: { initial: boolean; monthly: boolean; annual: boolean };
}

export function quoteTotals(q: QuoteInput): QuoteTotals {
  const monthlyItems = q.recurring.filter((i) => !isAnnual(i));
  const annualItems = q.recurring.filter(isAnnual);
  const initial = sums(q.initial, q);
  const monthly = sums(monthlyItems, q);
  const annual = sums(annualItems, q);
  return {
    initial,
    monthly,
    annual,
    firstYear: initial.tot + monthly.tot * q.months + annual.tot,
    has: { initial: q.initial.length > 0, monthly: monthlyItems.length > 0, annual: annualItems.length > 0 },
  };
}

/** Reemplaza todas las apariciones de {dias} por los días de validez. */
export const fillDays = (text: string, days: number) => text.replace(/\{dias\}/g, String(days));
