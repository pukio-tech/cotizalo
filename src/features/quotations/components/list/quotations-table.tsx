import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toISODate } from "../../domain/dates";
import { money } from "../../domain/format";
import { QuotationStatus } from "../status-menu";
import type { ListParams } from "../../domain/list-params";
import { requireViewer } from "@/lib/session";
import { listQuotations } from "../../server/repository";
import { RowActions } from "./row-actions";

const dateFmt = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" });

export async function QuotationsTable({ params }: { params: ListParams }) {
  await connection();
  const { organization } = await requireViewer();
  const { query, page, sort, range, status } = params;
  const { rows, total, pageCount } = await listQuotations(organization.id, params);
  const filtered = !!query || range !== "todo" || !!status;
  const today = toISODate(new Date());

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <FileText className="size-10 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-semibold">{filtered ? "Sin resultados" : "Aún no hay cotizaciones"}</p>
          <p className="text-sm text-muted-foreground">
            {query ? `Nada coincide con «${query}».` : filtered ? "No hay cotizaciones con esos filtros." : "Crea la primera y aparecerá aquí."}
          </p>
        </div>
        {!filtered && (
          <Button asChild>
            <Link href="/cotizaciones/nueva">Crear cotización</Link>
          </Button>
        )}
      </div>
    );
  }

  const pageHref = (p: number) =>
    `/cotizaciones?${new URLSearchParams({
      ...(query && { q: query }),
      ...(sort !== "recientes" && { orden: sort }),
      ...(range !== "todo" && { fecha: range }),
      ...(status && { estado: status }),
      ...(p > 1 && { page: String(p) }),
    })}`;

  return (
    <div className="space-y-4">
      {/* Escritorio: tabla de ancho fijo (table-fixed): los textos largos se recortan y las columnas
          secundarias se ocultan en pantallas más angostas, así nunca aparece scroll horizontal */}
      <div className="hidden overflow-hidden rounded-xl border lg:block">
        <Table className="table-fixed">
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-32 pl-4">Código</TableHead>
              <TableHead>Cliente y plan</TableHead>
              <TableHead className="w-36">Estado</TableHead>
              <TableHead className="w-32 text-right">Total primer año</TableHead>
              <TableHead className="hidden w-28 text-right xl:table-cell">Actualizado</TableHead>
              <TableHead className="hidden w-20 text-center 2xl:table-cell">Validez</TableHead>
              <TableHead className="w-28">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-4 font-mono font-bold">
                  <Link href={`/cotizaciones/${r.id}`} className="block truncate hover:underline" title={r.code}>
                    {r.code}
                  </Link>
                </TableCell>
                <TableCell>
                  <p className="truncate font-medium" title={r.client}>
                    {r.client || <span className="text-muted-foreground italic">Sin cliente</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={r.plan}>
                    {r.plan || "-"}
                  </p>
                </TableCell>
                <TableCell>
                  <QuotationStatus id={r.id} status={r.status} issuedAt={r.issuedAt} days={r.days} today={today} />
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{money(r.firstYear)}</TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums xl:table-cell">{dateFmt.format(new Date(r.updatedAt))}</TableCell>
                <TableCell className="hidden text-center text-muted-foreground 2xl:table-cell">{r.days} días</TableCell>
                <TableCell className="pr-3">
                  <RowActions id={r.id} code={r.code} client={r.client} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Móvil y tablet: tarjetas */}
      <ul className="space-y-2 lg:hidden">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/cotizaciones/${r.id}`} className="font-mono text-sm font-bold hover:underline">
                {r.code}
              </Link>
              <QuotationStatus id={r.id} status={r.status} issuedAt={r.issuedAt} days={r.days} today={today} />
            </div>
            <Link href={`/cotizaciones/${r.id}`} className="block min-w-0">
              <p className="truncate font-medium">{r.client || "Sin cliente"}</p>
              <p className="truncate text-sm text-muted-foreground">
                {r.plan || "-"} · {dateFmt.format(new Date(r.updatedAt))}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {money(r.firstYear)} <span className="font-normal text-muted-foreground">primer año</span>
              </p>
            </Link>
            <div className="mt-2 border-t pt-2">
              <RowActions id={r.id} code={r.code} client={r.client} />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} cotizacion{total === 1 ? "" : "es"}
        </span>
        {pageCount > 1 && (
          <nav aria-label="Paginación" className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" asChild={page > 1} disabled={page <= 1} aria-label="Página anterior">
              {page > 1 ? (
                <Link href={pageHref(page - 1)}>
                  <ChevronLeft />
                </Link>
              ) : (
                <ChevronLeft />
              )}
            </Button>
            <span className="tabular-nums">
              {page} / {pageCount}
            </span>
            <Button variant="outline" size="icon-sm" asChild={page < pageCount} disabled={page >= pageCount} aria-label="Página siguiente">
              {page < pageCount ? (
                <Link href={pageHref(page + 1)}>
                  <ChevronRight />
                </Link>
              ) : (
                <ChevronRight />
              )}
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}

export function QuotationsTableSkeleton() {
  return (
    <div className="space-y-2" aria-label="Cargando cotizaciones">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
