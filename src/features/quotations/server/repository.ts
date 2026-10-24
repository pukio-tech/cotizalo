import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { quoteTotals, type Cents } from "../domain/calc";
import { rangeStart, type ListParams, type Sort } from "../domain/list-params";
import type { QuoteInput } from "../domain/schema";
import { toQuote, toRecordData, withRelations } from "./mappers";

// Acceso a datos de cotizaciones. Es el único módulo que habla con Prisma;
// en la Fase 4 aquí se filtrará por organización/usuario.

export const PAGE_SIZE = 20;

export interface QuotationRow {
  id: string;
  code: string;
  client: string;
  plan: string;
  days: number;
  updatedAt: string;
  /** Total del primer año en céntimos (mismo cálculo que el PDF). */
  firstYear: Cents;
}

const ORDER: Record<Sort, Prisma.QuotationOrderByWithRelationInput> = {
  recientes: { updatedAt: "desc" },
  antiguas: { updatedAt: "asc" },
  codigo: { code: "desc" },
  cliente: { client: "asc" },
};

export async function listQuotations({ query = "", page = 1, sort = "recientes", range = "todo" }: Partial<ListParams> = {}) {
  const q = query.trim();
  const since = rangeStart(range, new Date());
  const where: Prisma.QuotationWhereInput = {
    ...(q && {
      OR: [
        { client: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { plan: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(since && { createdAt: { gte: since } }),
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
    rows: records.map((r): QuotationRow => ({
      id: r.id,
      code: r.code,
      client: r.client,
      plan: r.plan,
      days: r.days,
      updatedAt: r.updatedAt.toISOString(),
      firstYear: quoteTotals(toQuote(r)).firstYear,
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export const countQuotations = () => prisma.quotation.count();

export async function getQuotation(id: string) {
  const r = await prisma.quotation.findUnique({ where: { id }, include: withRelations });
  return r ? toQuote(r) : null;
}

type Db = Prisma.TransactionClient | typeof prisma;

/** Siguiente correlativo del año: COT-2026-001, 002… Solo es definitivo dentro de `createQuotation`. */
export async function nextCode(year: number, db: Db = prisma) {
  const prefix = `COT-${year}-`;
  const codes = await db.quotation.findMany({
    where: { code: { startsWith: prefix, mode: "insensitive" } },
    select: { code: true },
  });
  const max = codes.reduce((m, { code }) => {
    const n = parseInt(code.slice(prefix.length), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return prefix + String(max + 1).padStart(3, "0");
}

// Clave fija del advisory lock que serializa la asignación de correlativos entre peticiones
const CODE_LOCK_KEY = 727_120_001;
const AUTO_CODE = /^COT-\d{4}-\d+$/i;

/**
 * Crea la cotización asignando el correlativo de forma atómica: dentro de la transacción
 * se toma un lock de Postgres, así dos usuarios guardando a la vez nunca reciben el mismo código.
 * - `assignCode: true` siempre asigna el siguiente (duplicar).
 * - Si el código es automático (COT-AAAA-NNN) y ya lo tomó otra cotización, se asigna el siguiente.
 * - Un código personalizado repetido sí falla (P2002) para que el usuario lo corrija.
 */
export async function createQuotation(input: QuoteInput, { assignCode = false } = {}) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${CODE_LOCK_KEY})`);
    let code = input.code;
    const taken = async () => (await tx.quotation.count({ where: { code: { equals: code, mode: "insensitive" } } })) > 0;
    if (assignCode || (AUTO_CODE.test(code) && (await taken()))) {
      code = await nextCode(new Date().getFullYear(), tx);
    }
    const d = toRecordData({ ...input, code });
    return tx.quotation.create({
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

export async function updateQuotation(id: string, input: QuoteInput) {
  const d = toRecordData(input);
  return prisma.$transaction(async (tx) => {
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

export const deleteQuotation = (id: string) => prisma.quotation.delete({ where: { id }, select: { id: true } });
