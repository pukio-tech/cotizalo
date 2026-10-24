import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col md:flex-row">
      <AppSidebar />
      <main className="flex min-w-0 flex-1 flex-col p-4 md:p-8">{children}</main>
    </div>
  );
}
