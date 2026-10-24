import { cn } from "@/lib/utils";
import type { QuoteTotals } from "../../domain/calc";
import { money } from "../../domain/format";

export function TotalRow({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong ? "mt-1 border-t border-foreground pt-2 text-base font-bold" : "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular-nums">{money(amount)}</span>
    </div>
  );
}

/** Resumen de pagos con las mismas reglas del PDF: solo filas con servicios. */
export function SummaryRows({ totals, igv }: { totals: QuoteTotals; igv: boolean }) {
  const { has } = totals;
  if (!has.initial && !has.monthly && !has.annual) {
    return <p className="text-sm text-muted-foreground">Agrega servicios para ver los totales.</p>;
  }
  return (
    <div className="space-y-1.5 text-sm">
      {has.initial && <TotalRow label="Pago inicial (único)" amount={totals.initial.tot} />}
      {has.monthly && <TotalRow label="Renovación mensual" amount={totals.monthly.tot} />}
      {has.annual && <TotalRow label="Renovación anual" amount={totals.annual.tot} />}
      <TotalRow label="Total primer año" amount={totals.firstYear} strong />
      <p className="pt-1 text-xs text-muted-foreground">{igv ? "Montos con IGV incluido." : "Montos sin IGV."}</p>
    </div>
  );
}
