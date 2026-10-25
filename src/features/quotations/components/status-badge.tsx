import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_STYLES, type EffectiveStatus } from "../domain/status";

export function StatusBadge({ status, className, children }: { status: EffectiveStatus; className?: string; children?: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        STATUS_STYLES[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
      {children}
    </span>
  );
}
