"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { slugify } from "./safe-redirect";

/** Registro: crea la cuenta y su empresa. Con ?paso=empresa (ya hay sesión) solo pide la empresa. */
export function RegisterForm() {
  const router = useRouter();
  const onlyCompany = useSearchParams().get("paso") === "empresa";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (form: FormData) =>
    startTransition(async () => {
      setError(null);
      const company = String(form.get("company")).trim();
      if (!onlyCompany) {
        const { error } = await authClient.signUp.email({
          name: String(form.get("name")).trim(),
          email: String(form.get("email")).trim(),
          password: String(form.get("password")),
        });
        if (error) return setError(authErrorMessage(error));
      }
      const { error } = await authClient.organization.create({ name: company, slug: slugify(company) });
      if (error) return setError(authErrorMessage(error));
      router.replace("/cotizaciones/nueva");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">{onlyCompany ? "Crea tu empresa" : "Crear cuenta"}</CardTitle>
        <CardDescription>
          {onlyCompany ? "Tus cotizaciones se guardan dentro de tu empresa." : "Empieza a cotizar en minutos. Tus datos solo los ve tu empresa."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submit} className="grid gap-4">
          {!onlyCompany && (
            <div className="grid gap-1.5">
              <Label htmlFor="name">Tu nombre</Label>
              <Input id="name" name="name" autoComplete="name" required maxLength={100} autoFocus />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="company">Empresa</Label>
            <Input id="company" name="company" autoComplete="organization" required maxLength={100} placeholder="Ej. PUKIO S.A.C." autoFocus={onlyCompany} />
          </div>
          {!onlyCompany && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} aria-describedby="password-hint" />
                <p id="password-hint" className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres.
                </p>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="h-10" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} {onlyCompany ? "Crear empresa" : "Crear cuenta"}
          </Button>
          {!onlyCompany && (
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link href="/ingresar" className="font-semibold text-foreground underline underline-offset-2">
                Ingresar
              </Link>
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
