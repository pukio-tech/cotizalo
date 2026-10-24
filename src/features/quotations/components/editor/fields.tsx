"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Input numérico que deja el campo vacío mientras se escribe y solo emite números válidos. */
export function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step = "any",
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
}) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  // Si el valor cambia desde fuera (p. ej. al limitarlo), se refleja en el campo
  if (value !== prev) {
    setPrev(value);
    if (Number(text) !== value) setText(String(value));
  }

  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) {
          setPrev(n);
          onChange(n);
        }
      }}
      onBlur={() => !Number.isFinite(parseFloat(text)) && setText(String(value))}
    />
  );
}
