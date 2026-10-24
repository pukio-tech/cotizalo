import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { annualItem, initialItem, monthlyItem, quote } from "../domain/fixtures";
import * as repo from "./repository";

const year = new Date().getFullYear();
const code = (n: number) => `COT-${year}-${String(n).padStart(3, "0")}`;

beforeEach(async () => {
  await prisma.$executeRawUnsafe("TRUNCATE quotations CASCADE");
});

describe("correlativo", () => {
  it("empieza en 001 y sigue el mayor del año", async () => {
    expect(await repo.nextCode(year)).toBe(code(1));
    await repo.createQuotation(quote({ code: code(7) }));
    await repo.createQuotation(quote({ code: `COT-${year - 1}-099` }));
    expect(await repo.nextCode(year)).toBe(code(8));
  });

  it("si el código automático ya se usó, asigna el siguiente", async () => {
    await repo.createQuotation(quote({ code: code(1) }));
    const second = await repo.createQuotation(quote({ code: code(1) }));
    expect(second.code).toBe(code(2));
  });

  it("guardados simultáneos con el mismo código reciben códigos distintos", async () => {
    const saved = await Promise.all(Array.from({ length: 5 }, () => repo.createQuotation(quote({ code: code(1) }))));
    expect(new Set(saved.map((s) => s.code)).size).toBe(5);
  });

  it("un código personalizado repetido falla para que el usuario lo corrija", async () => {
    await repo.createQuotation(quote({ code: "PROPUESTA-ACME" }));
    await expect(repo.createQuotation(quote({ code: "PROPUESTA-ACME" }))).rejects.toMatchObject({ code: "P2002" });
  });

  it("assignCode siempre toma el siguiente (duplicar)", async () => {
    await repo.createQuotation(quote({ code: code(3) }));
    const copy = await repo.createQuotation(quote({ code: code(3) }), { assignCode: true });
    expect(copy.code).toBe(code(4));
  });
});

describe("guardar y leer", () => {
  it("conserva ceros, orden de servicios y textos", async () => {
    const { id } = await repo.createQuotation(
      quote({ code: code(1), margin: 0, months: 0, igv: false, initial: [initialItem], recurring: [annualItem, monthlyItem], incl: ["A", "B"] })
    );
    const q = await repo.getQuotation(id);
    expect(q).toMatchObject({ margin: 0, months: 0, igv: false, incl: ["A", "B"] });
    expect(q?.recurring.map((i) => i.per)).toEqual(["anual", "mensual"]);
    expect(q?.createdAt).toEqual(expect.any(String));
  });

  it("al actualizar reemplaza servicios sin duplicarlos", async () => {
    const { id } = await repo.createQuotation(quote({ code: code(1), initial: [initialItem, initialItem] }));
    await repo.updateQuotation(id, quote({ code: code(1), initial: [{ ...initialItem, desc: "Único" }] }));
    const q = await repo.getQuotation(id);
    expect(q?.initial.map((i) => i.desc)).toEqual(["Único"]);
    expect(await prisma.quotationItem.count()).toBe(1);
  });

  it("eliminar borra también sus servicios", async () => {
    const { id } = await repo.createQuotation(quote({ code: code(1), initial: [initialItem] }));
    await repo.deleteQuotation(id);
    expect(await repo.getQuotation(id)).toBeNull();
    expect(await prisma.quotationItem.count()).toBe(0);
  });
});

describe("listado", () => {
  it("busca sin distinguir mayúsculas y pagina", async () => {
    for (let i = 1; i <= repo.PAGE_SIZE + 3; i++) {
      await repo.createQuotation(quote({ code: code(i), client: i === 2 ? "Café Andino" : `Cliente ${i}` }));
    }
    const page2 = await repo.listQuotations({ page: 2 });
    expect(page2.total).toBe(repo.PAGE_SIZE + 3);
    expect(page2.pageCount).toBe(2);
    expect(page2.rows).toHaveLength(3);

    const found = await repo.listQuotations({ query: "café" });
    expect(found.rows.map((r) => r.client)).toEqual(["Café Andino"]);
  });

  it("ordena, filtra por fecha de creación e incluye el total del primer año", async () => {
    const old = await repo.createQuotation(quote({ code: code(1), client: "Beta", initial: [initialItem] }));
    await prisma.quotation.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 60 * 864e5) } });
    await repo.createQuotation(quote({ code: code(2), client: "Alfa", recurring: [monthlyItem] }));

    const byClient = await repo.listQuotations({ sort: "cliente" });
    expect(byClient.rows.map((r) => r.client)).toEqual(["Alfa", "Beta"]);

    const last30 = await repo.listQuotations({ range: "30d" });
    expect(last30.rows.map((r) => r.client)).toEqual(["Alfa"]);

    // 1 000 + 30% + IGV = S/ 1 534.00 · hosting 50 + 30% + IGV = 76.70 × 12
    expect(byClient.rows.find((r) => r.client === "Beta")?.firstYear).toBe(153_400);
    expect(byClient.rows.find((r) => r.client === "Alfa")?.firstYear).toBe(7_670 * 12);
  });
});
