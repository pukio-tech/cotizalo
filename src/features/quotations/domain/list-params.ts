import { STATUSES, type Status } from "./schema";

// Parámetros del listado (?q=&page=&orden=&fecha=&estado=), compartidos por la página, los filtros y el repositorio.

export const SORTS = {
  recientes: "Más recientes",
  antiguas: "Más antiguas",
  codigo: "Código",
  cliente: "Cliente (A–Z)",
} as const;

export const RANGES = {
  todo: "Cualquier fecha",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  anio: "Este año",
} as const;

export type Sort = keyof typeof SORTS;
export type Range = keyof typeof RANGES;

export interface ListParams {
  query: string;
  page: number;
  sort: Sort;
  range: Range;
  /** Estado guardado; sin valor = todos */
  status?: Status;
}

const pick = <T extends string>(value: unknown, options: Record<T, string>, fallback: T): T =>
  typeof value === "string" && value in options ? (value as T) : fallback;

export function parseListParams(sp: Record<string, string | string[] | undefined>): ListParams {
  return {
    query: typeof sp.q === "string" ? sp.q.slice(0, 100) : "",
    page: Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1),
    sort: pick(sp.orden, SORTS, "recientes"),
    range: pick(sp.fecha, RANGES, "todo"),
    status: typeof sp.estado === "string" && (STATUSES as readonly string[]).includes(sp.estado) ? (sp.estado as Status) : undefined,
  };
}

/** Fecha desde la que filtrar según el rango (null = sin filtro). */
export function rangeStart(range: Range, now: Date): Date | null {
  if (range === "7d") return new Date(now.getTime() - 7 * 864e5);
  if (range === "30d") return new Date(now.getTime() - 30 * 864e5);
  if (range === "anio") return new Date(now.getFullYear(), 0, 1);
  return null;
}
