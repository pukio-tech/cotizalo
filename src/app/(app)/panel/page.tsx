import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SquareKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseListParams } from "@/features/quotations/domain/list-params";
import { Dashboard, DashboardSkeleton } from "@/features/quotations/components/dashboard/dashboard";
import { PeriodSelect } from "@/features/quotations/components/dashboard/period-select";

export const metadata: Metadata = { title: "Panel" };

async function Content({ searchParams }: { searchParams: PageProps<"/panel">["searchParams"] }) {
  return <Dashboard range={parseListParams(await searchParams).range} />;
}

export default function PanelPage({ searchParams }: PageProps<"/panel">) {
  return (
    <>
      <header className="mb-4 flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Panel</h1>
          <p className="text-sm text-muted-foreground">Lo aceptado y lo pronosticado de tus cotizaciones</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Suspense>
            <PeriodSelect />
          </Suspense>
          <Button asChild variant="outline" className="h-9">
            <Link href="/cotizaciones/tablero">
              <SquareKanban /> Tablero
            </Link>
          </Button>
        </div>
      </header>
      <Suspense fallback={<DashboardSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
