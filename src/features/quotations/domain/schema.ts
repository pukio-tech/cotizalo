import { z } from "zod";

// Única fuente de verdad de la forma de una cotización: la usan el editor,
// las Server Actions (validación) y el generador de PDF.

export const PERIODS = ["mensual", "anual"] as const;
export type Period = (typeof PERIODS)[number];

/** Estados guardados. "vencida" no se guarda: se calcula (ver domain/status.ts). */
export const STATUSES = ["borrador", "enviada", "aceptada", "rechazada"] as const;
export type Status = (typeof STATUSES)[number];

export const itemSchema = z.object({
  desc: z.string().trim().max(200),
  detail: z.string().trim().max(2000),
  cant: z.coerce.number().int().min(1).max(100_000),
  cost: z.coerce.number().min(0).max(100_000_000),
});

export const recurringItemSchema = itemSchema.extend({
  per: z.enum(PERIODS),
});

export const headerSchema = z.object({
  on: z.boolean(),
  name: z.string().trim().max(200),
  l1: z.string().trim().max(200),
  l2: z.string().trim().max(200),
});

const textList = z
  .array(z.string().trim().max(1000))
  .max(100)
  .transform((list) => list.filter(Boolean));

export const quoteInputSchema = z.object({
  code: z.string().trim().min(1, "El código es obligatorio").max(40),
  status: z.enum(STATUSES),
  /** Fecha de emisión AAAA-MM-DD (hora de Lima); la validez se cuenta desde aquí */
  issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de emisión inválida"),
  client: z.string().trim().max(200),
  plan: z.string().trim().max(200),
  days: z.coerce.number().int().min(0).max(365),
  margin: z.coerce.number().min(-100).max(1000),
  igv: z.boolean(),
  months: z.coerce.number().int().min(0).max(12),
  hdr: headerSchema,
  initial: z.array(itemSchema).max(200),
  recurring: z.array(recurringItemSchema).max(200),
  incl: textList,
  cond: textList,
});

export type QuoteItem = z.infer<typeof itemSchema>;
export type RecurringItem = z.infer<typeof recurringItemSchema>;
export type QuoteHeader = z.infer<typeof headerSchema>;
export type QuoteInput = z.infer<typeof quoteInputSchema>;

/** Cotización tal como la maneja la UI: el input más datos de solo lectura del servidor. */
export type Quote = QuoteInput & {
  id: string | null;
  createdAt: string | null;
  /** Token del enlace público (null = no compartida) */
  publicToken?: string | null;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
};
