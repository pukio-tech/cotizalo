"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { arrayMove, SortableList, useStableIds } from "@/components/sortable-list";

/** Lista editable de textos (Incluye / Condiciones): edición en línea, reordenar, quitar y agregar. */
export function TextListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const { ids, setIds } = useStableIds(items.length);
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-muted-foreground">Sin puntos: esta sección no aparecerá en el PDF.</p>}
      <SortableList
        items={items}
        ids={ids}
        label={label}
        itemLabel={(t, i) => t.trim() || `punto ${i + 1}`}
        onReorder={(from, to) => {
          setIds(arrayMove(ids, from, to));
          onChange(arrayMove(items, from, to));
        }}
        renderItem={(text, i, handle) => (
          <div className="flex items-center gap-1">
            {handle}
            <Input
              value={text}
              aria-label={`${label}, punto ${i + 1}`}
              onChange={(e) => onChange(items.map((t, j) => (j === i ? e.target.value : t)))}
              maxLength={1000}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Quitar punto ${i + 1}`}
              onClick={() => {
                setIds(ids.filter((_, j) => j !== i));
                onChange(items.filter((_, j) => j !== i));
              }}
            >
              <X />
            </Button>
          </div>
        )}
      />
      <form
        className="flex gap-2 pl-9"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label={`Nuevo punto de ${label}`} maxLength={1000} />
        <Button type="submit" variant="outline" disabled={!draft.trim()}>
          <Plus /> Agregar
        </Button>
      </form>
    </div>
  );
}
