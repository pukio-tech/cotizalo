"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RANGES, SORTS } from "../../domain/list-params";
import { STATUSES, type Status } from "../../domain/schema";
import { STATUS_LABELS } from "../../domain/status";

/** Orden y rango de fechas del listado; viven en la URL (?orden=&fecha=) para poder compartirla. */
export function QuotationsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`));
  };

  const status = params.get("estado");
  const range = (params.get("fecha") ?? "todo") as keyof typeof RANGES;
  const sort = (params.get("orden") ?? "recientes") as keyof typeof SORTS;

  // Las etiquetas van explícitas en SelectValue para que se vean desde el primer render
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={status ?? "todos"} onValueChange={(v) => setParam("estado", v, "todos")}>
        <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filtrar por estado">
          <SelectValue>{(status && STATUS_LABELS[status as Status]) || "Todos los estados"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={range} onValueChange={(v) => setParam("fecha", v, "todo")}>
        <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filtrar por fecha de emisión">
          <SelectValue>{RANGES[range] ?? RANGES.todo}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(RANGES).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={(v) => setParam("orden", v, "recientes")}>
        <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Ordenar por">
          <SelectValue>{SORTS[sort] ?? SORTS.recientes}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SORTS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
