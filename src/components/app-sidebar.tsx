import { Suspense } from "react";
import { connection } from "next/server";
import { FilePlus2, Files, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { countQuotations } from "@/features/quotations/server/repository";
import { getViewer } from "@/lib/session";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme";
import { UserMenu } from "./user-menu";

async function QuotationCount() {
  await connection();
  const viewer = await getViewer();
  return <>{viewer ? await countQuotations(viewer.organization.id) : "–"}</>;
}

async function SidebarUser() {
  await connection();
  const viewer = await getViewer();
  if (!viewer) return null;
  return <UserMenu name={viewer.name} email={viewer.email} organization={viewer.organization.name} />;
}

export function AppSidebar() {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-sidebar-border bg-sidebar p-4 md:sticky md:top-0 md:h-dvh md:w-64 md:border-r md:border-b-0 md:p-5">
      <div className="mb-4 flex items-center gap-3 px-2 py-1 md:mb-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-logo text-xl font-extrabold text-logo-foreground shadow-sm ring-1 ring-white/10" aria-hidden>
          C
        </div>
        <div>
          <p className="text-base leading-tight font-extrabold tracking-tight">Cotízalo</p>
          <p className="text-xs font-medium text-muted-foreground">by PUKIO</p>
        </div>
        <ThemeToggle className="ml-auto md:hidden" />
      </div>

      <p className="mx-2.5 mb-1.5 hidden text-[11px] font-bold tracking-wider text-muted-foreground uppercase md:block">Operación</p>
      <nav aria-label="Principal" className="flex flex-wrap gap-1.5 md:flex-col md:flex-nowrap">
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
        <NavLink href="/ajustes" icon={<Settings />}>
          Ajustes
        </NavLink>
      </nav>

      <div className="mt-4 flex flex-col gap-3 border-t border-sidebar-border px-1 pt-4 md:mt-auto">
        <ThemeToggle className="hidden self-start md:inline-flex" />
        <Suspense fallback={<Skeleton className="h-8 w-full" />}>
          <SidebarUser />
        </Suspense>
      </div>
    </aside>
  );
}
