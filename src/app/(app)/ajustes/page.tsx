import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogManager } from "@/features/organization/components/catalog-manager";
import { OrganizationForm } from "@/features/organization/components/organization-form";
import { listCatalog } from "@/features/organization/server";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Ajustes" };

async function Settings() {
  await connection();
  const { organization } = await requireViewer();
  const catalog = await listCatalog(organization.id);
  return (
    <div className="grid max-w-3xl gap-6">
      <OrganizationForm initial={organization} />
      <CatalogManager initial={catalog} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <header className="mb-6 border-b pb-4">
        <h1 className="text-xl font-extrabold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Datos de tu empresa y catálogo de servicios</p>
      </header>
      <Suspense
        fallback={
          <div className="grid max-w-3xl gap-6">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        }
      >
        <Settings />
      </Suspense>
    </>
  );
}
