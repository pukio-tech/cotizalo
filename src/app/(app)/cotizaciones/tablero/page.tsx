import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireViewer } from "@/lib/session";
import { toISODate } from "@/features/quotations/domain/dates";
import { STATUSES } from "@/features/quotations/domain/schema";
import { QuotationsBoard } from "@/features/quotations/components/board/quotations-board";
import { ViewSwitch } from "@/features/quotations/components/view-switch";
import { listAllQuotations } from "@/features/quotations/server/repository";

export const metadata: Metadata = { title: "Tablero" };

async function Board() {
  await connection();
  const { organization } = await requireViewer();
  const rows = await listAllQuotations(organization.id);
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <FileText className="size-10 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-semibold">Aún no hay cotizaciones</p>
          <p className="text-sm text-muted-foreground">Crea la primera y aparecerá en la columna Borrador.</p>
        </div>
        <Button asChild>
          <Link href="/cotizaciones/nueva">Crear cotización</Link>
        </Button>
      </div>
    );
  }
  return <QuotationsBoard rows={rows} today={toISODate(new Date())} />;
}

function BoardSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5" aria-label="Cargando tablero">
      {STATUSES.map((s) => (
        <Skeleton key={s} className="h-64 w-full rounded-xl" />
      ))}
    </div>
  );
}

export default function BoardPage() {
  return (
    <>
      <header className="mb-4 flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Tablero</h1>
          <p className="text-sm text-muted-foreground">Arrastra cada cotización a su estado o cámbialo desde su distintivo</p>
        </div>
        <div className="flex gap-2">
          <ViewSwitch current="tablero" />
          <Button asChild className="h-9">
            <Link href="/cotizaciones/nueva">
              <Plus /> Crear
            </Link>
          </Button>
        </div>
      </header>
      <Suspense fallback={<BoardSkeleton />}>
        <Board />
      </Suspense>
    </>
  );
}
