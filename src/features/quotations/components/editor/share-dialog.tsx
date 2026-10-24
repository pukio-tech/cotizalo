"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Link2Off, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { revokeShare } from "../../server/actions";

/** Muestra el enlace público de la cotización con opción de copiarlo o dejar de compartir. */
export function ShareDialog({
  quotationId,
  token,
  onClose,
  onRevoked,
}: {
  quotationId: string;
  token: string | null;
  onClose: () => void;
  onRevoked: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const url = token ? `${window.location.origin}/p/${token}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar; selecciona el enlace y cópialo");
    }
  };

  const revoke = () =>
    startTransition(async () => {
      const r = await revokeShare(quotationId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("El enlace dejó de funcionar");
      onRevoked();
    });

  return (
    <Dialog open={!!token} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartir con el cliente</DialogTitle>
          <DialogDescription>Con este enlace el cliente ve la cotización, descarga el PDF y puede aceptarla. No necesita cuenta.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={url} readOnly aria-label="Enlace público" onFocus={(e) => e.currentTarget.select()} />
          <Button onClick={copy} aria-live="polite">
            {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="destructive" onClick={revoke} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Link2Off />} Dejar de compartir
          </Button>
          <Button variant="outline" asChild>
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink /> Ver como cliente
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
