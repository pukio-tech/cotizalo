import type { QuoteInput, QuoteItem, RecurringItem } from "./schema";

// Todos los montos calculados están en céntimos (enteros): así lo que ve el cliente
// cuadra al céntimo (unitario × cantidad = importe; subtotal + IGV = total).
export type Cents = number;

export const IGV_RATE = 0.18;

type Pricing = Pick<QuoteInput, "margin" | "igv">;

/** Redondeo al entero más cercano que corrige el ruido de coma flotante (1.005 × 100 → 101). */
const round = (x: number) => Math.round(Number(x.toPrecision(12)));

/** Precio unitario de venta en céntimos: costo base + margen, redondeado al céntimo. */
export const unitPrice = (item: Pick<QuoteItem, "cost">, margin: number): Cents =>
  round((Number(item.cost) || 0) * (100 + (Number(margin) || 0)));

/** Importe de una línea en céntimos. */
export const lineTotal = (item: Pick<QuoteItem, "cost" | "cant">, margin: number): Cents =>
  unitPrice(item, margin) * (Number(item.cant) || 1);

export interface Sums {
  sub: Cents;
  igv: Cents;
  tot: Cents;
}

export function sums(list: QuoteItem[], { margin, igv }: Pricing): Sums {
  const sub = list.reduce((s, i) => s + lineTotal(i, margin), 0);
  const tax = igv ? round(sub * IGV_RATE) : 0;
  return { sub, igv: tax, tot: sub + tax };
}

export const isAnnual = (item: RecurringItem) => item.per === "anual";

export interface QuoteTotals {
  initial: Sums;
  monthly: Sums;
  annual: Sums;
  /** Pago inicial + mensualidades del primer año + renovaciones anuales. */
  firstYear: Cents;
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
