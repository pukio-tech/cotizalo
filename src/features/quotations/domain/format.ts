const MONTHS = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];

const moneyFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (n: number) => "S/ " + moneyFormat.format(Number(n) || 0);

export const formatDate = (d: Date) =>
  String(d.getDate()).padStart(2, "0") + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 864e5);

/** Nombre de archivo del PDF: CODIGO_Cliente.pdf */
export const pdfFileName = (code: string, client: string) =>
  `${code || "COT"}_${(client || "cotizacion").replace(/[^\wÀ-ÿ]+/g, "_")}.pdf`;
