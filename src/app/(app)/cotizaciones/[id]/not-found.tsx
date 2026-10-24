import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function QuotationNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <FileQuestion className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-lg font-bold">Cotización no encontrada</h1>
      <p className="text-sm text-muted-foreground">Puede que se haya eliminado o que el enlace esté incompleto.</p>
      <Button asChild>
        <Link href="/cotizaciones">Ver cotizaciones</Link>
      </Button>
    </div>
  );
}
