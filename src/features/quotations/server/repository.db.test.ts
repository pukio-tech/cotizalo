import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { annualItem, initialItem, monthlyItem, quote } from "../domain/fixtures";
import * as repo from "./repository";

const year = new Date().getFullYear();
const code = (n: number) => `COT-${year}-${String(n).padStart(3, "0")}`;
const A = "org-a";
const B = "org-b";

beforeEach(async () => {
  await prisma.$executeRawUnsafe("TRUNCATE quotations, organizations CASCADE");
  for (const id of [A, B]) {
    await prisma.organization.create({ data: { id, name: `Empresa ${id}`, slug: id, createdAt: new Date() } });
  }
});

describe("correlativo", () => {
  it("empieza en 001 y sigue el mayor del año de la empresa", async () => {
    expect(await repo.nextCode(A, year)).toBe(code(1));
    await repo.createQuotation(A, quote({ code: code(7) }));
    await repo.createQuotation(A, quote({ code: `COT-${year - 1}-099` }));
    await repo.createQuotation(B, quote({ code: code(40) }));
    expect(await repo.nextCode(A, year)).toBe(code(8));
  });

  it("si el código automático ya se usó, asigna el siguiente", async () => {
    await repo.createQuotation(A, quote({ code: code(1) }));
    const second = await repo.createQuotation(A, quote({ code: code(1) }));
    expect(second.code).toBe(code(2));
  });

  it("guardados simultáneos con el mismo código reciben códigos distintos", async () => {
    const saved = await Promise.all(Array.from({ length: 5 }, () => repo.createQuotation(A, quote({ code: code(1) }))));
    expect(new Set(saved.map((s) => s.code)).size).toBe(5);
  });

  it("un código personalizado repetido falla para que el usuario lo corrija", async () => {
    await repo.createQuotation(A, quote({ code: "PROPUESTA-ACME" }));
    await expect(repo.createQuotation(A, quote({ code: "PROPUESTA-ACME" }))).rejects.toMatchObject({ code: "P2002" });
  });

  it("dos empresas pueden usar el mismo código", async () => {
    const a = await repo.createQuotation(A, quote({ code: code(1) }));
    const b = await repo.createQuotation(B, quote({ code: code(1) }));
    expect([a.code, b.code]).toEqual([code(1), code(1)]);
  });

  it("assignCode siempre toma el siguiente (duplicar)", async () => {
    await repo.createQuotation(A, quote({ code: code(3) }));
    const copy = await repo.createQuotation(A, quote({ code: code(3) }), { assignCode: true });
    expect(copy.code).toBe(code(4));
  });
});

describe("aislamiento entre empresas", () => {
  it("una empresa no puede leer, editar, borrar ni compartir cotizaciones de otra", async () => {
    const { id } = await repo.createQuotation(A, quote({ code: code(1), client: "Secreto" }));
    expect(await repo.getQuotation(B, id)).toBeNull();
    await expect(repo.updateQuotation(B, id, quote({ code: code(1), client: "Hackeado" }))).rejects.toBeInstanceOf(repo.NotFoundError);
    await expect(repo.deleteQuotation(B, id)).rejects.toBeInstanceOf(repo.NotFoundError);
    await expect(repo.shareQuotation(B, id)).rejects.toBeInstanceOf(repo.NotFoundError);
    await expect(repo.setStatus(B, id, "aceptada")).rejects.toBeInstanceOf(repo.NotFoundError);
    expect((await repo.listQuotations(B)).total).toBe(0);
    expect(await repo.countQuotations(B)).toBe(0);
    expect((await repo.getQuotation(A, id))?.client).toBe("Secreto");
  });
});

describe("guardar y leer", () => {
  it("conserva ceros, estado, fecha de emisión, orden de servicios y textos", async () => {
    const { id } = await repo.createQuotation(
      A,
      quote({ code: code(1), margin: 0, months: 0, igv: false, status: "enviada", issuedAt: "2026-03-15", initial: [initialItem], recurring: [annualItem, monthlyItem], incl: ["A", "B"] })
    );
    const q = await repo.getQuotation(A, id);
    expect(q).toMatchObject({ margin: 0, months: 0, igv: false, status: "enviada", issuedAt: "2026-03-15", incl: ["A", "B"] });
    expect(q?.recurring.map((i) => i.per)).toEqual(["anual", "mensual"]);
  });

  it("al actualizar reemplaza servicios sin duplicarlos", async () => {
    const { id } = await repo.createQuotation(A, quote({ code: code(1), initial: [initialItem, initialItem] }));
    await repo.updateQuotation(A, id, quote({ code: code(1), initial: [{ ...initialItem, desc: "Único" }] }));
    const q = await repo.getQuotation(A, id);
    expect(q?.initial.map((i) => i.desc)).toEqual(["Único"]);
    expect(await prisma.quotationItem.count()).toBe(1);
  });

  it("eliminar borra también sus servicios", async () => {
    const { id } = await repo.createQuotation(A, quote({ code: code(1), initial: [initialItem] }));
    await repo.deleteQuotation(A, id);
    expect(await repo.getQuotation(A, id)).toBeNull();
    expect(await prisma.quotationItem.count()).toBe(0);
  });
});

describe("enlace público", () => {
  it("compartir crea un token estable y pasa el borrador a enviada", async () => {
    const { id } = await repo.createQuotation(A, quote({ code: code(1) }));
    const token = await repo.shareQuotation(A, id);
    expect(token.length).toBeGreaterThanOrEqual(20);
    expect(await repo.shareQuotation(A, id)).toBe(token);
    expect((await repo.getQuotation(A, id))?.status).toBe("enviada");
    expect((await repo.getPublicQuotation(token))?.organization.name).toBe("Empresa org-a");
  });

  it("el cliente acepta una sola vez y queda registrado", async () => {
    const { id } = await repo.createQuotation(A, quote({ code: code(1) }));
    const token = await repo.shareQuotation(A, id);
    expect(await repo.acceptPublicQuotation(token, "Ana Pérez")).toBe(true);
    expect(await repo.acceptPublicQuotation(token, "Otra persona")).toBe(false);
    expect(await repo.getQuotation(A, id)).toMatchObject({ status: "aceptada", acceptedBy: "Ana Pérez" });
  });

  it("dejar de compartir invalida el enlace", async () => {
    const { id } = await repo.createQuotation(A, quote({ code: code(1) }));
    const token = await repo.shareQuotation(A, id);
    await repo.revokeShare(A, id);
    expect(await repo.getPublicQuotation(token)).toBeNull();
  });
});

describe("listado", () => {
  it("busca sin distinguir mayúsculas y pagina", async () => {
    for (let i = 1; i <= repo.PAGE_SIZE + 3; i++) {
      await repo.createQuotation(A, quote({ code: code(i), client: i === 2 ? "Café Andino" : `Cliente ${i}` }));
    }
    const page2 = await repo.listQuotations(A, { page: 2 });
    expect(page2.total).toBe(repo.PAGE_SIZE + 3);
    expect(page2.pageCount).toBe(2);
    expect(page2.rows).toHaveLength(3);

    const found = await repo.listQuotations(A, { query: "café" });
    expect(found.rows.map((r) => r.client)).toEqual(["Café Andino"]);
  });

  it("ordena, filtra por fecha de emisión y estado, e incluye el total del primer año", async () => {
    const old = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    await repo.createQuotation(A, quote({ code: code(1), client: "Beta", issuedAt: old, status: "aceptada", initial: [initialItem] }));
    await repo.createQuotation(A, quote({ code: code(2), client: "Alfa", recurring: [monthlyItem] }));

    const byClient = await repo.listQuotations(A, { sort: "cliente" });
    expect(byClient.rows.map((r) => r.client)).toEqual(["Alfa", "Beta"]);
    expect((await repo.listQuotations(A, { range: "30d" })).rows.map((r) => r.client)).toEqual(["Alfa"]);
    expect((await repo.listQuotations(A, { status: "aceptada" })).rows.map((r) => r.client)).toEqual(["Beta"]);

    // 1 000 + 30% + IGV = S/ 1 534.00 · hosting 50 + 30% + IGV = 76.70 × 12
    expect(byClient.rows.find((r) => r.client === "Beta")?.firstYear).toBe(153_400);
    expect(byClient.rows.find((r) => r.client === "Alfa")?.firstYear).toBe(7_670 * 12);
  });
});

describe("cambio de estado (tablero)", () => {
  it("marcar aceptada registra la fecha y sacarla de aceptada la limpia", async () => {
    const { id } = await repo.createQuotation(A, quote({ code: code(1) }));
    await repo.setStatus(A, id, "aceptada");
    expect((await repo.getQuotation(A, id))?.acceptedAt).not.toBeNull();
    await repo.setStatus(A, id, "negociacion");
    expect(await repo.getQuotation(A, id)).toMatchObject({ status: "negociacion", acceptedAt: null, acceptedBy: null });
    await expect(repo.setStatus(B, id, "rechazada")).rejects.toBeInstanceOf(repo.NotFoundError);
  });

  it("el cliente puede aceptar una cotización en negociación", async () => {
    const { id } = await repo.createQuotation(A, quote({ code: code(1) }));
    const token = await repo.shareQuotation(A, id);
    await repo.setStatus(A, id, "negociacion");
    expect(await repo.acceptPublicQuotation(token, "Ana Pérez")).toBe(true);
    expect((await repo.getQuotation(A, id))?.status).toBe("aceptada");
  });

  it("el tablero trae todas las cotizaciones de la empresa sin paginar", async () => {
    for (let i = 1; i <= repo.PAGE_SIZE + 2; i++) await repo.createQuotation(A, quote({ code: code(i) }));
    await repo.createQuotation(B, quote({ code: code(1) }));
    expect(await repo.listAllQuotations(A)).toHaveLength(repo.PAGE_SIZE + 2);
  });
});
