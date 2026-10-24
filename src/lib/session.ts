import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./prisma";

// Capa de acceso (DAL): el único lugar donde se lee la sesión. Toda página, Server Action
// y consulta pasa por aquí para saber quién es el usuario y a qué empresa pertenece.

export interface Viewer {
  userId: string;
  name: string;
  email: string;
  organization: { id: string; name: string; logo: string | null; headerLine1: string; headerLine2: string };
}

/** Sesión actual con su empresa activa (o null). Se lee una vez por petición. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const orgId = session.session.activeOrganizationId;
  // La pertenencia se verifica siempre: un id de empresa en la sesión no basta
  const member = await prisma.member.findFirst({
    where: { userId: session.user.id, ...(orgId ? { organizationId: orgId } : {}) },
    orderBy: { createdAt: "asc" },
    include: { organization: { select: { id: true, name: true, logo: true, headerLine1: true, headerLine2: true } } },
  });
  if (!member) return null;
  return { userId: session.user.id, name: session.user.name, email: session.user.email, organization: member.organization };
});

/** Para páginas: redirige a /ingresar (o a crear empresa) si no hay sesión válida. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer) return viewer;
  const session = await auth.api.getSession({ headers: await headers() });
  redirect(session ? "/registro?paso=empresa" : "/ingresar");
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Tu sesión expiró. Vuelve a ingresar.");
  }
}

/** Para Server Actions: lanza si no hay sesión (no redirige en medio de una acción). */
export async function requireOrgId(): Promise<string> {
  const viewer = await getViewer();
  if (!viewer) throw new UnauthorizedError();
  return viewer.organization.id;
}
