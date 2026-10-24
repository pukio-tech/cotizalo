"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Lista editable de textos (Incluye / Condiciones): edición en línea, quitar y agregar. */
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
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-muted-foreground">Sin puntos: esta sección no aparecerá en el PDF.</p>}
      <ul className="space-y-2">
        {items.map((text, i) => (
          <li key={i} className="flex gap-2">
            <Input
              value={text}
              aria-label={`${label} ${i + 1}`}
              onChange={(e) => onChange(items.map((t, j) => (j === i ? e.target.value : t)))}
              maxLength={1000}
            />
            <Button variant="ghost" size="icon" aria-label={`Quitar punto ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
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
