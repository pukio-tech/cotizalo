"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [organizationClient()] });

/** Mensajes de Better Auth en español (los más comunes). */
export function authErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  switch (error?.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Correo o contraseña incorrectos.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Ya existe una cuenta con ese correo.";
    case "PASSWORD_TOO_SHORT":
      return "La contraseña debe tener al menos 8 caracteres.";
    case "INVALID_EMAIL":
      return "El correo no es válido.";
    case "EMAIL_PASSWORD_SIGN_UP_DISABLED":
      return "El registro está cerrado. Pide acceso al administrador.";
    case "ORGANIZATION_ALREADY_EXISTS":
      return "Ya existe una empresa con ese identificador.";
    default:
      return error?.message || "No se pudo completar la operación.";
  }
}
