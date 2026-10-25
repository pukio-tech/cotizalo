import { expiryISODate } from "./dates";
import type { QuoteInput, Status } from "./schema";

export type EffectiveStatus = Status | "vencida";

export const STATUS_LABELS: Record<EffectiveStatus, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  negociacion: "En negociación",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};

/** Clases del distintivo de cada estado (claro y oscuro, contraste AA). */
export const STATUS_STYLES: Record<EffectiveStatus, string> = {
  borrador: "bg-secondary text-muted-foreground",
  enviada: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  negociacion: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  aceptada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rechazada: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  vencida: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
};

/** Punto de color que identifica cada columna del tablero (siempre junto a su nombre). */
export const STATUS_DOTS: Record<Status, string> = {
  borrador: "bg-muted-foreground",
  enviada: "bg-sky-500",
  negociacion: "bg-violet-500",
  aceptada: "bg-emerald-500",
  rechazada: "bg-rose-500",
};

/**
 * Estado que se muestra: una cotización enviada cuya validez ya pasó se ve como "vencida".
 * En negociación no vence: la validez se está conversando con el cliente.
 * `today` es "AAAA-MM-DD" (hora de Lima).
 */
export function effectiveStatus(q: Pick<QuoteInput, "status" | "issuedAt" | "days">, today: string): EffectiveStatus {
  if (q.status === "enviada" && expiryISODate(q.issuedAt, q.days) < today) return "vencida";
  return q.status;
}

/** Estados guardados en los que el cliente puede aceptar desde el enlace. */
export const ACCEPTABLE_STATUSES: readonly Status[] = ["enviada", "negociacion"];

/** El cliente puede aceptar mientras esté enviada y vigente, o en negociación. */
export const canAccept = (q: Pick<QuoteInput, "status" | "issuedAt" | "days">, today: string) =>
  (ACCEPTABLE_STATUSES as readonly EffectiveStatus[]).includes(effectiveStatus(q, today));
