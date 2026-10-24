import { ThemeToggle } from "@/components/theme";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-sidebar px-4 py-10">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-logo text-xl font-extrabold text-logo-foreground shadow-sm ring-1 ring-white/10" aria-hidden>
            C
          </div>
          <div>
            <p className="text-lg leading-tight font-extrabold tracking-tight">Cotízalo</p>
            <p className="text-xs font-medium text-muted-foreground">by PUKIO</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
