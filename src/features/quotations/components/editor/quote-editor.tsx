"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Copy, Download, Eye, FilePlus2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { quoteTotals } from "../../domain/calc";
import { emptyQuote } from "../../domain/defaults";
import type { Quote, QuoteInput } from "../../domain/schema";
import { downloadQuotationPdf, quotationPdfUrl } from "../../pdf/client";
import { duplicateQuotation, saveQuotation } from "../../server/actions";
import { PdfPreviewDialog, type PdfPreview } from "../pdf-preview-dialog";
import { Field, NumberInput } from "./fields";
import { ItemsEditor } from "./items-editor";
import { SummaryRows, TotalRow } from "./summary-panel";
import { TextListEditor } from "./text-list-editor";

const STEPS = ["Datos", "Pago inicial", "Renovables", "Incluye y condiciones", "Resumen"] as const;

const toInput = ({ id, createdAt, ...input }: Quote): QuoteInput => input;

export function QuoteEditor({ initial }: { initial: Quote }) {
  const router = useRouter();
  const [quote, setQuote] = useState(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<PdfPreview | null>(null);
  const [busy, setBusy] = useState<"save" | "copy" | "pdf" | null>(null);
  const [, startTransition] = useTransition();

  const totals = useMemo(() => quoteTotals(quote), [quote]);
  const dirty = JSON.stringify(quote) !== saved;
  const set = (patch: Partial<Quote>) => setQuote((q) => ({ ...q, ...patch }));

  // Aviso al cerrar o recargar la pestaña con cambios sin guardar
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const run = (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    startTransition(async () => {
      try {
        await fn();
      } finally {
        setBusy(null);
      }
    });
  };

  const save = () =>
    run("save", async () => {
      const r = await saveQuotation(quote.id, toInput(quote));
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Cotización ${r.data.code} guardada`);
      const next = { ...quote, id: r.data.id };
      setQuote(next);
      setSaved(JSON.stringify(next));
      // La recién creada pasa a su URL propia (y se recarga desde la BD)
      if (!quote.id) router.replace(`/cotizaciones/${r.data.id}`);
    });

  const duplicate = () =>
    run("copy", async () => {
      const r = await duplicateQuotation(quote.id, toInput(quote));
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Cotización duplicada: ${r.data.code}`);
      setSaved(JSON.stringify(quote));
      router.push(`/cotizaciones/${r.data.id}`);
    });

  const newQuote = () => {
    if (dirty && !confirm("Hay cambios sin guardar. ¿Descartarlos y empezar una nueva cotización?")) return;
    if (quote.id) router.push("/cotizaciones/nueva");
    else {
      // Ya estamos en /nueva: el código sigue disponible porque no se guardó
      const fresh = emptyQuote(initial.code);
      setQuote(fresh);
      setSaved(JSON.stringify(fresh));
      setStep(0);
    }
  };

  const showPdf = () =>
    run("pdf", async () => {
      const { url, fileName } = await quotationPdfUrl(quote, new Date());
      setPreview({ url, fileName, title: `${quote.code} · ${quote.client || "Cotización"}` });
    });
  const downloadPdf = () => run("pdf", () => downloadQuotationPdf(quote, new Date()));

  const go = (i: number) => {
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pdfButtons = (
    <div className="flex gap-2">
      <Button variant="outline" className="h-10 flex-1" onClick={showPdf} disabled={busy === "pdf"}>
        <Eye /> Vista previa
      </Button>
      <Button className="h-10 flex-1" onClick={downloadPdf} disabled={busy === "pdf"}>
        <Download /> Descargar PDF
      </Button>
    </div>
  );

  return (
    <>
      {/* Barra superior */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
            {quote.id ? "Cotización guardada" : "Nueva cotización"}
            {dirty && <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-brand-foreground normal-case">Cambios sin guardar</span>}
          </p>
          <h1 className="truncate text-lg font-extrabold tracking-tight md:text-xl">
            {quote.code} · {quote.client || <span className="text-muted-foreground">(Sin cliente)</span>}
          </h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" onClick={newQuote}>
            <FilePlus2 /> Nueva
          </Button>
          <Button variant="outline" onClick={duplicate} disabled={busy === "copy"}>
            {busy === "copy" ? <Loader2 className="animate-spin" /> : <Copy />} Duplicar
          </Button>
          <Button onClick={save} disabled={busy === "save"}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Guardar
          </Button>
        </div>
      </div>

      {/* Pasos */}
      <nav aria-label="Pasos de la cotización" className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => go(i)}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              i === step ? "border-foreground font-bold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {i + 1}. {s}
          </button>
        ))}
      </nav>

      <div className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 space-y-4" aria-label={STEPS[step]}>
          {step === 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Cliente y cotización</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field id="client" label="Nombre del cliente">
                    <Input id="client" value={quote.client} onChange={(e) => set({ client: e.target.value })} placeholder="Ej. Inversiones Andinas SAC" maxLength={200} />
                  </Field>
                  <Field id="code" label="Código de cotización">
                    <Input id="code" value={quote.code} onChange={(e) => set({ code: e.target.value })} maxLength={40} />
                  </Field>
                  <Field id="plan" label="Plan propuesto">
                    <Input id="plan" value={quote.plan} onChange={(e) => set({ plan: e.target.value })} placeholder="Ej. Web corporativa" maxLength={200} />
                  </Field>
                  <Field id="days" label="Días de validez">
                    <NumberInput id="days" value={quote.days} onChange={(n) => set({ days: Math.min(365, Math.max(0, Math.round(n))) })} min={0} max={365} step={1} />
                  </Field>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Precios e impuestos</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field id="margin" label="Margen de ganancia (%)" hint="Se suma al costo base de cada servicio. No aparece en el PDF.">
                    <NumberInput id="margin" value={quote.margin} onChange={(n) => set({ margin: n })} />
                  </Field>
                  <Field id="months" label="Mensualidades en el primer año" hint="Entre 0 y 12.">
                    <NumberInput id="months" value={quote.months} onChange={(n) => set({ months: Math.min(12, Math.max(0, Math.round(n))) })} min={0} max={12} step={1} />
                  </Field>
                  <div className="flex items-center gap-3 sm:col-span-2">
                    <Switch id="igv" checked={quote.igv} onCheckedChange={(igv) => set({ igv })} />
                    <Label htmlFor="igv">Sumar IGV (18%) a los totales</Label>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Cabecera del PDF</CardTitle>
                  <CardDescription>Tus datos en la parte superior del documento.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex items-center gap-3">
                    <Switch id="hdr-on" checked={quote.hdr.on} onCheckedChange={(on) => set({ hdr: { ...quote.hdr, on } })} />
                    <Label htmlFor="hdr-on">Mostrar cabecera en el PDF</Label>
                  </div>
                  {quote.hdr.on && (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field id="hdr-name" label="Nombre o razón social">
                        <Input id="hdr-name" value={quote.hdr.name} onChange={(e) => set({ hdr: { ...quote.hdr, name: e.target.value } })} maxLength={200} />
                      </Field>
                      <Field id="hdr-l1" label="Línea 1 (teléfono, correo)">
                        <Input id="hdr-l1" value={quote.hdr.l1} onChange={(e) => set({ hdr: { ...quote.hdr, l1: e.target.value } })} maxLength={200} />
                      </Field>
                      <Field id="hdr-l2" label="Línea 2 (web, dirección)">
                        <Input id="hdr-l2" value={quote.hdr.l2} onChange={(e) => set({ hdr: { ...quote.hdr, l2: e.target.value } })} maxLength={200} />
                      </Field>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {step === 1 && (
            <>
              <StepIntro title="Pago inicial (único)" text="Desarrollo y puesta en marcha. Si no agregas servicios, esta sección no aparece en el PDF." />
              <ItemsEditor items={quote.initial} margin={quote.margin} withPeriod={false} onChange={(initial) => set({ initial })} />
              {totals.has.initial && (
                <Card size="sm">
                  <CardContent className="space-y-1 text-sm">
                    <TotalRow label="Subtotal" amount={totals.initial.sub} />
                    {quote.igv && <TotalRow label="IGV (18%)" amount={totals.initial.igv} />}
                    <TotalRow label="Total a pagar al inicio" amount={totals.initial.tot} strong />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <StepIntro title="Planes y servicios renovables" text="Dominios, hosting y suscripciones. Si no agregas ninguno, esta sección no aparece en el PDF." />
              <ItemsEditor items={quote.recurring} margin={quote.margin} withPeriod onChange={(recurring) => set({ recurring })} />
              {(totals.has.monthly || totals.has.annual) && (
                <Card size="sm">
                  <CardContent className="space-y-1 text-sm">
                    {totals.has.monthly && <TotalRow label={`Total mensual${quote.igv ? " + IGV" : ""}`} amount={totals.monthly.tot} />}
                    {totals.has.annual && <TotalRow label={`Total anual${quote.igv ? " + IGV" : ""}`} amount={totals.annual.tot} />}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Incluye</CardTitle>
                  <CardDescription>Lo que recibe el cliente con esta cotización.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TextListEditor label="Incluye" items={quote.incl} onChange={(incl) => set({ incl })} placeholder="Ej. Certificado SSL gratuito" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Condiciones</CardTitle>
                  <CardDescription>Plazos, formas de pago y términos. Usa {"{dias}"} para mostrar los días de validez.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TextListEditor label="Condiciones" items={quote.cond} onChange={(cond) => set({ cond })} placeholder="Ej. Entrega en 15 días hábiles" />
                </CardContent>
              </Card>
            </>
          )}

          {step === 4 && (
            <>
              <StepIntro title="Resumen de pagos" text="Revisa los montos y genera el PDF para enviarlo al cliente." />
              <Card>
                <CardHeader>
                  <CardTitle>{quote.client || "Cotización"}</CardTitle>
                  <CardDescription>
                    {quote.code}
                    {quote.plan && ` · ${quote.plan}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SummaryRows totals={totals} igv={quote.igv} />
                </CardContent>
              </Card>
              {pdfButtons}
            </>
          )}

          <footer className="flex justify-between border-t pt-4">
            <Button variant="outline" className={cn(step === 0 && "invisible")} onClick={() => go(step - 1)}>
              <ArrowLeft /> Anterior
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => go(step + 1)}>
                Siguiente <ArrowRight />
              </Button>
            ) : (
              <Button className="bg-brand text-brand-foreground hover:bg-brand/85" onClick={save} disabled={busy === "save"}>
                <Save /> Guardar cotización
              </Button>
            )}
          </footer>
        </section>

        {/* Resumen siempre visible en escritorio */}
        <aside className="hidden space-y-3 lg:sticky lg:top-8 lg:block" aria-label="Resumen">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <SummaryRows totals={totals} igv={quote.igv} />
            </CardContent>
          </Card>
          {pdfButtons}
        </aside>
      </div>

      <PdfPreviewDialog preview={preview} onClose={() => setPreview(null)} />
    </>
  );
}

function StepIntro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
