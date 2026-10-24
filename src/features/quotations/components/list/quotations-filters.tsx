"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RANGES, SORTS } from "../../domain/list-params";
import { STATUSES } from "../../domain/schema";
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

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={params.get("estado") ?? "todos"} onValueChange={(v) => setParam("estado", v, "todos")}>
        <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Filtrar por estado">
          <SelectValue />
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
      <Select value={params.get("fecha") ?? "todo"} onValueChange={(v) => setParam("fecha", v, "todo")}>
        <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filtrar por fecha de emisión">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(RANGES).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("orden") ?? "recientes"} onValueChange={(v) => setParam("orden", v, "recientes")}>
        <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Ordenar por">
          <SelectValue />
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
