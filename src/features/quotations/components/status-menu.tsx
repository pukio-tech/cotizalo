"use client";

import { useOptimistic, useTransition } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { STATUSES, type Status } from "../domain/schema";
import { effectiveStatus, STATUS_DOTS, STATUS_LABELS, type EffectiveStatus } from "../domain/status";
import { updateStatus } from "../server/actions";
import { StatusBadge } from "./status-badge";

interface StatusMenuProps {
  /** Estado guardado (el que se elige en el menú) */
  status: Status;
  /** Estado que se muestra (puede ser "vencida") */
  display: EffectiveStatus;
  onChange: (status: Status) => void;
  busy?: boolean;
  className?: string;
}

/** Distintivo de estado que se abre como menú para cambiarlo. */
export function StatusMenu({ status, display, onChange, busy, className }: StatusMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Estado: ${STATUS_LABELS[display]}. Cambiar estado`}
          className={cn("rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
        >
          <StatusBadge status={display} className="pr-1.5 transition-[filter] hover:brightness-95 dark:hover:brightness-125">
            {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <ChevronDown className="size-3" aria-hidden />}
          </StatusBadge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Cambiar estado</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => v !== status && onChange(v as Status)}>
          {STATUSES.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              <span className={cn("size-2 rounded-full", STATUS_DOTS[s])} aria-hidden />
              {STATUS_LABELS[s]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {display === "vencida" && <p className="px-1.5 pt-1.5 pb-1 text-xs text-muted-foreground">Pasó su validez: pásala a negociación o renuévala.</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Menú de estado autónomo (listado): guarda al elegir y muestra el cambio al instante. */
export function QuotationStatus({ id, status, issuedAt, days, today }: { id: string; status: Status; issuedAt: string; days: number; today: string }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [busy, startTransition] = useTransition();

  const change = (next: Status) =>
    startTransition(async () => {
      setOptimistic(next);
      const r = await updateStatus(id, next);
      if (!r.ok) toast.error(r.error);
    });

  return <StatusMenu status={optimistic} display={effectiveStatus({ status: optimistic, issuedAt, days }, today)} onChange={change} busy={busy} />;
}
