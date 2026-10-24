"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOrganization } from "../actions";

const MAX_W = 600;
const MAX_H = 240;
const MAX_BYTES = 200_000;

/** Reduce el logo (máx. 600×240) y lo convierte en data URL PNG; si pesa mucho, prueba JPEG. */
async function toLogoDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg)$/.test(file.type)) throw new Error("Usa una imagen PNG o JPG");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_W / bitmap.width, MAX_H / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const [type, quality] of [["image/png", undefined], ["image/jpeg", 0.9], ["image/jpeg", 0.75]] as const) {
    const url = canvas.toDataURL(type, quality);
    if (url.length * 0.75 <= MAX_BYTES) return url;
  }
  throw new Error("El logo es demasiado pesado; prueba con una imagen más simple");
}

export function OrganizationForm({ initial }: { initial: { name: string; headerLine1: string; headerLine2: string; logo: string | null } }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(initial.logo);
  const [pending, startTransition] = useTransition();

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      setLogo(await toLogoDataUrl(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer la imagen");
    }
  };

  const submit = (form: FormData) =>
    startTransition(async () => {
      const r = await saveOrganization({
        name: form.get("name"),
        headerLine1: form.get("headerLine1"),
        headerLine2: form.get("headerLine2"),
        logo: logo === initial.logo ? undefined : logo,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Datos de la empresa guardados");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresa</CardTitle>
        <CardDescription>Se usan en la cabecera del PDF de las cotizaciones nuevas y en el enlace que ve tu cliente.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="org-name">Nombre o razón social</Label>
            <Input id="org-name" name="name" defaultValue={initial.name} required minLength={2} maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="org-l1">Línea 1 (teléfono, correo)</Label>
            <Input id="org-l1" name="headerLine1" defaultValue={initial.headerLine1} maxLength={200} placeholder="+51 999 888 777 · hola@empresa.pe" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="org-l2">Línea 2 (web, dirección)</Label>
            <Input id="org-l2" name="headerLine2" defaultValue={initial.headerLine2} maxLength={200} placeholder="empresa.pe · Lima, Perú" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium">Logo</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-16 w-40 items-center justify-center rounded-lg border bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- vista previa de un data URL local */}
                {logo ? <img src={logo} alt="Logo actual" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-500">Sin logo</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="sr-only" id="org-logo" onChange={(e) => pickLogo(e.target.files?.[0])} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <ImagePlus /> {logo ? "Cambiar" : "Subir logo"}
              </Button>
              {logo && (
                <Button type="button" variant="ghost" onClick={() => setLogo(null)}>
                  <Trash2 /> Quitar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG o JPG. Se ajusta automáticamente a un tamaño liviano.</p>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
