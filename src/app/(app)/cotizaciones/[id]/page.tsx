import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EditorSkeleton } from "@/features/quotations/components/editor/editor-skeleton";
import { QuoteEditor } from "@/features/quotations/components/editor/quote-editor";
import { getQuotation } from "@/features/quotations/server/repository";

export const metadata: Metadata = { title: "Editar cotización" };

async function ExistingQuoteEditor({ params }: { params: PageProps<"/cotizaciones/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const quote = await getQuotation(id);
  if (!quote) notFound();
  return <QuoteEditor key={quote.id} initial={quote} />;
}

export default function EditQuotationPage({ params }: PageProps<"/cotizaciones/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <ExistingQuoteEditor params={params} />
    </Suspense>
  );
}
