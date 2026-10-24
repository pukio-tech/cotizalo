"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getCatalog } from "@/features/organization/actions";
import type { CatalogEntry } from "@/features/organization/server";
import { unitPrice } from "../../domain/calc";
import { money } from "../../domain/format";
import type { RecurringItem } from "../../domain/schema";

/** Agrega servicios del catálogo de la empresa (se cargan al abrir). */
export function CatalogPicker({ type, margin, onPick }: { type: CatalogEntry["type"]; margin: number; onPick: (item: RecurringItem) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CatalogEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, startTransition] = useTransition();

  const load = () => {
    setOpen(true);
    startTransition(async () => {
      const r = await getCatalog();
      if (r.ok) setItems(r.data);
      else toast.error(r.error);
    });
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => i.type === type && (!q || i.desc.toLowerCase().includes(q) || i.detail.toLowerCase().includes(q)));
  }, [items, type, query]);

  return (
    <>
      <Button variant="outline" className="h-10 w-full" onClick={load}>
        <BookOpen /> Agregar desde el catálogo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Catálogo de servicios</DialogTitle>
            <DialogDescription>Elige un servicio para agregarlo con su precio base.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar servicio…" aria-label="Buscar en el catálogo" className="pl-8" />
          </div>
          {loading && !items ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando catálogo…
            </p>
          ) : visible.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <p>{items?.some((i) => i.type === type) ? "Ningún servicio coincide." : "Aún no hay servicios de este tipo en el catálogo."}</p>
              <Link href="/ajustes#catalogo" className="mt-1 inline-block font-semibold text-foreground underline underline-offset-2">
                Administrar catálogo
              </Link>
            </div>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto" aria-label="Servicios del catálogo">
              {visible.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick({ desc: i.desc, detail: i.detail, per: i.per ?? "mensual", cant: 1, cost: i.cost });
                      toast.success(`«${i.desc}» agregado`);
                    }}
                    className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{i.desc}</span>
                      {i.detail && <span className="line-clamp-1 block text-xs text-muted-foreground">{i.detail}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums">
                      {i.cost ? money(unitPrice(i, margin)) : "Incluido"}
                      {i.per && <span className="text-xs font-normal text-muted-foreground">/{i.per === "anual" ? "año" : "mes"}</span>}
                      <Plus className="size-4 text-muted-foreground" aria-hidden />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
