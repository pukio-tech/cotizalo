"use client";

import type { QuoteInput } from "../domain/schema";
import { buildQuotationPDF } from "./build-quotation-pdf";

// jsPDF solo se descarga cuando el usuario pide el PDF
async function create(q: QuoteInput, date: Date) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return buildQuotationPDF(q, date, { jsPDF, autoTable });
}

export async function quotationPdfUrl(q: QuoteInput, date: Date) {
  const { doc, fileName } = await create(q, date);
  return { url: URL.createObjectURL(doc.output("blob")), fileName };
}

export async function downloadQuotationPdf(q: QuoteInput, date: Date) {
  const { doc, fileName } = await create(q, date);
  doc.save(fileName);
}
