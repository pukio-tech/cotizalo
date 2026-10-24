import { unitPrice } from "./calc";
import type { QuoteInput } from "./schema";

/**
 * Versión de la cotización que puede ver el cliente: los costos pasan a precio de venta y el
 * margen a 0. Los totales y el PDF salen idénticos, pero el costo base y el margen nunca
 * llegan al navegador del cliente.
 */
export function toPublicQuote<T extends QuoteInput>(q: T): T {
  const priced = <T extends { cost: number }>(it: T): T => ({ ...it, cost: unitPrice(it, q.margin) / 100 });
  return {
    ...q,
    margin: 0,
    initial: q.initial.map(priced),
    recurring: q.recurring.map(priced),
  };
}
