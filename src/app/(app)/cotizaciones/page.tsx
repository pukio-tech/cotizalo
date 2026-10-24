import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotationsSearch } from "@/features/quotations/components/list/quotations-search";
import { QuotationsTable, QuotationsTableSkeleton } from "@/features/quotations/components/list/quotations-table";

export const metadata: Metadata = { title: "Cotizaciones" };

async function Results({ searchParams }: { searchParams: PageProps<"/cotizaciones">["searchParams"] }) {
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  return <QuotationsTable query={query} page={page} />;
}

export default function QuotationsPage({ searchParams }: PageProps<"/cotizaciones">) {
  return (
    <>
      <header className="mb-6 flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
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
      <Suspense fallback={<QuotationsTableSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  );
}
