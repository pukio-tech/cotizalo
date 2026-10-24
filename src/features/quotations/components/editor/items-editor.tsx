"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { arrayMove, SortableList, useStableIds } from "@/components/sortable-list";
import { cn } from "@/lib/utils";
import { lineTotal, unitPrice } from "../../domain/calc";
import { money } from "../../domain/format";
import type { Period, QuoteItem, RecurringItem } from "../../domain/schema";
import { Field, NumberInput } from "./fields";

type AnyItem = QuoteItem | RecurringItem;

const blank = (withPeriod: boolean): AnyItem =>
  withPeriod ? { desc: "", detail: "", per: "mensual", cant: 1, cost: 0 } : { desc: "", detail: "", cant: 1, cost: 0 };

/**
 * Servicios (iniciales o renovables): cada tarjeta se expande para editar en línea
 * y se reordena con el asa (mouse, toque o teclado).
 */
export function ItemsEditor<T extends AnyItem>({
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
  const { ids, setIds } = useStableIds(items.length);
  const [open, setOpen] = useState<string | null>(null);

  const update = (i: number, patch: Partial<AnyItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => {
    setIds(ids.filter((_, j) => j !== i));
    onChange(items.filter((_, j) => j !== i));
    setOpen(null);
  };
  // Al cerrar, un servicio sin nombre se descarta (p. ej. uno recién agregado y abandonado)
  const close = (i: number) => (items[i]?.desc.trim() ? setOpen(null) : remove(i));
  const add = () => {
    const id = `new-${Date.now()}`;
    setIds([...ids, id]);
    onChange([...items, blank(withPeriod) as T]);
    setOpen(id);
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Aún no hay servicios agregados.</p>
      )}
      <SortableList
        items={items}
        ids={ids}
        label="Servicios"
        itemLabel={(it) => it.desc || "servicio sin nombre"}
        onDragStart={() => setOpen(null)}
        onReorder={(from, to) => {
          setIds(arrayMove(ids, from, to));
          onChange(arrayMove(items, from, to));
        }}
        renderItem={(it, i, handle) => {
          const id = ids[i];
          const isOpen = open === id;
          const u = unitPrice(it, margin);
          const panelId = `item-panel-${id}`;
          return (
            <div className={cn("rounded-xl border bg-card shadow-card transition-colors", isOpen && "border-brand")}>
              <div className="flex items-start gap-1 p-2 pr-3">
                {handle}
                <button
                  type="button"
                  onClick={() => (isOpen ? close(i) : setOpen(id))}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex min-w-0 flex-1 justify-between gap-3 rounded-md px-1 py-1.5 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className={cn("font-bold", !it.desc && "text-muted-foreground italic")}>{it.desc || "Servicio sin nombre"}</span>
                    {"per" in it && (
                      <Badge variant="outline" className="ml-2 align-middle">
                        {it.per === "anual" ? "Anual" : "Mensual"}
                      </Badge>
                    )}
                    {it.detail && !isOpen && <span className="mt-0.5 line-clamp-2 block text-xs whitespace-pre-line text-muted-foreground">{it.detail}</span>}
                  </span>
                  <span className="flex shrink-0 items-start gap-2">
                    <span className="text-right font-semibold tabular-nums">
                      {u ? money(lineTotal(it, margin)) : <span className="font-bold text-success">Incluido</span>}
                      {it.cant > 1 && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {it.cant} × {money(u)}
                        </span>
                      )}
                    </span>
                    <ChevronDown className={cn("mt-0.5 size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
                  </span>
                </button>
              </div>

              {isOpen && (
                <div id={panelId} className="grid gap-4 border-t px-4 pt-4 pb-4">
                  <Field id={`${id}-desc`} label="Servicio">
                    <Input
                      id={`${id}-desc`}
                      value={it.desc}
                      onChange={(e) => update(i, { desc: e.target.value })}
                      aria-invalid={!it.desc.trim() || undefined}
                      placeholder="Ej. Desarrollo web"
                      autoFocus
                      maxLength={200}
                    />
                  </Field>
                  <Field id={`${id}-detail`} label="Detalle que verá el cliente">
                    <Textarea id={`${id}-detail`} rows={2} value={it.detail} onChange={(e) => update(i, { detail: e.target.value })} maxLength={2000} />
                  </Field>
                  <div className={cn("grid gap-4", withPeriod ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                    {"per" in it && (
                      <Field id={`${id}-per`} label="Se renueva">
                        <Select value={it.per} onValueChange={(v) => update(i, { per: v as Period })}>
                          <SelectTrigger id={`${id}-per`} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mensual">Cada mes</SelectItem>
                            <SelectItem value="anual">Cada año</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                    <Field id={`${id}-cant`} label="Cantidad">
                      <NumberInput id={`${id}-cant`} value={it.cant} onChange={(n) => update(i, { cant: Math.max(1, Math.round(n)) })} min={1} step={1} />
                    </Field>
                    <Field id={`${id}-cost`} label="Costo base (S/)" hint="Con 0 se muestra «Incluido».">
                      <NumberInput id={`${id}-cost`} value={it.cost} onChange={(n) => update(i, { cost: Math.max(0, n) })} min={0} />
                    </Field>
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button type="button" variant="destructive" onClick={() => remove(i)}>
                      <Trash2 /> Eliminar
                    </Button>
                    <Button type="button" variant="outline" onClick={() => close(i)}>
                      <Check /> Listo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        }}
      />
      <Button variant="outline" className="h-10 w-full" onClick={add}>
        <Plus /> Agregar servicio
      </Button>
    </div>
  );
}
