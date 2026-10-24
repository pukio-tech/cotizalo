"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { quoteInputSchema, type Quote } from "../domain/schema";
import * as repo from "./repository";

// Las Server Actions son endpoints públicos: todo lo que llega se valida aquí.
// Fase 4: verificar sesión y pertenencia antes de cada operación.

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const idSchema = z.string().min(1).max(64);

function fail(error: unknown): { ok: false; error: string } {
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
    const data = quoteInputSchema.parse(input);
    const saved = id ? await repo.updateQuotation(idSchema.parse(id), data) : await repo.createQuotation(data);
    revalidatePath("/cotizaciones");
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e);
  }
}

/** Crea una copia con el siguiente correlativo. Si se pasa `input`, se copia eso (cambios sin guardar del editor). */
export async function duplicateQuotation(sourceId: string | null, input?: unknown): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const source = input !== undefined ? quoteInputSchema.parse(input) : await repo.getQuotation(idSchema.parse(sourceId));
    if (!source) return { ok: false, error: "La cotización ya no existe" };
    const code = await repo.nextCode(new Date().getFullYear());
    const created = await repo.createQuotation({ ...source, code, client: source.client ? `${source.client} (Copia)` : "Copia" });
    revalidatePath("/cotizaciones");
    return { ok: true, data: created };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteQuotation(id: string): Promise<ActionResult> {
  try {
    await repo.deleteQuotation(idSchema.parse(id));
    revalidatePath("/cotizaciones");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Para generar el PDF desde el listado sin cargar todas las cotizaciones completas. */
export async function loadQuotation(id: string): Promise<ActionResult<Quote>> {
  try {
    const q = await repo.getQuotation(idSchema.parse(id));
    return q ? { ok: true, data: q } : { ok: false, error: "La cotización ya no existe" };
  } catch (e) {
    return fail(e);
  }
}
