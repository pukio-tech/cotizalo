import type { Quote } from "./schema";

export const DEFAULT_CONDITIONS = [
  "Precios en soles (S/). Cotización válida por {dias} días desde su emisión.",
  "50% al inicio del desarrollo y 50% a la entrega del proyecto.",
  "Medios de pago: Transferencia BCP / Yape / Plin.",
];

export const emptyQuote = (code: string): Quote => ({
  id: null,
  createdAt: null,
  code,
  client: "",
  plan: "",
  days: 15,
  margin: 30,
  igv: true,
  months: 12,
  hdr: { on: false, name: "", l1: "", l2: "" },
  initial: [],
  recurring: [],
  incl: [],
  cond: [...DEFAULT_CONDITIONS],
});
