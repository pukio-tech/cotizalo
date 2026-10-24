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
import { safeRedirect } from "./safe-redirect";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (form: FormData) =>
    startTransition(async () => {
      setError(null);
      const { error } = await authClient.signIn.email({ email: String(form.get("email")), password: String(form.get("password")) });
      if (error) return setError(authErrorMessage(error));
      router.replace(safeRedirect(params.get("volver")));
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">Ingresar</CardTitle>
        <CardDescription>Accede a las cotizaciones de tu empresa.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="h-10" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Ingresar
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-foreground underline underline-offset-2">
              Crear cuenta
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
