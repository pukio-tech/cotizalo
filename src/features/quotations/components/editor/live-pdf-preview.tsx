"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Quote } from "../../domain/schema";
import { quotationPdfUrl } from "../../pdf/client";

/** PDF que se regenera mientras se edita (con una pausa para no rehacerlo en cada tecla). */
export function LivePdfPreview({ quote }: { quote: Quote }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const current = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const next = (await quotationPdfUrl(quote)).url;
        if (cancelled) return URL.revokeObjectURL(next);
        if (current.current) URL.revokeObjectURL(current.current);
        current.current = next;
        setUrl(next);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [quote]);

  useEffect(() => () => void (current.current && URL.revokeObjectURL(current.current)), []);

  if (failed) return <p className="p-4 text-sm text-destructive">No se pudo generar la vista previa.</p>;
  if (!url) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Generando PDF…
      </div>
    );
  }
  return <iframe src={`${url}#toolbar=0&navpanes=0&view=FitH`} title="Vista previa en vivo del PDF" className="h-full w-full rounded-lg border bg-white" />;
}
