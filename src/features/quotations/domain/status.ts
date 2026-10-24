import { expiryISODate } from "./dates";
import type { QuoteInput, Status } from "./schema";

export type EffectiveStatus = Status | "vencida";

export const STATUS_LABELS: Record<EffectiveStatus, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};

/** Clases del distintivo de cada estado (claro y oscuro, contraste AA). */
export const STATUS_STYLES: Record<EffectiveStatus, string> = {
  borrador: "bg-secondary text-muted-foreground",
  enviada: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  aceptada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rechazada: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  vencida: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
};

/**
 * Estado que se muestra: una cotización enviada cuya validez ya pasó se ve como "vencida".
 * `today` es "AAAA-MM-DD" (hora de Lima).
 */
export function effectiveStatus(q: Pick<QuoteInput, "status" | "issuedAt" | "days">, today: string): EffectiveStatus {
  if (q.status === "enviada" && expiryISODate(q.issuedAt, q.days) < today) return "vencida";
  return q.status;
}

/** El cliente puede aceptar mientras esté enviada y vigente. */
export const canAccept = (q: Pick<QuoteInput, "status" | "issuedAt" | "days">, today: string) => effectiveStatus(q, today) === "enviada";
