import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { emptyQuote } from "@/features/quotations/domain/defaults";
import { EditorSkeleton } from "@/features/quotations/components/editor/editor-skeleton";
import { QuoteEditor } from "@/features/quotations/components/editor/quote-editor";
import { nextCode } from "@/features/quotations/server/repository";

export const metadata: Metadata = { title: "Nueva cotización" };

async function NewQuoteEditor() {
  await connection();
  const code = await nextCode(new Date().getFullYear());
  return <QuoteEditor initial={emptyQuote(code)} />;
}

export default function NewQuotationPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NewQuoteEditor />
    </Suspense>
  );
}
