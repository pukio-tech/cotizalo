"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import * as org from "./server";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof UnauthorizedError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Datos inválidos" };
  console.error(error);
  return { ok: false, error: error instanceof Error ? error.message : "No se pudo completar la operación" };
}

// Logo: PNG o JPEG en data URL, hasta ~200 KB (se guarda en la BD y se incrusta en el PDF)
const MAX_LOGO = 280_000;
const logoSchema = z
  .string()
  .max(MAX_LOGO, "El logo debe pesar menos de 200 KB")
  .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "El logo debe ser una imagen PNG o JPG");

const organizationSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de la empresa").max(120),
  headerLine1: z.string().trim().max(200),
  headerLine2: z.string().trim().max(200),
  /** undefined = no cambiar · null = quitar · string = nuevo logo */
  logo: logoSchema.nullable().optional(),
});

export async function saveOrganization(input: unknown): Promise<Result> {
  try {
    const orgId = await requireOrgId();
    await org.updateOrganization(orgId, organizationSchema.parse(input));
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

const catalogSchema = z.object({
  type: z.enum(["initial", "recurring"]),
  desc: z.string().trim().min(1, "Escribe el nombre del servicio").max(200),
  detail: z.string().trim().max(2000),
  per: z.enum(["mensual", "anual"]).nullable(),
  cost: z.coerce.number().min(0).max(100_000_000),
});

export async function getCatalog(): Promise<Result<org.CatalogEntry[]>> {
  try {
    return { ok: true, data: await org.listCatalog(await requireOrgId()) };
  } catch (e) {
    return fail(e);
  }
}

export async function saveCatalogItem(id: string | null, input: unknown): Promise<Result<org.CatalogEntry>> {
  try {
    const orgId = await requireOrgId();
    const saved = await org.saveCatalogItem(orgId, id ? z.string().max(64).parse(id) : null, catalogSchema.parse(input));
    revalidatePath("/ajustes");
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCatalogItem(id: string): Promise<Result> {
  try {
    await org.deleteCatalogItem(await requireOrgId(), z.string().max(64).parse(id));
    revalidatePath("/ajustes");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
