const MONTHS = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];

const moneyFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formatea un monto en céntimos: 153400 → "S/ 1,534.00". */
export const money = (cents: number) => "S/ " + moneyFormat.format((Number(cents) || 0) / 100);

export const formatDate = (d: Date) =>
  String(d.getDate()).padStart(2, "0") + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 864e5);

/** Nombre de archivo del PDF: CODIGO_Cliente.pdf */
export const pdfFileName = (code: string, client: string) =>
  `${code || "COT"}_${(client || "cotizacion").replace(/[^\wÀ-ÿ]+/g, "_")}.pdf`;
