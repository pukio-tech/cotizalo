"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { unitPrice } from "../../domain/calc";
import { money } from "../../domain/format";
import type { QuoteItem, RecurringItem } from "../../domain/schema";
import { blankItem, ItemDialog, type ItemDraft } from "./item-dialog";

/** Lista de servicios (iniciales o renovables) con alta/edición en diálogo. */
export function ItemsEditor<T extends QuoteItem | RecurringItem>({
  items,
  margin,
  withPeriod,
  onChange,
}: {
  items: T[];
  margin: number;
  withPeriod: boolean;
  onChange: (items: T[]) => void;
}) {
  // índice en edición; -1 = nuevo
  const [editing, setEditing] = useState<number | null>(null);

  const toItem = (d: ItemDraft) => (withPeriod ? d : { desc: d.desc, detail: d.detail, cant: d.cant, cost: d.cost }) as T;

  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Aún no hay servicios agregados.</p>}
      <ul className="space-y-2">
        {items.map((it, i) => {
          const u = unitPrice(it, margin);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setEditing(i)}
                className="flex w-full justify-between gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="font-bold">{it.desc}</span>
                  {"per" in it && (
                    <Badge variant="outline" className="ml-2 align-middle">
                      {it.per === "anual" ? "Anual" : "Mensual"}
                    </Badge>
                  )}
                  {it.detail && <span className="mt-0.5 block text-xs whitespace-pre-line text-muted-foreground">{it.detail}</span>}
                </span>
                <span className="shrink-0 text-right font-semibold tabular-nums">
                  {u ? money(u * it.cant) : <span className="font-bold text-success">Incluido</span>}
                  {it.cant > 1 && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {it.cant} × {money(u)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" className="h-10 w-full" onClick={() => setEditing(-1)}>
        <Plus /> Agregar servicio
      </Button>

      {editing !== null && (
        <ItemDialog
          item={editing < 0 ? blankItem() : { ...blankItem(), ...items[editing] }}
          isNew={editing < 0}
          withPeriod={withPeriod}
          onClose={() => setEditing(null)}
          onSave={(d) => {
            onChange(editing < 0 ? [...items, toItem(d)] : items.map((it, i) => (i === editing ? toItem(d) : it)));
            setEditing(null);
          }}
          onDelete={() => {
            onChange(items.filter((_, i) => i !== editing));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
