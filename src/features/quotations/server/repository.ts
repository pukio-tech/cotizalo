import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
}

export async function listQuotations({ query = "", page = 1 }: { query?: string; page?: number }) {
  const q = query.trim();
  const where: Prisma.QuotationWhereInput = q
    ? {
        OR: [
          { client: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { plan: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, code: true, client: true, plan: true, days: true, updatedAt: true },
    }),
    prisma.quotation.count({ where }),
  ]);
  return {
    rows: rows.map((r): QuotationRow => ({ ...r, updatedAt: r.updatedAt.toISOString() })),
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export const countQuotations = () => prisma.quotation.count();

export async function getQuotation(id: string) {
  const r = await prisma.quotation.findUnique({ where: { id }, include: withRelations });
  return r ? toQuote(r) : null;
}

/** Siguiente correlativo del año: COT-2026-001, 002… (atómico en la Fase 2). */
export async function nextCode(year: number) {
  const prefix = `COT-${year}-`;
  const codes = await prisma.quotation.findMany({
    where: { code: { startsWith: prefix, mode: "insensitive" } },
    select: { code: true },
  });
  const max = codes.reduce((m, { code }) => {
    const n = parseInt(code.slice(prefix.length), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return prefix + String(max + 1).padStart(3, "0");
}

export async function createQuotation(input: QuoteInput) {
  const d = toRecordData(input);
  const r = await prisma.quotation.create({
    data: {
      ...d.fields,
      items: { create: d.items },
      includes: { create: d.includes },
      conditions: { create: d.conditions },
    },
    select: { id: true, code: true },
  });
  return r;
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
