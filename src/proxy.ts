import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Comprobación optimista: sin cookie de sesión, a /ingresar. La validación real
// (sesión vigente y pertenencia a la empresa) la hace src/lib/session.ts en cada acceso.

const PUBLIC = ["/ingresar", "/registro", "/p/"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();
  const url = new URL("/ingresar", request.url);
  if (pathname !== "/") url.searchParams.set("volver", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Todo excepto la API de auth, los archivos de Next y estáticos
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
