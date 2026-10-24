"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export function UserMenu({ name, email, organization }: { name: string; email: string; organization: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const logout = () =>
    startTransition(async () => {
      await authClient.signOut();
      router.replace("/ingresar");
      router.refresh();
    });

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand-foreground" aria-hidden>
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs leading-tight font-bold" title={organization}>
          {organization}
        </p>
        <p className="truncate text-[11px] font-medium text-muted-foreground" title={email}>
          {name}
        </p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={logout} disabled={pending} aria-label="Cerrar sesión" title="Cerrar sesión">
        {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
      </Button>
    </div>
  );
}
