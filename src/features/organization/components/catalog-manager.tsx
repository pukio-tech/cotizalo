"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/features/quotations/domain/format";
import { deleteCatalogItem, saveCatalogItem } from "../actions";
import type { CatalogEntry } from "../server";

type Draft = Omit<CatalogEntry, "id"> & { id: string | null };

const KIND_LABEL = { initial: "Pago inicial", recurring: "Renovable" } as const;

/** Catálogo de servicios reutilizables de la empresa (precio base, sin margen). */
export function CatalogManager({ initial }: { initial: CatalogEntry[] }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      if (!draft) return;
      const { id, ...data } = draft;
      const r = await saveCatalogItem(id, data);
      if (!r.ok) return void toast.error(r.error);
      setItems((list) => (id ? list.map((i) => (i.id === id ? r.data : i)) : [...list, r.data]));
      setDraft(null);
      toast.success("Servicio guardado en el catálogo");
    });

  const remove = (item: CatalogEntry) =>
    startTransition(async () => {
      const r = await deleteCatalogItem(item.id);
      if (!r.ok) return void toast.error(r.error);
      setItems((list) => list.filter((i) => i.id !== item.id));
      toast.success(`«${item.desc}» eliminado del catálogo`);
    });

  return (
    <Card id="catalogo">
      <CardHeader>
        <CardTitle>Catálogo de servicios</CardTitle>
        <CardDescription>Servicios que cotizas seguido. En el editor los agregas con un clic; el margen se aplica en cada cotización.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Aún no hay servicios en el catálogo.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{i.desc}</p>
                  <p className="text-xs text-muted-foreground">
                    {KIND_LABEL[i.type]}
                    {i.per && ` · ${i.per === "anual" ? "anual" : "mensual"}`} · costo base {i.cost ? money(Math.round(i.cost * 100)) : "incluido"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Editar ${i.desc}`} onClick={() => setDraft({ ...i })}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${i.desc}`} onClick={() => remove(i)} disabled={pending}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" onClick={() => setDraft({ id: null, type: "initial", desc: "", detail: "", per: null, cost: 0 })}>
          <Plus /> Agregar servicio
        </Button>
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          {draft && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <DialogHeader>
                <DialogTitle>{draft.id ? "Editar servicio" : "Nuevo servicio del catálogo"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-1.5">
                <Label htmlFor="cat-desc">Servicio</Label>
                <Input id="cat-desc" value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} required maxLength={200} autoFocus />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cat-detail">Detalle que verá el cliente</Label>
                <Textarea id="cat-detail" rows={2} value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} maxLength={2000} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cat-type">Tipo</Label>
                  <Select
                    value={draft.type === "recurring" ? draft.per ?? "mensual" : "initial"}
                    onValueChange={(v) => setDraft({ ...draft, type: v === "initial" ? "initial" : "recurring", per: v === "initial" ? null : (v as "mensual" | "anual") })}
                  >
                    <SelectTrigger id="cat-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initial">Pago inicial</SelectItem>
                      <SelectItem value="mensual">Renovable mensual</SelectItem>
                      <SelectItem value="anual">Renovable anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="cat-cost">Costo base (S/)</Label>
                  <Input
                    id="cat-cost"
                    type="number"
                    min={0}
                    step="any"
                    value={draft.cost}
                    onChange={(e) => setDraft({ ...draft, cost: Math.max(0, parseFloat(e.target.value) || 0) })}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending || !draft.desc.trim()}>
                  {pending && <Loader2 className="animate-spin" />} Guardar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
