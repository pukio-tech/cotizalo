import { describe, expect, it } from "vitest";
import { monthlyPipeline, summarize, type MetricRow } from "./metrics";
import { canAccept, effectiveStatus } from "./status";

const row = (status: MetricRow["status"], firstYear: number, issuedAt = "2026-10-01", days = 15): MetricRow => ({ status, firstYear, issuedAt, days });

describe("panel", () => {
  const today = "2026-10-24";
  const rows = [
    row("aceptada", 100_000),
    row("aceptada", 50_000),
    row("negociacion", 30_000),
    row("enviada", 20_000, "2026-10-20"),
    row("enviada", 7_000, "2026-09-01"), // vencida
    row("borrador", 5_000),
    row("rechazada", 90_000),
  ];

  it("aceptado suma solo las aceptadas", () => {
    expect(summarize(rows, today).won).toEqual({ count: 2, amount: 150_000 });
  });

  it("pronosticado suma aceptadas y todo lo abierto, sin las rechazadas", () => {
    const s = summarize(rows, today);
    expect(s.forecast).toEqual({ count: 6, amount: 212_000 });
    expect(s.open).toEqual({ count: 4, amount: 62_000 });
    expect(s.lost).toEqual({ count: 1, amount: 90_000 });
  });

  it("desglosa por estado efectivo y calcula la tasa de cierre", () => {
    const s = summarize(rows, today);
    expect(s.byStatus.vencida).toEqual({ count: 1, amount: 7_000 });
    expect(s.byStatus.enviada).toEqual({ count: 1, amount: 20_000 });
    expect(s.closeRate).toBeCloseTo(2 / 3);
    expect(summarize([row("borrador", 1)], today).closeRate).toBeNull();
  });

  it("agrupa por mes de emisión los últimos meses", () => {
    const points = monthlyPipeline([...rows, row("aceptada", 1_000, "2026-01-15")], today, 3);
    expect(points.map((p) => p.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(points[1]).toEqual({ month: "2026-09", won: 0, open: 7_000 });
    expect(points[2]).toEqual({ month: "2026-10", won: 150_000, open: 55_000 });
  });

  it("cruza el cambio de año", () => {
    expect(monthlyPipeline([], "2026-02-10", 3).map((p) => p.month)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});

describe("en negociación", () => {
  it("no vence y el cliente puede aceptarla", () => {
    const q = { status: "negociacion" as const, issuedAt: "2026-01-01", days: 15 };
    expect(effectiveStatus(q, "2026-10-24")).toBe("negociacion");
    expect(canAccept(q, "2026-10-24")).toBe(true);
  });
});
