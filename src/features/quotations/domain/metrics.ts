import type { Cents } from "./calc";
import type { Status } from "./schema";
import { effectiveStatus, type EffectiveStatus } from "./status";

// Métricas del panel. Todo se calcula sobre el total del primer año (mismo monto que el listado y el PDF).

export interface MetricRow {
  status: Status;
  issuedAt: string;
  days: number;
  firstYear: Cents;
}

export interface Bucket {
  count: number;
  amount: Cents;
}

/** Orden del desglose: del inicio al cierre del proceso comercial. */
export const PIPELINE_ORDER: readonly EffectiveStatus[] = ["borrador", "enviada", "vencida", "negociacion", "aceptada", "rechazada"];

const empty = (): Bucket => ({ count: 0, amount: 0 });

/**
 * - Aceptado: lo ya ganado.
 * - Pronosticado: aceptadas + todo lo que sigue abierto (borrador, enviada, vencida, en negociación). Solo excluye las rechazadas.
 * - En curso: pronosticado − aceptado.
 * - Tasa de cierre: aceptadas / (aceptadas + rechazadas); null si aún no se cerró ninguna.
 */
export function summarize(rows: readonly MetricRow[], today: string) {
  const byStatus = Object.fromEntries(PIPELINE_ORDER.map((s) => [s, empty()])) as Record<EffectiveStatus, Bucket>;
  for (const r of rows) {
    const b = byStatus[effectiveStatus(r, today)];
    b.count++;
    b.amount += r.firstYear;
  }
  const won = byStatus.aceptada;
  const lost = byStatus.rechazada;
  const forecast = PIPELINE_ORDER.filter((s) => s !== "rechazada").reduce(
    (acc, s) => ({ count: acc.count + byStatus[s].count, amount: acc.amount + byStatus[s].amount }),
    empty()
  );
  const closed = won.count + lost.count;
  return {
    byStatus,
    won,
    lost,
    forecast,
    open: { count: forecast.count - won.count, amount: forecast.amount - won.amount },
    closeRate: closed ? won.count / closed : null,
  };
}

export interface MonthPoint {
  /** "AAAA-MM" */
  month: string;
  won: Cents;
  open: Cents;
}

/** Aceptado y en curso por mes de emisión, de los últimos `months` meses (incluido el actual). */
export function monthlyPipeline(rows: readonly MetricRow[], today: string, months = 6): MonthPoint[] {
  const [y, m] = today.split("-").map(Number);
  const points: MonthPoint[] = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1));
    return { month: d.toISOString().slice(0, 7), won: 0, open: 0 };
  });
  const byMonth = new Map(points.map((p) => [p.month, p]));
  for (const r of rows) {
    const p = byMonth.get(r.issuedAt.slice(0, 7));
    if (!p || r.status === "rechazada") continue;
    if (r.status === "aceptada") p.won += r.firstYear;
    else p.open += r.firstYear;
  }
  return points;
}
