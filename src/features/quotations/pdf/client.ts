"use client";

import { localDate } from "../domain/dates";
import type { QuoteInput } from "../domain/schema";
import { buildQuotationPDF } from "./build-quotation-pdf";

/** Fecha que figura en el PDF: la de emisión de la cotización (la validez se cuenta desde ahí). */
export const issueDate = (q: Pick<QuoteInput, "issuedAt">) => localDate(q.issuedAt);

// jsPDF solo se descarga cuando el usuario pide el PDF
async function create(q: QuoteInput, logo?: string | null) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return buildQuotationPDF(q, issueDate(q), { jsPDF, autoTable }, { logo });
}

export async function quotationPdfUrl(q: QuoteInput, logo?: string | null) {
  const { doc, fileName } = await create(q, logo);
  return { url: URL.createObjectURL(doc.output("blob")), fileName };
}

export async function downloadQuotationPdf(q: QuoteInput, logo?: string | null) {
  const { doc, fileName } = await create(q, logo);
  doc.save(fileName);
}
