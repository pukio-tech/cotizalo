import type { jsPDF as JsPDF } from "jspdf";
import type { autoTable as AutoTable, CellHookData, RowInput, Styles } from "jspdf-autotable";
import { isAnnual, quoteTotals, unitPrice, type Sums } from "../domain/calc";
import { addDays, formatDate, money, pdfFileName } from "../domain/format";
import type { QuoteInput, QuoteItem, RecurringItem } from "../domain/schema";
import { visibleSections } from "../domain/sections";

// Se inyectan jsPDF y autoTable para poder usar el generador en el navegador
// (import dinámico) y en tests de Node sin acoplarlo a uno de los dos.
export interface PdfLib {
  jsPDF: typeof JsPDF;
  autoTable: typeof AutoTable;
}

type RGB = [number, number, number];
const INK: RGB = [20, 28, 49];
const GRAY: RGB = [100, 116, 139];
const RULE: RGB = [215, 215, 215];
const PAGE_W = 210;
const M = 16;
const R = PAGE_W - M;
const PAGE_BOTTOM = 282;

interface TextOpts {
  bold?: boolean;
  size?: number;
  color?: RGB;
  align?: "left" | "right" | "center";
}

/** Genera el PDF de la cotización. Solo dibuja las secciones con contenido. */
export function buildQuotationPDF(q: QuoteInput, date: Date, { jsPDF, autoTable }: PdfLib) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const totals = quoteTotals(q);
  const show = visibleSections(q, totals);
  let y = 18;
  let sectionNo = 0;

  const need = (h: number) => {
    if (y + h > PAGE_BOTTOM) {
      doc.addPage();
      y = 18;
    }
  };
  const text = (s: string, x: number, yy: number, o: TextOpts = {}) => {
    doc.setFont("helvetica", o.bold ? "bold" : "normal");
    doc.setFontSize(o.size ?? 9);
    doc.setTextColor(...(o.color ?? INK));
    doc.text(s, x, yy, { align: o.align ?? "left" });
  };
  const line = (x1: number, yy: number, x2: number, width: number, color: RGB = INK) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, yy, x2, yy);
  };
  const section = (title: string) => {
    need(40);
    text(`${++sectionNo}. ${title}`, M, y, { bold: true, size: 12 });
    y += 4;
  };

  // Cabecera
  if (q.hdr.on && (q.hdr.name || q.hdr.l1 || q.hdr.l2)) {
    if (q.hdr.name) {
      text(q.hdr.name, M, y, { bold: true, size: 16 });
      y += 5;
    }
    [q.hdr.l1, q.hdr.l2].filter(Boolean).forEach((l) => {
      text(l, M, y, { size: 8.5, color: GRAY });
      y += 4.5;
    });
    y += 6;
  }
  text("C O T I Z A C I Ó N", M, y, { bold: true, size: 17 });
  y += 6.5;
  text(q.code || "COT", M, y, { bold: true, size: 10.5 });
  y += 5.5;
  text(`Fecha ${formatDate(date)}  ·  válida hasta ${formatDate(addDays(date, q.days))}`, M, y, { color: GRAY });
  y += 8;
  text("Cliente: ", M, y, { bold: true });
  text(q.client || "-", M + 16, y);
  y += 5.5;
  text("Plan propuesto: ", M, y, { bold: true });
  text(q.plan || "-", M + 27, y);
  y += 9;

  const table = (list: (QuoteItem | RecurringItem)[], withPeriod: boolean) => {
    const cols = withPeriod ? 5 : 4;
    const qtyCol = withPeriod ? 2 : 1;
    const body: RowInput[] = [];
    // Por fila: "main" lleva detalle debajo, "detail" es la fila de detalle, "last" cierra el servicio
    const kind: ("main" | "detail" | "last")[] = [];

    list.forEach((it) => {
      const u = unitPrice(it, q.margin);
      const free = !u;
      const row: RowInput = [{ content: it.desc, styles: { fontStyle: "bold" } }];
      if (withPeriod) row.push(isAnnual(it as RecurringItem) ? "Anual" : "Mensual");
      row.push(String(it.cant), free ? "Incluido" : money(u), free ? "Incluido" : money(u * it.cant));
      body.push(row);
      if (it.detail) {
        kind.push("main");
        body.push([{ content: it.detail, colSpan: cols, styles: { fontSize: 8, textColor: GRAY } }]);
        kind.push("detail");
      } else {
        kind.push("last");
      }
    });

    const head = ["Descripción", ...(withPeriod ? ["Periodo"] : []), "Cant.", "P. unitario", "Importe"];
    const columnStyles: Record<number, Partial<Styles>> = withPeriod
      ? { 1: { cellWidth: 20 }, 2: { cellWidth: 13, halign: "center" as const }, 3: { cellWidth: 28, halign: "right" as const }, 4: { cellWidth: 28, halign: "right" as const } }
      : { 1: { cellWidth: 14, halign: "center" as const }, 2: { cellWidth: 30, halign: "right" as const }, 3: { cellWidth: 30, halign: "right" as const } };

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [head],
      body,
      theme: "plain",
      styles: { font: "helvetica", fontSize: 9, textColor: INK, cellPadding: { top: 2, bottom: 2, left: 1, right: 1 } },
      headStyles: { fontStyle: "bold", fontSize: 8.5, textColor: GRAY },
      columnStyles,
      didParseCell: (d: CellHookData) => {
        if (d.section === "body") {
          if (kind[d.row.index] === "main") d.cell.styles.cellPadding = { top: 2, bottom: 0.4, left: 1, right: 1 };
          if (kind[d.row.index] === "detail") d.cell.styles.cellPadding = { top: 0, bottom: 2.2, left: 1, right: 1 };
        }
        if (d.section === "head" && d.column.index >= qtyCol) d.cell.styles.halign = d.column.index === qtyCol ? "center" : "right";
      },
      didDrawCell: (d: CellHookData) => {
        const yy = d.cell.y + d.cell.height;
        if (d.section === "head") line(d.cell.x, yy, d.cell.x + d.cell.width, 0.35);
        else if (d.section === "body" && kind[d.row.index] !== "main") line(d.cell.x, yy, d.cell.x + d.cell.width, 0.15, RULE);
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  };

  const drawTotals = (rows: [label: string, amount: number, strong?: boolean][]) => {
    rows.forEach(([label, amount, strong]) => {
      need(7);
      if (strong) line(R - 78, y - 3.8, R, 0.3);
      text(label, R - 78, y, { bold: strong, size: strong ? 10 : 9, color: strong ? INK : GRAY });
      text(money(amount), R, y, { bold: strong, size: strong ? 10 : 9, align: "right" });
      y += strong ? 7 : 5.2;
    });
    y += 3;
  };
  const totalsBlock = (s: Sums, suffix: string, totalLabel: string): [string, number, boolean?][] => [
    [`Subtotal${suffix}`, s.sub],
    ...(q.igv ? [[`IGV (18%)${suffix}`, s.igv] as [string, number]] : []),
    [totalLabel, s.tot, true],
  ];

  const bullets = (title: string, items: string[]) => {
    need(14);
    text(title, M, y, { bold: true, size: 10.5 });
    y += 5.5;
    items.forEach((item) => {
      doc.setFont("helvetica", "normal").setFontSize(9);
      const wrapped: string[] = doc.splitTextToSize(item, R - M - 6);
      need(wrapped.length * 4.2 + 2);
      text("•", M + 1, y);
      wrapped.forEach((s) => {
        text(s, M + 6, y);
        y += 4.2;
      });
      y += 0.8;
    });
    y += 3;
  };

  if (show.initial) {
    section("Pago inicial (único)");
    table(q.initial, false);
    drawTotals(totalsBlock(totals.initial, "", "Total a pagar al inicio"));
  }

  if (show.recurring) {
    section("Planes y servicios renovables");
    table(q.recurring, true);
    const plusIgv = q.igv ? " + IGV" : "";
    drawTotals([
      ...(show.monthlyTotals ? totalsBlock(totals.monthly, " mensual", `Total mensual${plusIgv}`) : []),
      ...(show.annualTotals ? totalsBlock(totals.annual, " anual", `Total anual${plusIgv}`) : []),
    ]);
  }

  if (show.includes.length) bullets("Incluye:", show.includes);

  if (show.summary.length) {
    need(34);
    text("Resumen de pagos", M, y, { bold: true, size: 12 });
    y += 6;
    show.summary.forEach(({ label, amount }) => {
      text(label, M, y);
      text(money(amount), R, y, { align: "right" });
      y += 5.5;
    });
    line(M, y - 3.5, R, 0.4);
    text("Total primer año", M, y + 1, { bold: true, size: 11 });
    text(money(totals.firstYear), R, y + 1, { bold: true, size: 11, align: "right" });
    y += 6;
    text(q.igv ? "Montos con IGV incluido." : "Montos sin IGV.", R, y, { size: 8, color: GRAY, align: "right" });
    y += 9;
  }

  if (show.conditions.length) bullets("Condiciones", show.conditions);

  need(26);
  y += 12;
  line(R - 60, y, R, 0.3);
  text("Conformidad del cliente", R, y + 5, { align: "right" });

  return { doc, fileName: pdfFileName(q.code, q.client) };
}
