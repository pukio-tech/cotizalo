import Link from "next/link";
import { List, SquareKanban } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "lista", href: "/cotizaciones", label: "Lista", icon: List },
  { key: "tablero", href: "/cotizaciones/tablero", label: "Tablero", icon: SquareKanban },
] as const;

/** Alterna entre el listado y el tablero de cotizaciones. */
export function ViewSwitch({ current }: { current: (typeof VIEWS)[number]["key"] }) {
  return (
    <nav aria-label="Vista" className="inline-flex shrink-0 rounded-lg border bg-muted/50 p-0.5">
      {VIEWS.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === current ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            key === current && "bg-background text-foreground shadow-xs ring-1 ring-border"
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
