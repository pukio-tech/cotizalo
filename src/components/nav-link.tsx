"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  exact?: boolean;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

function NavLinkView({ href, icon, badge, children, active }: NavLinkProps & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 items-center gap-2.5 rounded-lg border border-transparent px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors md:flex-none",
        "hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        "[&_svg]:size-5 [&_svg]:shrink-0",
        active && "border-sidebar-border bg-sidebar-accent font-bold text-foreground shadow-xs [&_svg]:text-brand"
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {badge !== undefined && (
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">{badge}</span>
      )}
    </Link>
  );
}

function ActiveNavLink(props: NavLinkProps) {
  const pathname = usePathname();
  const active = props.exact ? pathname === props.href : pathname.startsWith(props.href);
  return <NavLinkView {...props} active={active} />;
}

// La ruta actual solo se conoce en la petición: se muestra sin resaltar mientras llega
export function NavLink(props: NavLinkProps) {
  return (
    <Suspense fallback={<NavLinkView {...props} active={false} />}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}
