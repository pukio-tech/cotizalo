"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Quote } from "../../domain/schema";
import { downloadQuotationPdf } from "../../pdf/client";
import { acceptQuotation } from "../../server/actions";

export function PublicPdfButton({ quote, logo }: { quote: Quote; logo: string | null }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="outline" className="h-10" disabled={pending} onClick={() => startTransition(() => downloadQuotationPdf(quote, logo))}>
      {pending ? <Loader2 className="animate-spin" /> : <Download />} Descargar PDF
    </Button>
  );
}

/** El cliente confirma su conformidad escribiendo su nombre. */
export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(form) =>
        startTransition(async () => {
          setError(null);
          const r = await acceptQuotation({ token, name: form.get("name") });
          if (!r.ok) return setError(r.error);
          toast.success("¡Gracias! Registramos tu aceptación.");
          router.refresh();
        })
      }
      className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="accept-name">Nombre de quien acepta</Label>
        <Input id="accept-name" name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Nombre y apellido" />
      </div>
      <Button type="submit" className="h-10 bg-brand text-brand-contrast hover:bg-brand/85" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Aceptar propuesta
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      )}
    </form>
  );
}
