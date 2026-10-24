import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { prisma } from "./prisma";

// Autenticación con Better Auth: email + contraseña y empresas (plugin de organizaciones).
// Variables: BETTER_AUTH_SECRET (obligatoria en producción), BETTER_AUTH_URL (opcional),
// DISABLE_SIGNUP=true para cerrar el registro y COTIZALO_OWNER_EMAIL para adoptar las cotizaciones antiguas.

const vercel = (host?: string) => (host ? `https://${host}` : undefined);

export const auth = betterAuth({
  appName: "Cotízalo",
  baseURL: process.env.BETTER_AUTH_URL ?? vercel(process.env.VERCEL_URL),
  // En Vercel la app se abre por varias URLs (producción, rama, despliegue)
  trustedOrigins: [vercel(process.env.VERCEL_URL), vercel(process.env.VERCEL_BRANCH_URL), vercel(process.env.VERCEL_PROJECT_PRODUCTION_URL)].filter(
    (o): o is string => !!o
  ),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    disableSignUp: process.env.DISABLE_SIGNUP === "true",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 días
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    session: {
      create: {
        // Al iniciar sesión, la empresa activa es la primera a la que pertenece el usuario
        before: async (session) => {
          const member = await prisma.member.findFirst({ where: { userId: session.userId }, orderBy: { createdAt: "asc" } });
          return { data: { ...session, activeOrganizationId: member?.organizationId ?? null } };
        },
      },
    },
  },
  plugins: [
    organization({
      organizationHooks: {
        // Las cotizaciones creadas antes de la Fase 4 (sin empresa) pasan a la empresa del dueño
        afterCreateOrganization: async ({ organization, user }) => {
          const owner = process.env.COTIZALO_OWNER_EMAIL?.trim().toLowerCase();
          if (owner && user.email.toLowerCase() === owner) {
            await prisma.quotation.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } });
          }
        },
      },
    }),
    nextCookies(), // debe ir al final: guarda las cookies cuando se llama desde Server Actions
  ],
});
