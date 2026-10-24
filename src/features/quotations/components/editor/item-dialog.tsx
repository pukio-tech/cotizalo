"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Period, RecurringItem } from "../../domain/schema";
import { Field, NumberInput } from "./fields";

export type ItemDraft = RecurringItem;

export const blankItem = (): ItemDraft => ({ desc: "", detail: "", per: "mensual", cant: 1, cost: 0 });

/** Alta/edición de un servicio. `withPeriod` muestra la periodicidad (renovables). */
export function ItemDialog({
  item,
  isNew,
  withPeriod,
  onSave,
  onDelete,
  onClose,
}: {
  item: ItemDraft;
  isNew: boolean;
  withPeriod: boolean;
  onSave: (item: ItemDraft) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(item);
  const set = (patch: Partial<ItemDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const valid = draft.desc.trim().length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSave({ ...draft, desc: draft.desc.trim(), detail: draft.detail.trim(), cant: Math.max(1, Math.round(draft.cant)) });
          }}
        >
          <DialogHeader>
            <DialogTitle>{isNew ? "Agregar servicio" : "Editar servicio"}</DialogTitle>
          </DialogHeader>
          <Field id="it-desc" label="Servicio">
            <Input id="it-desc" value={draft.desc} onChange={(e) => set({ desc: e.target.value })} autoFocus required maxLength={200} />
          </Field>
          <Field id="it-detail" label="Detalle que verá el cliente">
            <Textarea id="it-detail" rows={3} value={draft.detail} onChange={(e) => set({ detail: e.target.value })} maxLength={2000} />
          </Field>
          <div className={withPeriod ? "grid gap-4 sm:grid-cols-3" : "grid gap-4 sm:grid-cols-2"}>
            {withPeriod && (
              <Field id="it-per" label="Se renueva">
                <Select value={draft.per} onValueChange={(v) => set({ per: v as Period })}>
                  <SelectTrigger id="it-per" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Cada mes</SelectItem>
                    <SelectItem value="anual">Cada año</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field id="it-cant" label="Cantidad">
              <NumberInput id="it-cant" value={draft.cant} onChange={(n) => set({ cant: n })} min={1} step={1} />
            </Field>
            <Field id="it-cost" label="Costo base (S/)" hint="Con 0 se muestra «Incluido».">
              <NumberInput id="it-cost" value={draft.cost} onChange={(n) => set({ cost: Math.max(0, n) })} min={0} />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            {!isNew && (
              <Button type="button" variant="destructive" className="sm:mr-auto" onClick={onDelete}>
                <Trash2 /> Eliminar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
