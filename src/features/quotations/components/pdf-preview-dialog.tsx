"use client";

import { useEffect } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface PdfPreview {
  url: string;
  fileName: string;
  title: string;
}

/** Vista previa del PDF generado en el navegador; libera la URL al cerrarse. */
export function PdfPreviewDialog({ preview, onClose }: { preview: PdfPreview | null; onClose: () => void }) {
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  return (
    <Dialog open={!!preview} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[92dvh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Vista previa del PDF</DialogTitle>
          <DialogDescription>{preview?.title}</DialogDescription>
        </DialogHeader>
        {preview && <iframe src={preview.url} title="Vista previa del PDF" className="min-h-0 w-full flex-1 rounded-lg border" />}
        <DialogFooter className="gap-2 sm:justify-start">
          {preview && (
            <>
              <Button asChild>
                <a href={preview.url} download={preview.fileName}>
                  <Download /> Descargar PDF
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={preview.url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Abrir en otra pestaña
                </a>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
