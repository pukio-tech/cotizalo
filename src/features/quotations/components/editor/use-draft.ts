"use client";

import { useEffect, useMemo, useReducer, useRef, useSyncExternalStore } from "react";
import type { Quote } from "../../domain/schema";

// Borrador local por cotización: si se cierra la pestaña o se cae la conexión,
// los cambios sin guardar se pueden recuperar al volver.

export interface Draft {
  savedAt: string;
  quote: Quote;
}

const keyFor = (id: string | null) => `cotizalo-draft:${id ?? "nueva"}`;
const noSubscribe = () => () => {};

const readRaw = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Guarda el borrador (con pausa) mientras hay cambios sin guardar. Devuelve el borrador que
 * existía al abrir el editor (si difiere de lo guardado en la BD) y cómo descartarlo o limpiarlo.
 */
export function useDraft(initial: Quote, quote: Quote, dirty: boolean) {
  const key = keyFor(initial.id);
  // Lo que había al abrir; se lee una vez en el cliente (en el servidor no hay borrador)
  const opened = useRef<string | null | undefined>(undefined);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const raw = useSyncExternalStore(
    noSubscribe,
    () => {
      if (opened.current === undefined) opened.current = readRaw(key);
      return opened.current;
    },
    () => null
  );

  const pending = useMemo(() => {
    if (!raw) return null;
    try {
      const d = JSON.parse(raw) as Draft;
      return JSON.stringify(d.quote) !== JSON.stringify(initial) ? d : null;
    } catch {
      return null;
    }
  }, [raw, initial]);

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), quote } satisfies Draft));
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [dirty, quote, key]);

  /** Oculta el aviso del borrador encontrado al abrir. */
  const dismiss = () => {
    opened.current = null;
    rerender();
  };

  /** Borra el borrador guardado (tras guardar en la BD o al descartarlo). */
  const clear = (id: string | null = initial.id) => {
    try {
      localStorage.removeItem(keyFor(id));
    } catch {}
    dismiss();
  };

  return { pending, dismiss, clear };
}
