"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Copy, Download, Eye, FilePlus2, History, Loader2, Save, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { quoteTotals } from "../../domain/calc";
import { toISODate } from "../../domain/dates";
import { emptyQuote } from "../../domain/defaults";
import { money } from "../../domain/format";
import { STATUSES, type Quote, type QuoteInput, type Status } from "../../domain/schema";
import { effectiveStatus, STATUS_LABELS } from "../../domain/status";
import { downloadQuotationPdf, quotationPdfUrl } from "../../pdf/client";
import { duplicateQuotation, saveQuotation, shareQuotation } from "../../server/actions";
import { StatusBadge } from "../status-badge";
import { CatalogPicker } from "./catalog-picker";
import { ShareDialog } from "./share-dialog";
import { PdfPreviewDialog, type PdfPreview } from "../pdf-preview-dialog";
import { Field, NumberInput } from "./fields";
import { ItemsEditor } from "./items-editor";
import { LivePdfPreview } from "./live-pdf-preview";
import { SummaryRows, TotalRow } from "./summary-panel";
import { TextListEditor } from "./text-list-editor";
import { useDraft } from "./use-draft";

const STEPS = ["Datos", "Pago inicial", "Renovables", "Incluye y condiciones", "Resumen"] as const;

const toInput = ({ id, createdAt, publicToken, acceptedAt, acceptedBy, ...input }: Quote): QuoteInput => input;

/** `logo`: logo de la empresa (data URL) para el PDF. */
export function QuoteEditor({ initial, logo = null }: { initial: Quote; logo?: string | null }) {
  const router = useRouter();
  const [quote, setQuote] = useState(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<PdfPreview | null>(null);
  const [busy, setBusy] = useState<"save" | "copy" | "pdf" | "share" | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [, startTransition] = useTransition();

  const totals = useMemo(() => quoteTotals(quote), [quote]);
  const dirty = JSON.stringify(quote) !== saved;
  const set = (patch: Partial<Quote>) => setQuote((q) => ({ ...q, ...patch }));
  const draft = useDraft(initial, quote, dirty);

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
      if (r.data.code !== quote.code) {
        // Otro usuario tomó el correlativo mientras se editaba: el servidor asignó el siguiente
        toast.success(`Cotización guardada como ${r.data.code}`, { description: `${quote.code} ya estaba en uso.` });
      } else {
        toast.success(`Cotización ${r.data.code} guardada`);
      }
      const next = { ...quote, id: r.data.id, code: r.data.code };
      setQuote(next);
      setSaved(JSON.stringify(next));
      draft.clear(quote.id);
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

  const newQuote = (force = false) => {
    if (dirty && !force) return setConfirmNew(true);
    draft.clear();
    if (quote.id) router.push("/cotizaciones/nueva");
    else {
      // Ya estamos en /nueva: el código sigue disponible porque no se guardó
      const fresh = emptyQuote(initial.code, { hdr: initial.hdr });
      setQuote(fresh);
      setSaved(JSON.stringify(fresh));
      setStep(0);
    }
  };

  const showPdf = () =>
    run("pdf", async () => {
      const { url, fileName } = await quotationPdfUrl(quote, logo);
      setPreview({ url, fileName, title: `${quote.code} · ${quote.client || "Cotización"}` });
    });
  const downloadPdf = () => run("pdf", () => downloadQuotationPdf(quote, logo));

  // Compartir crea el enlace público; si estaba en borrador, el servidor la pasa a "enviada"
  const share = () =>
    run("share", async () => {
      if (!quote.id) return;
      const r = await shareQuotation(quote.id);
      if (!r.ok) return void toast.error(r.error);
      const status: Status = quote.status === "borrador" ? "enviada" : quote.status;
      setQuote((q) => ({ ...q, publicToken: r.data.token, status }));
      // Lo que cambió el servidor no cuenta como cambio sin guardar
      setSaved((prev) => JSON.stringify({ ...JSON.parse(prev), publicToken: r.data.token, status }));
      setSharing(true);
    });
  const today = toISODate(new Date());

  const go = (i: number) => {
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Ctrl/Cmd + S guarda (siempre con la versión más reciente de save)
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = [null, quote.initial.length, quote.recurring.length, quote.incl.length + quote.cond.length, null];

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
            <StatusBadge status={effectiveStatus(quote, today)} className="ml-2 normal-case" />
            {dirty && <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-brand-foreground normal-case">Cambios sin guardar</span>}
          </p>
          <h1 className="truncate text-lg font-extrabold tracking-tight md:text-xl">
            {quote.code} · {quote.client || <span className="text-muted-foreground">(Sin cliente)</span>}
          </h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => newQuote()}>
            <FilePlus2 /> Nueva
          </Button>
          <Button
            variant="outline"
            onClick={share}
            disabled={!quote.id || dirty || busy === "share"}
            title={!quote.id || dirty ? "Guarda la cotización para compartirla" : "Compartir enlace con el cliente"}
          >
            {busy === "share" ? <Loader2 className="animate-spin" /> : <Share2 />} Compartir
          </Button>
          <Button variant="outline" onClick={duplicate} disabled={busy === "copy"}>
            {busy === "copy" ? <Loader2 className="animate-spin" /> : <Copy />} Duplicar
          </Button>
          <Button onClick={save} disabled={busy === "save"} aria-keyshortcuts="Control+S" title="Guardar (Ctrl+S)" className="max-lg:hidden">
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Guardar
          </Button>
        </div>
      </div>

      {draft.pending && (
        <div role="status" className="mb-4 flex flex-col gap-3 rounded-xl border border-brand/40 bg-brand-soft px-4 py-3 text-sm text-brand-foreground sm:flex-row sm:items-center">
          <History className="size-5 shrink-0" aria-hidden />
          <p className="flex-1">
            Hay un borrador sin guardar de esta cotización ({new Date(draft.pending.savedAt).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}).
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => draft.clear()}>
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setQuote({ ...draft.pending!.quote, id: initial.id, createdAt: initial.createdAt });
                draft.dismiss();
                toast.success("Borrador restaurado");
              }}
            >
              Restaurar
            </Button>
          </div>
        </div>
      )}

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
            {!!counts[i] && <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">{counts[i]}</span>}
          </button>
        ))}
      </nav>

      <div className="grid flex-1 items-start gap-6 pb-20 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-0 2xl:grid-cols-[minmax(0,1fr)_34rem]">
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
                  <Field id="issuedAt" label="Fecha de emisión" hint="La validez se cuenta desde esta fecha.">
                    <Input id="issuedAt" type="date" value={quote.issuedAt} onChange={(e) => e.target.value && set({ issuedAt: e.target.value })} required />
                  </Field>
                  <Field id="status" label="Estado">
                    <Select value={quote.status} onValueChange={(v) => set({ status: v as Status })}>
                      <SelectTrigger id="status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((st) => (
                          <SelectItem key={st} value={st}>
                            {STATUS_LABELS[st]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              <CatalogPicker
                type="initial"
                margin={quote.margin}
                onPick={({ desc, detail, cant, cost }) => setQuote((q) => ({ ...q, initial: [...q.initial, { desc, detail, cant, cost }] }))}
              />
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
              <CatalogPicker type="recurring" margin={quote.margin} onPick={(item) => setQuote((q) => ({ ...q, recurring: [...q.recurring, item] }))} />
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
              {!quote.client.trim() && (
                <p className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  Falta el nombre del cliente.
                  <button type="button" className="font-semibold underline underline-offset-2" onClick={() => go(0)}>
                    Completar
                  </button>
                </p>
              )}
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
              <Button className="bg-brand text-brand-contrast hover:bg-brand/85" onClick={save} disabled={busy === "save"}>
                <Save /> Guardar cotización
              </Button>
            )}
          </footer>
        </section>

        {/* Panel lateral en escritorio: resumen o PDF en vivo */}
        <aside className="hidden lg:sticky lg:top-8 lg:block" aria-label="Resumen y vista previa">
          <Tabs defaultValue="resumen" className="gap-3">
            <TabsList className="w-full">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="pdf">PDF en vivo</TabsTrigger>
            </TabsList>
            <TabsContent value="resumen" className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle>Resumen</CardTitle>
                </CardHeader>
                <CardContent>
                  <SummaryRows totals={totals} igv={quote.igv} />
                </CardContent>
              </Card>
              {pdfButtons}
            </TabsContent>
            <TabsContent value="pdf" className="space-y-3">
              <div className="h-[calc(100dvh-13rem)] min-h-96">
                <LivePdfPreview quote={quote} logo={logo} />
              </div>
              {pdfButtons}
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {/* Móvil: total siempre a la vista */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Total primer año</p>
          <p className="text-base font-extrabold tabular-nums">{money(totals.firstYear)}</p>
        </div>
        <Button variant="outline" onClick={showPdf} disabled={busy === "pdf"}>
          <Eye /> PDF
        </Button>
        <Button onClick={save} disabled={busy === "save"}>
          {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Guardar
        </Button>
      </div>

      <AlertDialog open={confirmNew} onOpenChange={setConfirmNew}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>Si empiezas una nueva cotización, se perderán los cambios de {quote.code}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => newQuote(true)}>
              Descartar y crear nueva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {quote.id && (
        <ShareDialog
          quotationId={quote.id}
          token={sharing ? (quote.publicToken ?? null) : null}
          onClose={() => setSharing(false)}
          onRevoked={() => {
            setSharing(false);
            setQuote((q) => ({ ...q, publicToken: null }));
            setSaved((prev) => JSON.stringify({ ...JSON.parse(prev), publicToken: null }));
          }}
        />
      )}

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
