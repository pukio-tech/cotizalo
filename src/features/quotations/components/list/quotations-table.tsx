import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "../../domain/format";
import type { ListParams } from "../../domain/list-params";
import { listQuotations } from "../../server/repository";
import { RowActions } from "./row-actions";

const dateFmt = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" });

export async function QuotationsTable({ params }: { params: ListParams }) {
  await connection();
  const { query, page, sort, range } = params;
  const { rows, total, pageCount } = await listQuotations(params);
  const filtered = !!query || range !== "todo";

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <FileText className="size-10 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-semibold">{filtered ? "Sin resultados" : "Aún no hay cotizaciones"}</p>
          <p className="text-sm text-muted-foreground">
            {query ? `Nada coincide con «${query}».` : filtered ? "No hay cotizaciones en ese rango de fechas." : "Crea la primera y aparecerá aquí."}
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
      ...(p > 1 && { page: String(p) }),
    })}`;

  return (
    <div className="space-y-4">
      {/* Escritorio: tabla */}
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Plan propuesto</TableHead>
              <TableHead className="text-center">Validez</TableHead>
              <TableHead className="text-right">Total primer año</TableHead>
              <TableHead className="text-right">Actualizado</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-bold">
                  <Link href={`/cotizaciones/${r.id}`} className="hover:underline">
                    {r.code}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{r.client || <span className="text-muted-foreground italic">Sin cliente</span>}</TableCell>
                <TableCell className="text-muted-foreground">{r.plan || "-"}</TableCell>
                <TableCell className="text-center text-muted-foreground">{r.days} días</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{money(r.firstYear)}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">{dateFmt.format(new Date(r.updatedAt))}</TableCell>
                <TableCell>
                  <RowActions id={r.id} code={r.code} client={r.client} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Móvil: tarjetas */}
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border p-3">
            <Link href={`/cotizaciones/${r.id}`} className="block">
              <p className="font-mono text-sm font-bold">{r.code}</p>
              <p className="font-medium">{r.client || "Sin cliente"}</p>
              <p className="text-sm text-muted-foreground">
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
