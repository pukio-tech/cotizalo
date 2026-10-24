// Utilidades, cálculos y formato compartidos entre el editor y el listado.
// Trabajan sobre una cotización "normalizada":
// { code, client, plan, days, margin, igv, months, hdr: {on,name,l1,l2}, initial: [], recurring: [], incl: [], cond: [] }

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = n => 'S/ ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
const fdate = d => String(d.getDate()).padStart(2, '0') + ' ' + MES[d.getMonth()] + ' ' + d.getFullYear();
const fillDays = (s, days) => String(s ?? '').replace(/\{dias\}/g, days);

const IGV_RATE = 0.18;
const unit = (it, m) => (Number(it.cost) || 0) * (1 + (Number(m) || 0) / 100);
const isAnnual = it => it.per === 'anual';

function sums(list, m, igv) {
  const sub = (list || []).reduce((s, i) => s + unit(i, m) * (Number(i.cant) || 1), 0);
  const t = igv ? sub * IGV_RATE : 0;
  return { sub, igv: t, tot: sub + t };
}

// Totales y qué bloques tienen contenido (para mostrar u ocultar secciones)
function quoteTotals(q) {
  const recurring = q.recurring || [];
  const monthly = recurring.filter(i => !isAnnual(i)), annual = recurring.filter(isAnnual);
  const a = sums(q.initial, q.margin, q.igv), mo = sums(monthly, q.margin, q.igv), an = sums(annual, q.margin, q.igv);
  const has = { initial: (q.initial || []).length > 0, monthly: monthly.length > 0, annual: annual.length > 0 };
  return { a, mo, an, y1: a.tot + mo.tot * q.months + an.tot, has };
}

// Filas del resumen de pagos: solo los tipos de pago presentes.
// Devuelve [] si el resumen no aporta (un único tipo de pago y sin mensualidades que proyectar).
function summaryRows(q, t = quoteTotals(q)) {
  const rows = [];
  if (t.has.initial) rows.push(['Pago inicial (único)', t.a.tot]);
  if (t.has.monthly) rows.push(['Renovación mensual (desde el mes 2 de servicio)', t.mo.tot]);
  if (t.has.annual) rows.push(['Renovación anual (dominios y similares)', t.an.tot]);
  return rows.length > 1 || t.has.monthly ? rows : [];
}

// Convierte un registro de la API (Prisma) al formato normalizado
function fromRecord(r) {
  const its = r.items || [];
  const pick = i => ({ desc: i.desc || '', detail: i.detail || '', per: i.per || 'mensual', cant: i.cant || 1, cost: i.cost || 0 });
  return {
    id: r.id,
    code: r.code || '',
    client: r.client || '',
    plan: r.plan || '',
    days: r.days ?? 15,
    margin: r.margin ?? 30,
    igv: r.igv ?? true,
    months: r.months ?? 12,
    hdr: { on: Boolean(r.hdrOn), name: r.hdrName || '', l1: r.hdrL1 || '', l2: r.hdrL2 || '' },
    initial: its.filter(i => i.type === 'initial').map(pick),
    recurring: its.filter(i => i.type === 'recurring').map(pick),
    incl: (r.includes || []).map(i => i.text),
    cond: (r.conditions || []).map(c => c.text),
    createdAt: r.createdAt
  };
}
