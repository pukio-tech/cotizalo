import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { emptyQuote, headerFromOrganization } from "@/features/quotations/domain/defaults";
import { EditorSkeleton } from "@/features/quotations/components/editor/editor-skeleton";
import { QuoteEditor } from "@/features/quotations/components/editor/quote-editor";
import { nextCode } from "@/features/quotations/server/repository";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Nueva cotización" };

async function NewQuoteEditor() {
  await connection();
  const { organization } = await requireViewer();
  const code = await nextCode(organization.id, new Date().getFullYear());
  return <QuoteEditor initial={emptyQuote(code, { hdr: headerFromOrganization(organization) })} logo={organization.logo} />;
}

export default function NewQuotationPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NewQuoteEditor />
    </Suspense>
  );
}
