import { Skeleton } from "@/components/ui/skeleton";

export function EditorSkeleton() {
  return (
    <div className="space-y-6" aria-label="Cargando cotización">
      <div className="flex justify-between gap-4 border-b pb-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-6 w-64" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="hidden h-56 lg:block" />
      </div>
    </div>
  );
}
