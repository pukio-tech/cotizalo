import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_STYLES, type EffectiveStatus } from "../domain/status";

export function StatusBadge({ status, className }: { status: EffectiveStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}
