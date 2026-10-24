import { describe, expect, it } from "vitest";
import { quoteTotals } from "./calc";
import { expiryISODate, fromISODate, toISODate } from "./dates";
import { emptyQuote, headerFromOrganization } from "./defaults";
import { annualItem, initialItem, monthlyItem, quote } from "./fixtures";
import { toPublicQuote } from "./public-quote";
import { canAccept, effectiveStatus } from "./status";

describe("fechas de emisión (hora de Lima)", () => {
  it("una cotización de las 9 p. m. en Lima conserva su fecha aunque en UTC ya sea el día siguiente", () => {
    // 2026-03-10 21:00 en Lima = 2026-03-11 02:00 UTC
    expect(toISODate(new Date("2026-03-11T02:00:00Z"))).toBe("2026-03-10");
  });

  it("ida y vuelta estable y vencimiento con cambio de mes", () => {
    expect(toISODate(fromISODate("2026-01-31"))).toBe("2026-01-31");
    expect(expiryISODate("2026-01-25", 15)).toBe("2026-02-09");
  });
});

describe("estado efectivo", () => {
  const sent = { status: "enviada" as const, issuedAt: "2026-10-01", days: 15 };

  it("una enviada vigente se puede aceptar", () => {
    expect(effectiveStatus(sent, "2026-10-16")).toBe("enviada");
    expect(canAccept(sent, "2026-10-16")).toBe(true);
  });

  it("una enviada pasada su validez se ve vencida y no se acepta", () => {
    expect(effectiveStatus(sent, "2026-10-17")).toBe("vencida");
    expect(canAccept(sent, "2026-10-17")).toBe(false);
  });

  it("borrador, aceptada y rechazada no vencen", () => {
    for (const status of ["borrador", "aceptada", "rechazada"] as const) {
      expect(effectiveStatus({ ...sent, status }, "2030-01-01")).toBe(status);
    }
  });
});

describe("versión pública", () => {
  it("no expone costo base ni margen, pero los totales son idénticos", () => {
    const q = quote({ margin: 37.5, initial: [{ ...initialItem, cost: 33.33, cant: 3 }], recurring: [monthlyItem, annualItem] });
    const pub = toPublicQuote(q);
    expect(pub.margin).toBe(0);
    expect(pub.initial[0].cost).not.toBe(33.33);
    expect(quoteTotals(pub)).toEqual(quoteTotals(q));
  });
});

describe("valores por defecto", () => {
  it("una cotización nueva es borrador de hoy con la cabecera de la empresa", () => {
    const hdr = headerFromOrganization({ name: "PUKIO", headerLine1: "hola@pukio.pe", headerLine2: "" });
    const q = emptyQuote("COT-2026-001", { hdr, issuedAt: "2026-10-24" });
    expect(q).toMatchObject({ status: "borrador", issuedAt: "2026-10-24", hdr: { on: true, name: "PUKIO", l1: "hola@pukio.pe" } });
    expect(headerFromOrganization({ name: "X", headerLine1: "", headerLine2: "" }).on).toBe(false);
  });
});
