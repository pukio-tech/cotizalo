"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RANGES } from "../../domain/list-params";

/** Periodo del panel según la fecha de emisión (?fecha=), igual que en el listado. */
export function PeriodSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const range = (params.get("fecha") ?? "todo") as keyof typeof RANGES;

  const change = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "todo") next.delete("fecha");
    else next.set("fecha", value);
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`));
  };

  return (
    <Select value={range} onValueChange={change}>
      <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Periodo según la fecha de emisión">
        {/* Etiqueta explícita: así se ve desde el primer render, antes de que el menú se monte */}
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
  );
}
