import type { Prisma } from "@prisma/client";
import { fromISODate, toISODate } from "../domain/dates";
import { STATUSES, type Period, type Quote, type QuoteInput, type Status } from "../domain/schema";

export const withRelations = {
  items: { orderBy: { order: "asc" } },
  includes: { orderBy: { order: "asc" } },
  conditions: { orderBy: { order: "asc" } },
} satisfies Prisma.QuotationInclude;

export type QuotationRecord = Prisma.QuotationGetPayload<{ include: typeof withRelations }>;

/** Registro de BD → cotización de la UI. */
export function toQuote(r: QuotationRecord): Quote {
  const item = (i: QuotationRecord["items"][number]) => ({ desc: i.desc, detail: i.detail, cant: i.cant, cost: i.cost });
  return {
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    code: r.code,
    status: (STATUSES as readonly string[]).includes(r.status) ? (r.status as Status) : "borrador",
    issuedAt: toISODate(r.issuedAt),
    publicToken: r.publicToken,
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    acceptedBy: r.acceptedBy,
    client: r.client,
    plan: r.plan,
    days: r.days,
    margin: r.margin,
    igv: r.igv,
    months: r.months,
    hdr: { on: r.hdrOn, name: r.hdrName, l1: r.hdrL1, l2: r.hdrL2 },
    initial: r.items.filter((i) => i.type === "initial").map(item),
    recurring: r.items
      .filter((i) => i.type === "recurring")
      .map((i) => ({ ...item(i), per: (i.per === "anual" ? "anual" : "mensual") as Period })),
    incl: r.includes.map((i) => i.text),
    cond: r.conditions.map((c) => c.text),
  };
}

/** Cotización validada → columnas y relaciones para Prisma. */
export function toRecordData(q: QuoteInput) {
  const items = [
    ...q.initial.map((i) => ({ ...i, type: "initial", per: null })),
    ...q.recurring.map((i) => ({ ...i, type: "recurring" })),
  ].map((i, order) => ({ ...i, order }));

  return {
    fields: {
      code: q.code,
      status: q.status,
      issuedAt: fromISODate(q.issuedAt),
      client: q.client || "Cliente sin nombre",
      plan: q.plan || "Propuesta comercial",
      days: q.days,
      margin: q.margin,
      igv: q.igv,
      months: q.months,
      hdrOn: q.hdr.on,
      hdrName: q.hdr.name,
      hdrL1: q.hdr.l1,
      hdrL2: q.hdr.l2,
    },
    items,
    includes: q.incl.map((text, order) => ({ text, order })),
    conditions: q.cond.map((text, order) => ({ text, order })),
  };
}
