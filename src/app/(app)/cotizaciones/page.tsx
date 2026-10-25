import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseListParams } from "@/features/quotations/domain/list-params";
import { QuotationsFilters } from "@/features/quotations/components/list/quotations-filters";
import { QuotationsSearch } from "@/features/quotations/components/list/quotations-search";
import { QuotationsTable, QuotationsTableSkeleton } from "@/features/quotations/components/list/quotations-table";
import { ViewSwitch } from "@/features/quotations/components/view-switch";

export const metadata: Metadata = { title: "Cotizaciones" };

async function Results({ searchParams }: { searchParams: PageProps<"/cotizaciones">["searchParams"] }) {
  return <QuotationsTable params={parseListParams(await searchParams)} />;
}

export default function QuotationsPage({ searchParams }: PageProps<"/cotizaciones">) {
  return (
    <>
      <header className="mb-4 flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">Historial de cotizaciones guardadas</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Suspense>
            <QuotationsSearch />
          </Suspense>
          <Button asChild className="h-9">
            <Link href="/cotizaciones/nueva">
              <Plus /> Crear
            </Link>
          </Button>
        </div>
      </header>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <ViewSwitch current="lista" />
        <Suspense>
          <QuotationsFilters />
        </Suspense>
      </div>
      <Suspense fallback={<QuotationsTableSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  );
}
