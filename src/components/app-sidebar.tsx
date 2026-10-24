import { Suspense } from "react";
import { connection } from "next/server";
import { FilePlus2, Files } from "lucide-react";
import { countQuotations } from "@/features/quotations/server/repository";
import { NavLink } from "./nav-link";

async function QuotationCount() {
  await connection();
  const count = await countQuotations();
  return <>{count}</>;
}

export function AppSidebar() {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-sidebar-border bg-sidebar p-4 md:sticky md:top-0 md:h-dvh md:w-64 md:border-r md:border-b-0 md:p-5">
      <div className="mb-4 flex items-center gap-3 px-2 py-1 md:mb-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-xl font-extrabold text-brand shadow-sm" aria-hidden>
          C
        </div>
        <div>
          <p className="text-base leading-tight font-extrabold tracking-tight">Cotízalo</p>
          <p className="text-xs font-medium text-muted-foreground">by PUKIO</p>
        </div>
      </div>

      <p className="mx-2.5 mb-1.5 hidden text-[11px] font-bold tracking-wider text-muted-foreground uppercase md:block">Operación</p>
      <nav aria-label="Principal" className="flex gap-1.5 md:flex-col">
        <NavLink href="/cotizaciones/nueva" icon={<FilePlus2 />}>
          Nueva cotización
        </NavLink>
        <NavLink
          href="/cotizaciones"
          exact
          icon={<Files />}
          badge={
            <Suspense fallback="–">
              <QuotationCount />
            </Suspense>
          }
        >
          Cotizaciones
        </NavLink>
      </nav>

      <div className="mt-auto hidden items-center gap-2.5 border-t border-sidebar-border px-1 pt-4 md:flex">
        <div className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand-foreground">CZ</div>
        <div>
          <p className="text-xs leading-tight font-bold">Cotízalo Pro</p>
          <p className="text-[11px] font-medium text-muted-foreground">PUKIO</p>
        </div>
      </div>
    </aside>
  );
}
