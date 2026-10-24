import { emptyQuote } from "./defaults";
import type { QuoteInput, QuoteItem, RecurringItem } from "./schema";

// Datos de ejemplo para tests
export const initialItem: QuoteItem = { desc: "Desarrollo web", detail: "Landing + blog", cant: 1, cost: 1000 };
export const monthlyItem: RecurringItem = { desc: "Hosting", detail: "", per: "mensual", cant: 1, cost: 50 };
export const annualItem: RecurringItem = { desc: "Dominio .pe", detail: "", per: "anual", cant: 1, cost: 100 };

export const quote = (over: Partial<QuoteInput> = {}): QuoteInput => ({
  ...emptyQuote("COT-2026-010"),
  client: "ACME",
  plan: "Web",
  ...over,
});
