import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { requireViewer } from "@/lib/session";
import { cn } from "@/lib/utils";
import { fromISODate, toISODate } from "../../domain/dates";
import { money } from "../../domain/format";
import { rangeStart, RANGES, type Range } from "../../domain/list-params";
import { monthlyPipeline, PIPELINE_ORDER, summarize, type MonthPoint } from "../../domain/metrics";
import { STATUS_LABELS } from "../../domain/status";
import { listAllQuotations } from "../../server/repository";
import { StatusBadge } from "../status-badge";

// Panel comercial. Montos = total del primer año de cada cotización (igual que el listado y el PDF).

const percent = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 0 });
const monthFmt = new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" });
const monthLongFmt = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Énfasis: lo aceptado en el acento, lo que sigue abierto en gris (validado para daltonismo, claro y oscuro)
const WON_BAR = "bg-[#0891b2]";
const OPEN_BAR = "bg-[#cbd5e1] dark:bg-[#475569]";

export async function Dashboard({ range }: { range: Range }) {
  await connection();
  const { organization } = await requireViewer();
  const all = await listAllQuotations(organization.id);
  const today = toISODate(new Date());

  if (!all.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <FileText className="size-10 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-semibold">Aún no hay cotizaciones</p>
          <p className="text-sm text-muted-foreground">Cuando crees y aceptes cotizaciones verás aquí tus totales.</p>
        </div>
        <Button asChild>
          <Link href="/cotizaciones/nueva">Crear cotización</Link>
        </Button>
      </div>
    );
  }

  const since = rangeStart(range, new Date());
  const rows = since ? all.filter((r) => fromISODate(r.issuedAt) >= since) : all;
  const s = summarize(rows, today);
  const wonShare = s.forecast.amount ? s.won.amount / s.forecast.amount : 0;
  const maxStatus = Math.max(1, ...PIPELINE_ORDER.map((st) => s.byStatus[st].amount));

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Aceptado" value={money(s.won.amount)} hint={plural(s.won.count, "cotización aceptada", "cotizaciones aceptadas")} accent />
        <Kpi label="Pronosticado" value={money(s.forecast.amount)} hint={`Aceptado + en curso · ${plural(s.forecast.count, "cotización", "cotizaciones")}`}>
          <Meter value={wonShare} label={`${percent.format(wonShare)} ya aceptado`} />
        </Kpi>
        <Kpi label="En curso" value={money(s.open.amount)} hint={`${s.open.count} por cerrar: borradores, enviadas, vencidas y en negociación`} />
        <Kpi
          label="Tasa de cierre"
          value={s.closeRate === null ? "–" : percent.format(s.closeRate)}
          hint={s.closeRate === null ? "Aún no hay cotizaciones aceptadas ni rechazadas" : `${s.won.count} de ${plural(s.won.count + s.lost.count, "cerrada", "cerradas")} fue aceptada${s.won.count === 1 ? "" : "s"}`}
        >
          {s.closeRate !== null && <Meter value={s.closeRate} label={`${plural(s.lost.count, "rechazada", "rechazadas")} · ${money(s.lost.amount)}`} />}
        </Kpi>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Desglose por estado */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Por estado</CardTitle>
            <CardDescription>{RANGES[range]} · según la fecha de emisión</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {PIPELINE_ORDER.map((st) => {
                const b = s.byStatus[st];
                const filter = st === "vencida" ? "enviada" : st;
                return (
                  <li key={st}>
                    <Link
                      href={`/cotizaciones?estado=${filter}`}
                      className="group block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      aria-label={`${STATUS_LABELS[st]}: ${plural(b.count, "cotización", "cotizaciones")}, ${money(b.amount)}. Ver en el listado`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-sm">
                        <StatusBadge status={st} />
                        <span className="text-xs text-muted-foreground tabular-nums">{b.count}</span>
                        <span className="ml-auto font-semibold tabular-nums">{money(b.amount)}</span>
                        <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary">
                        <div
                          className={cn("h-full rounded-full", st === "rechazada" ? OPEN_BAR : WON_BAR)}
                          style={{ width: b.amount ? `max(4px, ${(b.amount / maxStatus) * 100}%)` : 0 }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Tendencia */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Últimos 6 meses</CardTitle>
            <CardDescription>Aceptado y en curso por mes de emisión (sin rechazadas)</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyChart points={monthlyPipeline(all, today)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, accent, children }: { label: string; value: string; hint: string; accent?: boolean; children?: React.ReactNode }) {
  return (
    <Card className={cn("gap-1 py-4", accent && "border-brand/50 bg-brand-soft/40")}>
      <CardContent className="px-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        {children}
      </CardContent>
    </Card>
  );
}

/** Proporción 0–1 sobre una pista del mismo tono. */
function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="mt-3">
      <div className="h-1.5 rounded-full bg-[#0891b2]/20" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
        <div className={cn("h-full rounded-full", WON_BAR)} style={{ width: `${Math.min(1, value) * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function MonthlyChart({ points }: { points: MonthPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.won + p.open));
  const label = (p: MonthPoint) => monthFmt.format(fromISODate(`${p.month}-01`)).replace(".", "");
  return (
    <figure>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", WON_BAR)} aria-hidden /> Aceptado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", OPEN_BAR)} aria-hidden /> En curso
        </span>
        <span className="ml-auto tabular-nums">Máx. {money(max === 1 ? 0 : max)}</span>
      </div>
      <div className="flex h-48 items-end gap-2 border-b sm:gap-4" aria-hidden>
        {points.map((p) => {
          const total = p.won + p.open;
          return (
            <Tooltip key={p.month}>
              <TooltipTrigger asChild>
                {/* Zona de hover de toda la columna, más grande que la barra */}
                <div className="flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-md hover:bg-secondary/60">
                  <div className="mx-auto flex w-full max-w-12 flex-col justify-end gap-0.5" style={{ height: `${(total / max) * 100}%` }}>
                    {p.open > 0 && <div className={cn("rounded-t-sm", OPEN_BAR, !p.won && "rounded-b-none")} style={{ flexGrow: p.open, minHeight: 3 }} />}
                    {p.won > 0 && <div className={cn(WON_BAR, !p.open && "rounded-t-sm")} style={{ flexGrow: p.won, minHeight: 3 }} />}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <p className="font-semibold capitalize">{monthLongFmt.format(fromISODate(`${p.month}-01`))}</p>
                <p className="tabular-nums">Aceptado: {money(p.won)}</p>
                <p className="tabular-nums">En curso: {money(p.open)}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2 sm:gap-4" aria-hidden>
        {points.map((p) => (
          <span key={p.month} className="flex-1 text-center text-xs text-muted-foreground capitalize">
            {label(p)}
          </span>
        ))}
      </div>
      {/* Versión en tabla para lectores de pantalla */}
      <table className="sr-only">
        <caption>Aceptado y en curso por mes de emisión</caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            <th scope="col">Aceptado</th>
            <th scope="col">En curso</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <th scope="row">{monthLongFmt.format(fromISODate(`${p.month}-01`))}</th>
              <td>{money(p.won)}</td>
              <td>{money(p.open)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Cargando panel">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl lg:col-span-3" />
      </div>
    </div>
  );
}
