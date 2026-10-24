import { toISODate } from "./dates";
import type { Quote, QuoteHeader } from "./schema";

export const DEFAULT_CONDITIONS = [
  "Precios en soles (S/). Cotización válida por {dias} días desde su emisión.",
  "50% al inicio del desarrollo y 50% a la entrega del proyecto.",
  "Medios de pago: Transferencia BCP / Yape / Plin.",
];

/** Cabecera del PDF a partir de los datos de la empresa (activa si hay algo que mostrar). */
export const headerFromOrganization = (org: { name: string; headerLine1: string; headerLine2: string }): QuoteHeader => ({
  on: !!(org.headerLine1 || org.headerLine2),
  name: org.name,
  l1: org.headerLine1,
  l2: org.headerLine2,
});

export const emptyQuote = (
  code: string,
  { hdr = { on: false, name: "", l1: "", l2: "" }, issuedAt = toISODate(new Date()) }: { hdr?: QuoteHeader; issuedAt?: string } = {}
): Quote => ({
  id: null,
  createdAt: null,
  code,
  status: "borrador",
  issuedAt,
  client: "",
  plan: "",
  days: 15,
  margin: 30,
  igv: true,
  months: 12,
  hdr,
  initial: [],
  recurring: [],
  incl: [],
  cond: [...DEFAULT_CONDITIONS],
});
