"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Búsqueda en el servidor: actualiza ?q= (con pausa al escribir) y vuelve a la página 1. */
export function QuotationsSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("q") ?? "";
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (value.trim() === current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      next.delete("page");
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`));
    }, 300);
    return () => clearTimeout(t);
  }, [value, current, params, pathname, router]);

  return (
    <div className="relative w-full sm:w-80">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar cliente, código o plan…"
        aria-label="Buscar cotizaciones"
        className="h-9 pl-8"
      />
      {pending && <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
    </div>
  );
}
