import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { describe, expect, it } from "vitest";
import { annualItem, initialItem, monthlyItem, quote } from "../domain/fixtures";
import type { QuoteInput } from "../domain/schema";
import { buildQuotationPDF } from "./build-quotation-pdf";

// jsPDF no comprime por defecto: los textos se pueden buscar en el PDF crudo
const render = (q: QuoteInput) => buildQuotationPDF(q, new Date(2026, 9, 23), { jsPDF, autoTable }).doc.output();
const has = (raw: string, s: string) => raw.includes(s.replace(/[()]/g, (c) => "\\" + c));

describe("buildQuotationPDF", () => {
  it("dibuja todas las secciones cuando hay contenido", () => {
    const raw = render(quote({ initial: [initialItem], recurring: [monthlyItem, annualItem], incl: ["SSL"] }));
    for (const s of ["1. Pago inicial (único)", "2. Planes y servicios renovables", "Subtotal mensual", "Subtotal anual", "Incluye:", "Resumen de pagos", "Condiciones", "Conformidad del cliente"]) {
      expect(has(raw, s), s).toBe(true);
    }
  });

  it("omite renovables, incluye y resumen si no hay contenido", () => {
    const raw = render(quote({ initial: [initialItem] }));
    expect(has(raw, "1. Pago inicial (único)")).toBe(true);
    for (const s of ["Planes y servicios renovables", "Incluye:", "Resumen de pagos"]) expect(has(raw, s), s).toBe(false);
  });

  it("renumera: sin pago inicial, renovables es la sección 1", () => {
    const raw = render(quote({ recurring: [annualItem], cond: [] }));
    expect(has(raw, "1. Planes y servicios renovables")).toBe(true);
    expect(has(raw, "Subtotal mensual")).toBe(false);
    expect(has(raw, "Condiciones")).toBe(false);
  });

  it("numera las páginas y repite el encabezado de la tabla al saltar de página", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...initialItem, desc: `Servicio ${i + 1}` }));
    const { doc } = buildQuotationPDF(quote({ initial: many }), new Date(2026, 9, 23), { jsPDF, autoTable });
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);
    const raw = doc.output();
    expect(raw).toContain(`Página ${pages} de ${pages}`);
    expect(raw.split("(Descripción) Tj").length - 1).toBeGreaterThanOrEqual(pages);
  });

  it("usa los datos del emisor en el pie si hay cabecera", () => {
    const raw = render(quote({ hdr: { on: true, name: "PUKIO", l1: "hola@pukio.pe", l2: "" } }));
    expect(raw).toContain("PUKIO  ·  hola@pukio.pe");
    expect(render(quote())).toContain("Cotización COT-2026-010");
  });

  it("nombra el archivo con código y cliente", () => {
    const { fileName } = buildQuotationPDF(quote({ client: "Café Ñandú SAC" }), new Date(), { jsPDF, autoTable });
    expect(fileName).toBe("COT-2026-010_Café_Ñandú_SAC.pdf");
  });
});
