"use client";

import type { Quote } from "../domain/schema";
import { buildQuotationPDF } from "./build-quotation-pdf";

/**
 * Fecha de emisión del PDF: la de creación si ya está guardada (la validez se cuenta desde ahí),
 * o hoy si aún no se guardó. Es la misma regla desde el editor y desde el listado.
 */
export const issueDate = (q: Pick<Quote, "createdAt">) => (q.createdAt ? new Date(q.createdAt) : new Date());

// jsPDF solo se descarga cuando el usuario pide el PDF
async function create(q: Quote) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return buildQuotationPDF(q, issueDate(q), { jsPDF, autoTable });
}

export async function quotationPdfUrl(q: Quote) {
  const { doc, fileName } = await create(q);
  return { url: URL.createObjectURL(doc.output("blob")), fileName };
}

export async function downloadQuotationPdf(q: Quote) {
  const { doc, fileName } = await create(q);
  doc.save(fileName);
}
