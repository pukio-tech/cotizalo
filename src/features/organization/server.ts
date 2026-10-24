import "server-only";
import { prisma } from "@/lib/prisma";

// Datos de la empresa y catálogo de servicios. Todas las funciones exigen la empresa (orgId).

export interface CatalogEntry {
  id: string;
  type: "initial" | "recurring";
  desc: string;
  detail: string;
  per: "mensual" | "anual" | null;
  cost: number;
}

const toEntry = (r: { id: string; type: string; desc: string; detail: string; per: string | null; cost: number }): CatalogEntry => ({
  id: r.id,
  type: r.type === "recurring" ? "recurring" : "initial",
  desc: r.desc,
  detail: r.detail,
  per: r.type === "recurring" ? (r.per === "anual" ? "anual" : "mensual") : null,
  cost: r.cost,
});

export async function listCatalog(orgId: string) {
  const rows = await prisma.catalogItem.findMany({ where: { organizationId: orgId }, orderBy: [{ type: "asc" }, { desc: "asc" }] });
  return rows.map(toEntry);
}

export async function saveCatalogItem(orgId: string, id: string | null, data: Omit<CatalogEntry, "id">) {
  const fields = { type: data.type, desc: data.desc, detail: data.detail, per: data.type === "recurring" ? data.per : null, cost: data.cost };
  if (!id) return toEntry(await prisma.catalogItem.create({ data: { ...fields, organizationId: orgId } }));
  const { count } = await prisma.catalogItem.updateMany({ where: { id, organizationId: orgId }, data: fields });
  if (!count) throw new Error("El servicio ya no existe");
  return { id, ...data };
}

export async function deleteCatalogItem(orgId: string, id: string) {
  await prisma.catalogItem.deleteMany({ where: { id, organizationId: orgId } });
}

export async function updateOrganization(orgId: string, data: { name: string; headerLine1: string; headerLine2: string; logo?: string | null }) {
  await prisma.organization.update({ where: { id: orgId }, data });
}
