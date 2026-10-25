"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Ellipsis, Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { quotationPdfUrl } from "../../pdf/client";
import { deleteQuotation, duplicateQuotation, loadQuotation } from "../../server/actions";
import { PdfPreviewDialog, type PdfPreview } from "../pdf-preview-dialog";

function IconAction({ label, onClick, busy, children }: { label: string; onClick: () => void; busy?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={busy} aria-label={label}>
          {busy ? <Loader2 className="animate-spin" /> : children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function RowActions({ id, code, client }: { id: string; code: string; client: string }) {
  const [preview, setPreview] = useState<PdfPreview | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "copy" | "delete" | null>(null);
  const [, startTransition] = useTransition();

  const run = (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    startTransition(async () => {
      await fn();
      setBusy(null);
    });
  };

  const showPdf = () =>
    run("pdf", async () => {
      const r = await loadQuotation(id);
      if (!r.ok) return void toast.error(r.error);
      const { quote: q, logo } = r.data;
      const { url, fileName } = await quotationPdfUrl(q, logo);
      setPreview({ url, fileName, title: `${q.code} · ${q.client || "Cotización"}` });
    });

  const duplicate = () =>
    run("copy", async () => {
      const r = await duplicateQuotation(id);
      if (r.ok) toast.success(`Cotización duplicada: ${r.data.code}`);
      else toast.error(r.error);
    });

  const remove = () =>
    run("delete", async () => {
      const r = await deleteQuotation(id);
      if (r.ok) toast.success(`Cotización ${code} eliminada`);
      else toast.error(r.error);
    });

  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconAction label="Ver PDF" onClick={showPdf} busy={busy === "pdf"}>
        <Eye />
      </IconAction>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/cotizaciones/${id}`} aria-label="Editar">
              <Pencil />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Editar</TooltipContent>
      </Tooltip>
      {/* Duplicar y eliminar van en un menú: la fila queda angosta y sin scroll horizontal */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" disabled={busy === "copy" || busy === "delete"} aria-label="Más acciones">
                {busy === "copy" || busy === "delete" ? <Loader2 className="animate-spin" /> : <Ellipsis />}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Más acciones</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={duplicate}>
            <Copy /> Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la cotización {code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará {client ? `la cotización de ${client}` : "esta cotización"} con todos sus servicios. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PdfPreviewDialog preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
