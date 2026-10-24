import type { jsPDF as JsPDF } from "jspdf";
import type { autoTable as AutoTable, CellHookData, RowInput, Styles } from "jspdf-autotable";
import { isAnnual, lineTotal, quoteTotals, unitPrice, type Cents, type Sums } from "../domain/calc";
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
const BRAND: RGB = [2, 203, 221];
// Cyan oscuro para texto: el cyan de marca sobre blanco no llega al contraste mínimo
const BRAND_TEXT: RGB = [14, 116, 144];
const PANEL: RGB = [244, 247, 250];
const PAGE_W = 210;
const PAGE_H = 297;
const M = 16;
const R = PAGE_W - M;
const TOP = 20;
// Por debajo queda el pie de página
const PAGE_BOTTOM = 276;

interface TextOpts {
  bold?: boolean;
  size?: number;
  color?: RGB;
  align?: "left" | "right" | "center";
}

export interface PdfOptions {
  /** Logo de la empresa como data URL (PNG/JPEG); se muestra junto a la cabecera */
  logo?: string | null;
}

/** Genera el PDF de la cotización. Solo dibuja las secciones con contenido. */
export function buildQuotationPDF(q: QuoteInput, date: Date, { jsPDF, autoTable }: PdfLib, { logo }: PdfOptions = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const totals = quoteTotals(q);
  const show = visibleSections(q, totals);
  let y = TOP;
  let sectionNo = 0;
  const issuer = q.hdr.on ? [q.hdr.name, q.hdr.l1, q.hdr.l2].filter(Boolean) : [];

  const need = (h: number) => {
    if (y + h > PAGE_BOTTOM) {
      doc.addPage();
      y = TOP;
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
  const wrap = (s: string, width: number, size: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size);
    return doc.splitTextToSize(s, width) as string[];
  };
  const section = (title: string) => {
    need(40);
    doc.setFillColor(...BRAND);
    doc.rect(M, y - 3.6, 1.2, 4.4, "F");
    text(`${++sectionNo}. ${title}`, M + 3.5, y, { bold: true, size: 12 });
    y += 4;
  };

  // Cabecera: datos del emisor a la izquierda (si hay) y el bloque de la cotización
  const titleX = issuer.length ? R : M;
  const titleAlign = issuer.length ? "right" : "left";
  let iy = y;
  let ix = M;
  // Logo a la izquierda de los datos del emisor (si no se puede leer, se omite sin romper el PDF)
  if (q.hdr.on && logo) {
    try {
      const props = doc.getImageProperties(logo);
      const h = 14;
      const w = Math.min(36, (h * props.width) / props.height);
      doc.addImage(logo, /^data:image\/png/i.test(logo) ? "PNG" : "JPEG", M, y - 6, w, h);
      ix = M + w + 4;
      iy = Math.max(iy, y);
    } catch {}
  }
  const issuerWidth = 95 - (ix - M);
  if (q.hdr.on && q.hdr.name) {
    wrap(q.hdr.name, issuerWidth, 15, true)
      .slice(0, 2)
      .forEach((l) => {
        text(l, ix, iy, { bold: true, size: 15 });
        iy += 6;
      });
  }
  [q.hdr.l1, q.hdr.l2]
    .filter((l) => q.hdr.on && l)
    .forEach((l) => {
      wrap(l, issuerWidth, 8.5).forEach((s) => {
        text(s, ix, iy, { size: 8.5, color: GRAY });
        iy += 4.5;
      });
    });
  if (ix > M) iy = Math.max(iy, y + 10);
  text("C O T I Z A C I Ó N", titleX, y, { bold: true, size: 17, align: titleAlign });
  text(q.code || "COT", titleX, y + 6.5, { bold: true, size: 10.5, color: BRAND_TEXT, align: titleAlign });
  text(`Fecha: ${formatDate(date)}`, titleX, y + 12, { color: GRAY, align: titleAlign });
  text(`Válida hasta: ${formatDate(addDays(date, q.days))}`, titleX, y + 16.5, { color: GRAY, align: titleAlign });
  y = Math.max(y + 25, iy + 6);

  // Cliente y plan en un recuadro (los textos largos se ajustan en varias líneas)
  const clientLines = wrap(q.client || "-", R - M - 34, 9.5, true);
  const planLines = wrap(q.plan || "-", R - M - 34, 9);
  const boxH = 6 + (clientLines.length + planLines.length) * 4.6 + 2;
  doc.setFillColor(...PANEL);
  doc.roundedRect(M, y, R - M, boxH, 1.5, 1.5, "F");
  let by = y + 6;
  text("Cliente", M + 4, by, { size: 8, color: GRAY });
  clientLines.forEach((l) => {
    text(l, M + 30, by, { bold: true, size: 9.5 });
    by += 4.6;
  });
  text("Plan propuesto", M + 4, by, { size: 8, color: GRAY });
  planLines.forEach((l) => {
    text(l, M + 30, by);
    by += 4.6;
  });
  y += boxH + 9;

  const table = (list: (QuoteItem | RecurringItem)[], withPeriod: boolean) => {
    const qtyCol = withPeriod ? 2 : 1;
    // Una fila por servicio: nombre y detalle van en la misma celda para que nunca se separen al saltar de página
    const body: RowInput[] = list.map((it) => {
      const u = unitPrice(it, q.margin);
      const free = !u;
      return [
        { content: it.detail ? `${it.desc}
${it.detail}` : it.desc, styles: { fontStyle: "bold" } },
        ...(withPeriod ? [isAnnual(it as RecurringItem) ? "Anual" : "Mensual"] : []),
        String(it.cant),
        free ? "Incluido" : money(u),
        free ? "Incluido" : money(lineTotal(it, q.margin)),
      ];
    });

    const head = ["Descripción", ...(withPeriod ? ["Periodo"] : []), "Cant.", "P. unitario", "Importe"];
    const columnStyles: Record<number, Partial<Styles>> = withPeriod
      ? { 1: { cellWidth: 20 }, 2: { cellWidth: 13, halign: "center" as const }, 3: { cellWidth: 28, halign: "right" as const }, 4: { cellWidth: 28, halign: "right" as const } }
      : { 1: { cellWidth: 14, halign: "center" as const }, 2: { cellWidth: 30, halign: "right" as const }, 3: { cellWidth: 30, halign: "right" as const } };
    const rowRule = (d: CellHookData) => line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, 0.15, RULE);

    autoTable(doc, {
      startY: y,
      // Respeta la barra superior y el pie al saltar de página
      margin: { left: M, right: M, top: TOP, bottom: PAGE_H - PAGE_BOTTOM },
      showHead: "everyPage",
      rowPageBreak: "avoid",
      head: [head],
      body,
      theme: "plain",
      styles: { font: "helvetica", fontSize: 9, textColor: INK, cellPadding: { top: 2, bottom: 2, left: 1, right: 1 } },
      headStyles: { fontStyle: "bold", fontSize: 8.5, textColor: GRAY },
      columnStyles,
      didParseCell: (d: CellHookData) => {
        if (d.section === "head" && d.column.index >= qtyCol) d.cell.styles.halign = d.column.index === qtyCol ? "center" : "right";
      },
      // La descripción con detalle se dibuja a mano: nombre en negrita y detalle gris más pequeño
      willDrawCell: (d: CellHookData) => {
        const it = list[d.row.index];
        if (d.section !== "body" || d.column.index !== 0 || !it.detail) return;
        const x = d.cell.x + 1;
        const width = d.cell.width - 2;
        let ty = d.cell.y + 2;
        wrap(it.desc, width, 9, true).forEach((l) => {
          text(l, x, ty + 2.6, { bold: true });
          ty += 3.9;
        });
        wrap(it.detail, width, 8).forEach((l) => {
          text(l, x, ty + 2.6, { size: 8, color: GRAY });
          ty += 3.5;
        });
        rowRule(d);
        return false;
      },
      didDrawCell: (d: CellHookData) => {
        if (d.section === "head") line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, 0.35);
        else if (d.section === "body") rowRule(d);
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  };

  const drawTotals = (rows: [label: string, amount: Cents, strong?: boolean][]) => {
    rows.forEach(([label, amount, strong]) => {
      need(7);
      if (strong) line(R - 78, y - 3.8, R, 0.3);
      text(label, R - 78, y, { bold: strong, size: strong ? 10 : 9, color: strong ? INK : GRAY });
      text(money(amount), R, y, { bold: strong, size: strong ? 10 : 9, align: "right" });
      y += strong ? 7 : 5.2;
    });
    y += 3;
  };
  const totalsBlock = (s: Sums, suffix: string, totalLabel: string): [string, Cents, boolean?][] => [
    [`Subtotal${suffix}`, s.sub],
    ...(q.igv ? [[`IGV (18%)${suffix}`, s.igv] as [string, Cents]] : []),
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
    const boxH = 12 + show.summary.length * 5.5 + 12;
    need(boxH + 4);
    doc.setFillColor(...PANEL);
    doc.roundedRect(M, y, R - M, boxH, 1.5, 1.5, "F");
    const bx = M + 5;
    const br = R - 5;
    let sy = y + 8;
    text("Resumen de pagos", bx, sy, { bold: true, size: 12 });
    sy += 6.5;
    show.summary.forEach(({ label, amount }) => {
      text(label, bx, sy);
      text(money(amount), br, sy, { align: "right" });
      sy += 5.5;
    });
    line(bx, sy - 3.5, br, 0.5, BRAND);
    text("Total primer año", bx, sy + 1.5, { bold: true, size: 11 });
    text(money(totals.firstYear), br, sy + 1.5, { bold: true, size: 11, align: "right" });
    text(q.igv ? "Montos con IGV incluido." : "Montos sin IGV.", br, sy + 6.5, { size: 8, color: GRAY, align: "right" });
    y += boxH + 8;
  }

  if (show.conditions.length) bullets("Condiciones", show.conditions);

  need(26);
  y += 12;
  line(R - 60, y, R, 0.3);
  text("Conformidad del cliente", R, y + 5, { align: "right" });

  // Barra de marca y pie en todas las páginas (incluidas las que agrega autoTable)
  const pages = doc.getNumberOfPages();
  const footer = issuer.length ? issuer.join("  ·  ") : `Cotización ${q.code}`;
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, PAGE_W, 2.5, "F");
    line(M, PAGE_H - 14, R, 0.2, RULE);
    text(wrap(footer, R - M - 30, 7.5)[0], M, PAGE_H - 9.5, { size: 7.5, color: GRAY });
    text(`Página ${p} de ${pages}`, R, PAGE_H - 9.5, { size: 7.5, color: GRAY, align: "right" });
  }

  return { doc, fileName: pdfFileName(q.code, q.client) };
}
