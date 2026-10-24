/** Solo rutas internas ("/algo"), nunca "//otro-sitio" ni URLs absolutas: evita redirecciones abiertas. */
export function safeRedirect(path: string | null | undefined, fallback = "/cotizaciones") {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : fallback;
}

/** Identificador de empresa a partir del nombre: "Pukio S.A.C." → "pukio-sac-x7k2" */
export function slugify(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "empresa"}-${Math.random().toString(36).slice(2, 6)}`;
}
