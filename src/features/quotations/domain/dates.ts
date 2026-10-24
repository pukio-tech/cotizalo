// Fechas de emisión como "AAAA-MM-DD" en hora de Lima: así una cotización emitida a las 9 p. m.
// no aparece con la fecha del día siguiente (UTC).

const TZ = "America/Lima";
const isoFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Date → "AAAA-MM-DD" en hora de Lima. */
export const toISODate = (d: Date) => isoFormat.format(d);

/** "AAAA-MM-DD" → Date a mediodía UTC (estable en cualquier zona horaria del continente). */
export const fromISODate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

/** "AAAA-MM-DD" → Date local (para mostrar y calcular días en el navegador o el PDF). */
export const localDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Fecha de vencimiento: emisión + días de validez, "AAAA-MM-DD". */
export const expiryISODate = (issuedAt: string, days: number) => {
  const d = fromISODate(issuedAt);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
