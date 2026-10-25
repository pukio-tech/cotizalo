import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { quoteTotals, type Cents } from "../domain/calc";
import { rangeStart, type ListParams, type Range, type Sort } from "../domain/list-params";
import type { QuoteInput, Status } from "../domain/schema";
import { ACCEPTABLE_STATUSES } from "../domain/status";
import { toQuote, toRecordData, withRelations, type QuotationRecord } from "./mappers";

// Acceso a datos de cotizaciones. Es el único módulo que habla con Prisma sobre cotizaciones y
// TODAS sus funciones exigen la empresa (orgId): una cotización de otra empresa no existe para ti.

export const PAGE_SIZE = 20;

type Db = Prisma.TransactionClient | typeof prisma;

/** Error de "no existe o no es tuya" (mismo mensaje en ambos casos, para no filtrar información). */
export class NotFoundError extends Error {
  constructor() {
    super("La cotización ya no existe");
  }
}

export interface QuotationRow {
  id: string;
  code: string;
  client: string;
  plan: string;
  days: number;
  status: Status;
  issuedAt: string;
  updatedAt: string;
  /** Total del primer año en céntimos (mismo cálculo que el PDF). */
  firstYear: Cents;
}

function toRow(r: QuotationRecord): QuotationRow {
  const quote = toQuote(r);
  return {
    id: r.id,
    code: r.code,
    client: r.client,
    plan: r.plan,
    days: r.days,
    status: quote.status,
    issuedAt: quote.issuedAt,
    updatedAt: r.updatedAt.toISOString(),
    firstYear: quoteTotals(quote).firstYear,
  };
}

const ORDER: Record<Sort, Prisma.QuotationOrderByWithRelationInput> = {
  recientes: { updatedAt: "desc" },
  antiguas: { updatedAt: "asc" },
  codigo: { code: "desc" },
  cliente: { client: "asc" },
};

export async function listQuotations(orgId: string, { query = "", page = 1, sort = "recientes", range = "todo", status }: Partial<ListParams> = {}) {
  const q = query.trim();
  const since = rangeStart(range, new Date());
  const where: Prisma.QuotationWhereInput = {
    organizationId: orgId,
    ...(q && {
      OR: [
        { client: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { plan: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(since && { issuedAt: { gte: since } }),
    ...(status && { status }),
  };
  const [records, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: [ORDER[sort], { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: withRelations,
    }),
    prisma.quotation.count({ where }),
  ]);
  return {
    rows: records.map(toRow),
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Todas las cotizaciones de la empresa (tablero y panel), opcionalmente desde un rango de emisión. */
export async function listAllQuotations(orgId: string, { range = "todo" }: { range?: Range } = {}) {
  const since = rangeStart(range, new Date());
  const records = await prisma.quotation.findMany({
    where: { organizationId: orgId, ...(since && { issuedAt: { gte: since } }) },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    include: withRelations,
  });
  return records.map(toRow);
}

export const countQuotations = (orgId: string) => prisma.quotation.count({ where: { organizationId: orgId } });

export async function getQuotation(orgId: string, id: string) {
  const r = await prisma.quotation.findFirst({ where: { id, organizationId: orgId }, include: withRelations });
  return r ? toQuote(r) : null;
}

/** Siguiente correlativo del año en la empresa: COT-2026-001, 002… Solo es definitivo dentro de `createQuotation`. */
export async function nextCode(orgId: string, year: number, db: Db = prisma) {
  const prefix = `COT-${year}-`;
  const codes = await db.quotation.findMany({
    where: { organizationId: orgId, code: { startsWith: prefix, mode: "insensitive" } },
    select: { code: true },
  });
  const max = codes.reduce((m, { code }) => {
    const n = parseInt(code.slice(prefix.length), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return prefix + String(max + 1).padStart(3, "0");
}

// Clave del advisory lock que serializa la asignación de correlativos (una por empresa)
const CODE_LOCK_KEY = 727_120_001;
const AUTO_CODE = /^COT-\d{4}-\d+$/i;

/**
 * Crea la cotización asignando el correlativo de forma atómica: dentro de la transacción
 * se toma un lock de Postgres por empresa, así dos usuarios guardando a la vez nunca reciben el mismo código.
 * - `assignCode: true` siempre asigna el siguiente (duplicar).
 * - Si el código es automático (COT-AAAA-NNN) y ya lo tomó otra cotización, se asigna el siguiente.
 * - Un código personalizado repetido sí falla (P2002) para que el usuario lo corrija.
 */
export async function createQuotation(orgId: string, input: QuoteInput, { assignCode = false } = {}) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CODE_LOCK_KEY}::int, hashtext(${orgId}))`;
    let code = input.code;
    const taken = async () =>
      (await tx.quotation.count({ where: { organizationId: orgId, code: { equals: code, mode: "insensitive" } } })) > 0;
    if (assignCode || (AUTO_CODE.test(code) && (await taken()))) {
      code = await nextCode(orgId, new Date().getFullYear(), tx);
    }
    const d = toRecordData({ ...input, code });
    return tx.quotation.create({
      data: {
        ...d.fields,
        organizationId: orgId,
        items: { create: d.items },
        includes: { create: d.includes },
        conditions: { create: d.conditions },
      },
      select: { id: true, code: true },
    });
  });
}

/** Comprueba que la cotización sea de la empresa (dentro de la transacción) o lanza NotFoundError. */
async function assertOwned(db: Db, orgId: string, id: string) {
  const found = await db.quotation.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!found) throw new NotFoundError();
}

export async function updateQuotation(orgId: string, id: string, input: QuoteInput) {
  const d = toRecordData(input);
  return prisma.$transaction(async (tx) => {
    await assertOwned(tx, orgId, id);
    await tx.quotationItem.deleteMany({ where: { quotationId: id } });
    await tx.quotationInclude.deleteMany({ where: { quotationId: id } });
    await tx.quotationCondition.deleteMany({ where: { quotationId: id } });
    return tx.quotation.update({
      where: { id },
      data: {
        ...d.fields,
        items: { create: d.items },
        includes: { create: d.includes },
        conditions: { create: d.conditions },
      },
      select: { id: true, code: true },
    });
  });
}

export async function deleteQuotation(orgId: string, id: string) {
  const { count } = await prisma.quotation.deleteMany({ where: { id, organizationId: orgId } });
  if (!count) throw new NotFoundError();
}

/**
 * Cambia solo el estado (listado, tablero). Marcarla aceptada a mano registra la fecha;
 * sacarla de aceptada borra quién y cuándo la aceptó.
 */
export async function setStatus(orgId: string, id: string, status: Status) {
  await prisma.$transaction(async (tx) => {
    const q = await tx.quotation.findFirst({ where: { id, organizationId: orgId }, select: { status: true } });
    if (!q) throw new NotFoundError();
    if (q.status === status) return;
    await tx.quotation.update({
      where: { id },
      data: {
        status,
        ...(status === "aceptada" ? { acceptedAt: new Date() } : q.status === "aceptada" && { acceptedAt: null, acceptedBy: null }),
      },
    });
  });
}

// ─── Enlace público ──────────────────────────────────────────────────────────

/** Devuelve el token del enlace público, creándolo si no existe. Compartir la marca como "enviada". */
export async function shareQuotation(orgId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const q = await tx.quotation.findFirst({ where: { id, organizationId: orgId }, select: { publicToken: true, status: true } });
    if (!q) throw new NotFoundError();
    const publicToken = q.publicToken ?? randomBytes(18).toString("base64url");
    await tx.quotation.update({
      where: { id },
      data: { publicToken, ...(q.status === "borrador" && { status: "enviada" }) },
    });
    return publicToken;
  });
}

/** Deja de compartir: el enlace anterior deja de funcionar. */
export async function revokeShare(orgId: string, id: string) {
  const { count } = await prisma.quotation.updateMany({ where: { id, organizationId: orgId }, data: { publicToken: null } });
  if (!count) throw new NotFoundError();
}

/** Cotización vista por el cliente a través del enlace (sin sesión). */
export async function getPublicQuotation(token: string) {
  const r = await prisma.quotation.findUnique({
    where: { publicToken: token },
    include: { ...withRelations, organization: { select: { name: true, logo: true } } },
  });
  if (!r || !r.organization) return null;
  return { quote: toQuote(r), organization: r.organization };
}

/** Aceptación del cliente: solo si sigue enviada o en negociación (la vigencia la valida quien llama). */
export async function acceptPublicQuotation(token: string, acceptedBy: string) {
  const { count } = await prisma.quotation.updateMany({
    where: { publicToken: token, status: { in: [...ACCEPTABLE_STATUSES] } },
    data: { status: "aceptada", acceptedAt: new Date(), acceptedBy },
  });
  return count > 0;
}
