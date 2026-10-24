import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme";
import { quoteTotals, unitPrice, lineTotal } from "@/features/quotations/domain/calc";
import { expiryISODate, localDate, toISODate } from "@/features/quotations/domain/dates";
import { formatDate, money } from "@/features/quotations/domain/format";
import { toPublicQuote } from "@/features/quotations/domain/public-quote";
import type { QuoteItem, RecurringItem } from "@/features/quotations/domain/schema";
import { visibleSections } from "@/features/quotations/domain/sections";
import { canAccept, effectiveStatus } from "@/features/quotations/domain/status";
import { AcceptForm, PublicPdfButton } from "@/features/quotations/components/public/public-actions";
import { StatusBadge } from "@/features/quotations/components/status-badge";
import { getPublicQuotation } from "@/features/quotations/server/repository";

// Vista pública de una cotización (enlace compartido). No requiere sesión ni muestra costos ni margen.

export const metadata: Metadata = { title: "Cotización", robots: { index: false, follow: false } };

function Items({ title, items, margin }: { title: string; items: (QuoteItem | RecurringItem)[]; margin: number }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold">{title}</h2>
      <ul className="divide-y rounded-xl border">
        {items.map((it, i) => {
          const u = unitPrice(it, margin);
          return (
            <li key={i} className="flex justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {it.desc}
                  {"per" in it && <span className="ml-2 text-xs font-normal text-muted-foreground">{it.per === "anual" ? "Anual" : "Mensual"}</span>}
                </p>
                {it.detail && <p className="text-sm whitespace-pre-line text-muted-foreground">{it.detail}</p>}
              </div>
              <p className="shrink-0 text-right font-semibold tabular-nums">
                {u ? money(lineTotal(it, margin)) : <span className="text-success">Incluido</span>}
                {it.cant > 1 && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {it.cant} × {money(u)}
                  </span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function PublicQuotation({ params }: { params: PageProps<"/p/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  const found = await getPublicQuotation(token);
  if (!found) notFound();
  const quote = toPublicQuote(found.quote);
  const { organization } = found;
  const today = toISODate(new Date());
  const status = effectiveStatus(quote, today);
  const totals = quoteTotals(quote);
  const show = visibleSections(quote, totals);

  return (
    <article className="space-y-6">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo en data URL guardado en la BD */}
          {organization.logo && <img src={organization.logo} alt="" className="h-12 w-auto max-w-32 object-contain" />}
          <div>
            <p className="text-lg font-extrabold">{organization.name}</p>
            <p className="text-sm text-muted-foreground">Cotización {quote.code}</p>
          </div>
        </div>
        <div className="text-sm sm:text-right">
          <StatusBadge status={status} />
          <p className="mt-1 text-muted-foreground">Emitida el {formatDate(localDate(quote.issuedAt))}</p>
          <p className="text-muted-foreground">Válida hasta el {formatDate(localDate(expiryISODate(quote.issuedAt, quote.days)))}</p>
        </div>
      </header>

      <section className="rounded-xl bg-muted px-4 py-3">
        <p className="text-sm text-muted-foreground">Para</p>
        <p className="text-lg font-bold">{quote.client}</p>
        <p className="text-sm text-muted-foreground">{quote.plan}</p>
      </section>

      {show.initial && <Items title="Pago inicial (único)" items={quote.initial} margin={quote.margin} />}
      {show.recurring && <Items title="Planes y servicios renovables" items={quote.recurring} margin={quote.margin} />}

      {show.includes.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-bold">Incluye</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {show.includes.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border-2 border-brand/40 p-4">
        <h2 className="mb-2 text-base font-bold">Resumen de pagos</h2>
        <dl className="space-y-1 text-sm">
          {totals.has.initial && (
            <div className="flex justify-between">
              <dt>Pago inicial (único)</dt>
              <dd className="tabular-nums">{money(totals.initial.tot)}</dd>
            </div>
          )}
          {totals.has.monthly && (
            <div className="flex justify-between">
              <dt>Mensual</dt>
              <dd className="tabular-nums">{money(totals.monthly.tot)}</dd>
            </div>
          )}
          {totals.has.annual && (
            <div className="flex justify-between">
              <dt>Anual</dt>
              <dd className="tabular-nums">{money(totals.annual.tot)}</dd>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
            <dt>Total primer año</dt>
            <dd className="tabular-nums">{money(totals.firstYear)}</dd>
          </div>
        </dl>
        <p className="mt-1 text-xs text-muted-foreground">{quote.igv ? "Montos con IGV incluido." : "Montos sin IGV."}</p>
      </section>

      {show.conditions.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-bold">Condiciones</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {show.conditions.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4 rounded-xl border p-4">
        {quote.status === "aceptada" ? (
          <p className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="size-5" aria-hidden />
            Propuesta aceptada{found.quote.acceptedBy ? ` por ${found.quote.acceptedBy}` : ""}
            {found.quote.acceptedAt ? ` el ${formatDate(new Date(found.quote.acceptedAt))}` : ""}.
          </p>
        ) : canAccept(quote, today) ? (
          <>
            <p className="text-sm text-muted-foreground">Si estás de acuerdo con la propuesta, confírmalo aquí. {organization.name} recibirá tu aceptación.</p>
            <AcceptForm token={token} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {status === "vencida" ? "Esta cotización ya venció. Pide una actualizada." : "Esta cotización no está disponible para aceptar."}
          </p>
        )}
        <PublicPdfButton quote={quote} logo={organization.logo} />
      </section>
    </article>
  );
}

export default function PublicQuotationPage({ params }: PageProps<"/p/[token]">) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      <div className="mb-4 flex justify-end">
        <ThemeToggle />
      </div>
      <Suspense
        fallback={
          <div className="space-y-4" aria-label="Cargando cotización">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        }
      >
        <PublicQuotation params={params} />
      </Suspense>
      <p className="mt-10 text-center text-xs text-muted-foreground">Hecho con Cotízalo · PUKIO</p>
    </main>
  );
}
