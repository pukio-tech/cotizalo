"use server";

import { Prisma } from "@prisma/client";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer, requireOrgId, UnauthorizedError } from "@/lib/session";
import { toISODate } from "../domain/dates";
import { quoteInputSchema, STATUSES, type Quote } from "../domain/schema";
import { canAccept } from "../domain/status";
import * as repo from "./repository";

// Las Server Actions son endpoints públicos: todo lo que llega se valida aquí y la empresa
// sale siempre de la sesión (requireOrgId), nunca de lo que envía el cliente.

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const idSchema = z.string().min(1).max(64);

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof UnauthorizedError || error instanceof repo.NotFoundError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Datos inválidos" };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { ok: false, error: "Ya existe una cotización con ese código" };
    if (error.code === "P2025") return { ok: false, error: "La cotización ya no existe" };
  }
  console.error(error);
  return { ok: false, error: "No se pudo completar la operación" };
}

export async function saveQuotation(id: string | null, input: unknown): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const orgId = await requireOrgId();
    const data = quoteInputSchema.parse(input);
    const saved = id ? await repo.updateQuotation(orgId, idSchema.parse(id), data) : await repo.createQuotation(orgId, data);
    revalidatePath("/cotizaciones");
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e);
  }
}

/** Crea una copia con el siguiente correlativo. Si se pasa `input`, se copia eso (cambios sin guardar del editor). */
export async function duplicateQuotation(sourceId: string | null, input?: unknown): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const orgId = await requireOrgId();
    const source = input !== undefined ? quoteInputSchema.parse(input) : await repo.getQuotation(orgId, idSchema.parse(sourceId));
    if (!source) return { ok: false, error: "La cotización ya no existe" };
    // La copia empieza como borrador de hoy y sin enlace público
    const created = await repo.createQuotation(
      orgId,
      { ...source, status: "borrador", issuedAt: toISODate(new Date()), client: source.client ? `${source.client} (Copia)` : "Copia" },
      { assignCode: true }
    );
    revalidatePath("/cotizaciones");
    return { ok: true, data: created };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteQuotation(id: string): Promise<ActionResult> {
  try {
    await repo.deleteQuotation(await requireOrgId(), idSchema.parse(id));
    revalidatePath("/cotizaciones");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function updateStatus(id: string, status: unknown): Promise<ActionResult> {
  try {
    await repo.setStatus(await requireOrgId(), idSchema.parse(id), z.enum(STATUSES).parse(status));
    // Se usa desde el listado, el tablero y el panel: refresca la vista en la que esté el usuario
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Para generar el PDF desde el listado sin cargar todas las cotizaciones completas. */
export async function loadQuotation(id: string): Promise<ActionResult<{ quote: Quote; logo: string | null }>> {
  try {
    const viewer = await getViewer();
    if (!viewer) throw new UnauthorizedError();
    const q = await repo.getQuotation(viewer.organization.id, idSchema.parse(id));
    return q ? { ok: true, data: { quote: q, logo: viewer.organization.logo } } : { ok: false, error: "La cotización ya no existe" };
  } catch (e) {
    return fail(e);
  }
}

/** Crea (o recupera) el enlace público. Si estaba en borrador, pasa a "enviada". */
export async function shareQuotation(id: string): Promise<ActionResult<{ token: string }>> {
  try {
    const token = await repo.shareQuotation(await requireOrgId(), idSchema.parse(id));
    revalidatePath("/cotizaciones");
    return { ok: true, data: { token } };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeShare(id: string): Promise<ActionResult> {
  try {
    await repo.revokeShare(await requireOrgId(), idSchema.parse(id));
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// ─── Acción pública (sin sesión): el cliente acepta desde el enlace ────────────

const acceptSchema = z.object({
  token: z.string().min(10).max(64),
  name: z.string().trim().min(2, "Escribe tu nombre para aceptar").max(120),
});

export async function acceptQuotation(input: unknown): Promise<ActionResult> {
  try {
    const { token, name } = acceptSchema.parse(input);
    const found = await repo.getPublicQuotation(token);
    if (!found) return { ok: false, error: "El enlace ya no es válido" };
    if (!canAccept(found.quote, toISODate(new Date()))) return { ok: false, error: "Esta cotización ya no se puede aceptar" };
    if (!(await repo.acceptPublicQuotation(token, name))) return { ok: false, error: "Esta cotización ya no se puede aceptar" };
    revalidatePath(`/p/${token}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
