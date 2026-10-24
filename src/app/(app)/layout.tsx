import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col md:flex-row">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <AppSidebar />
      <main id="contenido" tabIndex={-1} className="flex min-w-0 flex-1 flex-col p-4 outline-none md:p-8">
        {children}
      </main>
    </div>
  );
}
