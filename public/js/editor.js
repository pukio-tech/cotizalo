// State Definition
let S = {
  id: null,
  client: "",
  code: "COT-" + new Date().getFullYear() + "-001",
  plan: "",
  days: 15,
  margin: 30,
  igv: true,
  months: 12,
  hdr: { on: false, name: "", l1: "", l2: "" },
  incl: [],
  cond: [
    "Precios en soles (S/). Cotización válida por {dias} días desde su emisión.",
    "50% al inicio del desarrollo y 50% a la entrega del proyecto.",
    "Medios de pago: Transferencia BCP / Yape / Plin."
  ]
};

let items = {
  initial: [],
  recurring: []
};

let allQuotations = [];
const STEPS = ["Datos", "Pago inicial", "Renovables", "Incluye y condiciones", "Resumen"];
let step = 0;

const cfg = () => ({ m: S.margin, igv: S.igv, days: S.days, months: S.months });

// Cotización en edición en el formato normalizado de core.js
const current = () => ({ ...S, initial: items.initial, recurring: items.recurring });
const totals = () => quoteTotals(current());

function field(f) {
  const id = 'f_' + f.k, v = f.v;
  if (f.t === 'check') return `<label class="flex items-center gap-2 mt-3 text-sm font-semibold text-neutral-800"><input id="${id}" type="checkbox" ${v ? 'checked' : ''}> ${f.l}</label>`;
  let el;
  if (f.t === 'select') el = `<select id="${id}" class="inp">${f.o.map(o => `<option value="${o[0]}" ${String(o[0]) === String(v) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  else if (f.t === 'area') el = `<textarea id="${id}" rows="3" class="inp">${esc(v)}</textarea>`;
  else el = `<input id="${id}" type="${f.t || 'text'}" ${f.t === 'number' ? 'min="0" step="any"' : ''} value="${esc(v)}" class="inp">`;
  return `<label class="lbl" for="${id}">${f.l}</label>${el}${f.h ? `<p class="text-xs text-neutral-500 mt-1">${f.h}</p>` : ''}`;
}

function panel(o) {
  $('ov').className = '';
  $('ov').innerHTML = `<div class="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onclick="closeP()"></div>
  <div class="fixed z-50 bg-white shadow-2xl p-6 overflow-y-auto top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-lg max-h-[90%] rounded-xl border border-neutral-200">
    <h3 class="text-lg font-bold text-neutral-900">${o.title}</h3>
    ${o.fields.map(field).join('')}
    <div class="flex gap-2 mt-6 pt-2 border-t border-neutral-100">
      <button class="btn pri" onclick="saveP()">Guardar</button>
      <button class="btn sec" onclick="closeP()">Cancelar</button>
      ${o.del ? '<button class="btn sec ml-auto text-red-600 border-red-300 hover:bg-red-50" onclick="delP()">Eliminar</button>' : ''}
    </div></div>`;
  window._p = o;
}

function closeP() {
  $('ov').className = 'hidden';
  $('ov').innerHTML = '';
}

function saveP() {
  const v = {};
  _p.fields.forEach(f => {
    const e = $('f_' + f.k);
    v[f.k] = f.t === 'check' ? e.checked : f.t === 'number' ? (parseFloat(e.value) || 0) : e.value;
  });
  _p.save(v);
  closeP();
  render();
}

function delP() {
  _p.del();
  closeP();
  render();
}

function editClient() {
  panel({
    title: "Cliente y cotización",
    fields: [
      { k: 'client', l: 'Nombre del cliente', v: S.client },
      { k: 'code', l: 'Código de cotización', v: S.code },
      { k: 'plan', l: 'Plan propuesto', v: S.plan },
      { k: 'days', l: 'Días de validez', t: 'number', v: S.days }
    ],
    save: v => Object.assign(S, v, { days: v.days || 15 })
  });
}

function editPrices() {
  panel({
    title: "Precios e impuestos",
    fields: [
      { k: 'margin', l: 'Margen de ganancia (%)', t: 'number', v: S.margin, h: 'Se suma al costo base de cada servicio. No aparece en el PDF.' },
      { k: 'igv', l: 'IGV (18%)', t: 'select', o: [['1', 'Se suma al total'], ['0', 'Precios netos (sin IGV)']], v: S.igv ? '1' : '0' },
      { k: 'months', l: 'Mensualidades a cobrar en el primer año', t: 'number', v: S.months, h: 'Entre 0 y 12.' }
    ],
    save: v => {
      S.margin = v.margin;
      S.igv = v.igv === '1';
      S.months = Math.min(12, Math.max(0, Math.round(v.months)));
    }
  });
}

function editHdr() {
  panel({
    title: "Cabecera del PDF",
    fields: [
      { k: 'on', l: 'Mostrar cabecera en el PDF', t: 'check', v: S.hdr.on },
      { k: 'name', l: 'Nombre o razón social', v: S.hdr.name },
      { k: 'l1', l: 'Línea 1 (teléfono, correo)', v: S.hdr.l1 },
      { k: 'l2', l: 'Línea 2 (web, dirección)', v: S.hdr.l2 }
    ],
    save: v => S.hdr = v
  });
}

function editItem(k, i) {
  const isNew = i < 0, it = isNew ? { desc: '', detail: '', per: 'mensual', cant: 1, cost: 0 } : items[k][i];
  const f = [{ k: 'desc', l: 'Servicio', v: it.desc }, { k: 'detail', l: 'Detalle que verá el cliente', t: 'area', v: it.detail }];
  if (k === 'recurring') f.push({ k: 'per', l: 'Se renueva', t: 'select', o: [['mensual', 'Cada mes'], ['anual', 'Cada año']], v: it.per || 'mensual' });
  f.push({ k: 'cant', l: 'Cantidad', t: 'number', v: it.cant }, { k: 'cost', l: 'Costo base (S/)', t: 'number', v: it.cost, h: 'Con 0 se muestra como «Incluido».' });
  panel({
    title: isNew ? 'Agregar servicio' : 'Editar servicio',
    fields: f,
    save: v => {
      v.cant = v.cant || 1;
      if (isNew) items[k].push(v);
      else Object.assign(items[k][i], v);
    },
    del: isNew ? null : () => items[k].splice(i, 1)
  });
}

function editText(k, i) {
  const isNew = i < 0;
  panel({
    title: (isNew ? 'Agregar ' : 'Editar ') + (k === 'incl' ? 'punto de «Incluye»' : 'condición'),
    fields: [{ k: 't', l: 'Texto', t: 'area', v: isNew ? '' : S[k][i], h: k === 'cond' ? 'Usa {dias} para mostrar los días de validez.' : '' }],
    save: v => {
      if (!v.t.trim()) return;
      isNew ? S[k].push(v.t.trim()) : S[k][i] = v.t.trim();
    },
    del: isNew ? null : () => S[k].splice(i, 1)
  });
}

const card = (t, body, fn) => `<div class="card"><div class="flex justify-between items-start gap-3"><div class="min-w-0"><h3 class="font-bold text-[#141c31]">${t}</h3><div class="text-sm text-neutral-600 mt-1 space-y-0.5">${body}</div></div><button class="btn sec shrink-0" onclick="${fn}()">Editar</button></div></div>`;
const row = (l, v, b) => `<div class="flex justify-between ${b ? 'font-bold text-base border-t border-[#141c31] pt-2 mt-1 text-[#141c31]' : 'text-neutral-600'}"><span>${l}</span><span>${money(v)}</span></div>`;

function itemList(k) {
  const c = cfg(), list = items[k] || [];
  return (list.length ? list.map((it, i) => {
    const u = unit(it, c.m);
    return `<button onclick="editItem('${k}',${i})" class="card w-full text-left hover:border-cyan-400 flex justify-between gap-3">
    <span><b class="text-[#141c31]">${esc(it.desc)}</b>${k === 'recurring' ? `<span class="ml-2 text-xs border border-neutral-300 rounded px-1.5 py-0.5 font-medium">${it.per === 'anual' ? 'Anual' : 'Mensual'}</span>` : ''}<br><span class="text-xs text-neutral-500 mt-0.5 inline-block">${esc(it.detail)}</span></span>
    <span class="text-right font-semibold whitespace-nowrap">${u ? money(u * it.cant) : '<span class="text-cyan-700 font-bold">Incluido</span>'}${it.cant > 1 ? `<br><span class="text-xs font-normal text-neutral-500">${it.cant} × ${money(u)}</span>` : ''}</span></button>`;
  }).join('') : '<p class="text-sm text-neutral-400 py-2">Aún no hay servicios agregados.</p>')
  + `<button class="btn sec w-full py-2.5" onclick="editItem('${k}',-1)">+ Agregar servicio</button>`;
}

function textList(k, title, hint) {
  return `<div class="card"><h3 class="font-bold text-[#141c31]">${title}</h3><p class="text-xs text-neutral-500 mb-3">${hint}</p><ul class="divide-y divide-neutral-200">`
  + (S[k] || []).map((t, i) => `<li class="flex justify-between gap-3 py-2 text-sm"><span>${esc(fillDays(t, S.days))}</span><button class="text-xs font-semibold underline shrink-0" onclick="editText('${k}',${i})">Editar</button></li>`).join('')
  + `</ul><button class="btn sec mt-3" onclick="editText('${k}',-1)">+ Agregar</button></div>`;
}

function render() {
  $('activeCodeTitle').textContent = S.client ? `${S.code} · ${S.client}` : (S.code ? `${S.code} · (Sin cliente)` : '(Nueva cotización)');
  if ($('badgeCount')) $('badgeCount').textContent = allQuotations.length;
  $('steps').innerHTML = STEPS.map((s, i) => `<button onclick="go(${i})" class="px-3 py-2.5 text-sm whitespace-nowrap border-b-2 font-medium ${i === step ? 'border-[#141c31] font-bold text-[#141c31]' : 'border-transparent text-neutral-500 hover:text-neutral-800'}">${i + 1}. ${s}</button>`).join('');
  
  const t = totals(), v = [];
  if (step === 0) {
    v.push('<h2 class="text-lg font-bold text-[#141c31]">1. Datos de la cotización</h2>');
    v.push(card('Cliente', `<p class="font-semibold text-neutral-800">${esc(S.client) || '<span class="text-neutral-400 italic">Ingresa el nombre del cliente</span>'}</p><p>${esc(S.code)} ${S.plan ? '· ' + esc(S.plan) : ''}</p><p>Válida por ${S.days} días</p>`, 'editClient'));
    v.push(card('Precios e impuestos', `<p>Margen de ${S.margin}% · ${S.igv ? 'IGV 18% incluido en totales' : 'Precios netos'}</p><p>${S.months} mensualidad(es) en el primer año</p>`, 'editPrices'));
    v.push(card('Cabecera del PDF', S.hdr.on ? `<p class="font-semibold text-neutral-900">${esc(S.hdr.name) || '(sin nombre)'}</p><p>${esc(S.hdr.l1)}</p><p>${esc(S.hdr.l2)}</p>` : '<p class="text-neutral-400">Sin cabecera personalizada</p>', 'editHdr'));
  } else if (step === 1) {
    v.push('<h2 class="text-lg font-bold text-[#141c31]">2. Pago inicial (único)</h2><p class="text-xs text-neutral-500">Desarrollo y puesta en marcha. Toca un servicio para editarlo. Si no agregas ninguno, esta sección no aparece en el PDF.</p>', itemList('initial'));
    if (t.has.initial) v.push(`<div class="card space-y-1 text-sm">${row('Subtotal', t.a.sub)}${S.igv ? row('IGV (18%)', t.a.igv) : ''}${row('Total a pagar al inicio', t.a.tot, 1)}</div>`);
  } else if (step === 2) {
    v.push('<h2 class="text-lg font-bold text-[#141c31]">3. Planes y servicios renovables</h2><p class="text-xs text-neutral-500">Dominios, hosting y suscripciones recurrentes. Si no agregas ninguno, esta sección no aparece en el PDF.</p>', itemList('recurring'));
    if (t.has.monthly || t.has.annual) v.push(`<div class="card space-y-1 text-sm">${t.has.monthly ? row('Total mensual' + (S.igv ? ' + IGV' : ''), t.mo.tot) : ''}${t.has.annual ? row('Total anual' + (S.igv ? ' + IGV' : ''), t.an.tot) : ''}</div>`);
  } else if (step === 3) {
    v.push('<h2 class="text-lg font-bold text-[#141c31]">4. Incluye y condiciones</h2>', textList('incl', 'Incluye', 'Lo que recibe el cliente con esta cotización.'), textList('cond', 'Condiciones', 'Plazos, formas de pago y términos.'));
  } else {
    v.push('<h2 class="text-lg font-bold text-[#141c31]">5. Resumen de pagos</h2>',
      `<div class="card space-y-1.5 text-sm"><p class="font-bold text-base text-[#141c31]">${esc(S.client) || 'Cotización'}</p><p class="text-neutral-500 pb-2">${esc(S.code)}</p>
      ${t.has.initial ? row('Pago inicial (único)', t.a.tot) : ''}${t.has.monthly ? row('Renovación mensual', t.mo.tot) : ''}${t.has.annual ? row('Renovación anual', t.an.tot) : ''}${row('Total primer año', t.y1, 1)}
      <p class="text-xs text-neutral-500 pt-1">${S.igv ? 'Montos con IGV incluido.' : 'Montos sin IGV.'}</p></div>`,
      '<div class="flex gap-2"><button class="btn sec flex-1 py-3" onclick="previewPDF()">Vista previa</button><button class="btn pri flex-1 py-3" onclick="exportPDF()">Descargar PDF</button></div>',
      '<button class="btn btn-pukio w-full py-2.5 mt-2" onclick="saveToDatabase()">Guardar cotización</button>');
  }
  $('step_content').innerHTML = v.join('');
  $('nav').innerHTML = `<button class="btn sec ${step ? '' : 'invisible'}" onclick="go(step-1)">Anterior</button>${step < STEPS.length - 1 ? '<button class="btn pri" onclick="go(step+1)">Siguiente</button>' : '<button class="btn btn-pukio" onclick="saveToDatabase()">Guardar en BD</button>'}`;
}

function go(i) {
  step = i;
  render();
  window.scrollTo(0, 0);
}

const buildPDF = () => buildQuotationPDF(current());

function exportPDF() { const d = buildPDF(); d.save(d.fname) }
function previewPDF() {
  const d = buildPDF(), url = URL.createObjectURL(d.output('blob'));
  $('ov').className = '';
  $('ov').innerHTML = `<div class="fixed inset-0 bg-black/40 z-40" onclick="closeP()"></div>
  <div class="fixed z-50 bg-white shadow-xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[96%] max-w-4xl h-[92%] rounded-xl p-4 flex flex-col gap-3">
    <div class="flex justify-between items-center pb-2 border-b border-neutral-200">
      <h3 class="text-base font-bold">Vista previa del PDF</h3>
      <button onclick="closeP()" class="text-neutral-400 hover:text-neutral-600 font-bold">✕</button>
    </div>
    <iframe src="${url}" class="flex-1 w-full border border-neutral-300 rounded"></iframe>
    <div class="flex gap-2 flex-wrap"><button class="btn pri" onclick="exportPDF()">Descargar PDF</button><a class="btn sec" href="${url}" target="_blank">Abrir en otra pestaña</a><button class="btn sec ml-auto" onclick="closeP()">Cerrar</button></div>
  </div>`;
}

// ----------------- POSTGRESQL & PRISMA API -----------------

const DEFAULT_COND = [
  "Precios en soles (S/). Cotización válida por {dias} días desde su emisión.",
  "50% al inicio del desarrollo y 50% a la entrega del proyecto.",
  "Medios de pago: Transferencia BCP / Yape / Plin."
];

const api = async (url, method = 'GET', body) => {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error al conectar con el servidor');
  return res.json();
};

const payload = (over = {}) => ({
  client: S.client || 'Cliente sin nombre',
  code: S.code,
  plan: S.plan || 'Propuesta Comercial',
  days: S.days,
  margin: S.margin,
  igv: S.igv,
  months: S.months,
  hdr: S.hdr,
  items,
  incl: S.incl,
  cond: S.cond,
  ...over
});

// Mantiene ?id= en la URL para que recargar no pierda la cotización abierta
const setUrlId = id => history.replaceState(null, '', id ? `?id=${encodeURIComponent(id)}` : location.pathname);

async function fetchQuotations() {
  try {
    allQuotations = await api('/api/quotations');
    if ($('badgeCount')) $('badgeCount').textContent = allQuotations.length;
  } catch (err) {
    console.error('Error cargando cotizaciones:', err);
  }
}

function loadQuotationIntoState(r) {
  const q = fromRecord(r);
  S = { id: q.id, client: q.client, code: q.code, plan: q.plan, days: q.days, margin: q.margin, igv: q.igv, months: q.months, hdr: q.hdr, incl: q.incl, cond: q.cond };
  items = { initial: q.initial, recurring: q.recurring };
  setUrlId(q.id);
  render();
}

async function saveToDatabase() {
  const btn = $('btnSaveDB');
  const lbl = $('saveLabel');
  if (btn) btn.disabled = true;
  if (lbl) lbl.textContent = 'Guardando...';

  try {
    const saved = S.id ? await api(`/api/quotations/${S.id}`, 'PUT', payload()) : await api('/api/quotations', 'POST', payload());
    S.id = saved.id;
    setUrlId(saved.id);
    await fetchQuotations();
    render();
    alert('Cotización guardada exitosamente');
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
    if (lbl) lbl.textContent = 'Guardar';
  }
}

async function nextCode() {
  try {
    return (await api('/api/next-code')).nextCode;
  } catch (e) {
    return `COT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  }
}

async function createNewQuotation() {
  S = { id: null, client: "", code: await nextCode(), plan: "", days: 15, margin: 30, igv: true, months: 12, hdr: { on: false, name: "", l1: "", l2: "" }, incl: [], cond: [...DEFAULT_COND] };
  items = { initial: [], recurring: [] };
  step = 0;
  setUrlId(null);
  render();
}

// Duplica lo que está en pantalla (incluye cambios sin guardar) con el siguiente correlativo
async function duplicateCurrentQuotation() {
  try {
    const duplicated = await api('/api/quotations', 'POST', payload({ code: await nextCode(), client: S.client ? `${S.client} (Copia)` : 'Copia' }));
    await fetchQuotations();
    loadQuotationIntoState(duplicated);
    alert(`Cotización duplicada: ${duplicated.code}`);
  } catch (err) {
    alert('Error al duplicar: ' + err.message);
  }
}

async function init() {
  render();
  await fetchQuotations();
  const id = new URLSearchParams(location.search).get('id');
  if (id) {
    try { return loadQuotationIntoState(await api(`/api/quotations/${encodeURIComponent(id)}`)) }
    catch (err) { alert('No se pudo abrir la cotización: ' + err.message) }
  }
  await createNewQuotation();
}

init();
