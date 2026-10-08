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

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const money = n => 'S/ ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
const fdate = d => String(d.getDate()).padStart(2, '0') + ' ' + MES[d.getMonth()] + ' ' + d.getFullYear();
const cfg = () => ({ m: S.margin, igv: S.igv, days: S.days, months: S.months });
const unit = (it, m) => (Number(it.cost) || 0) * (1 + (Number(m) || 0) / 100);

function sums(list, m, igv) {
  const sub = (list || []).reduce((s, i) => s + unit(i, m) * (Number(i.cant) || 1), 0);
  const t = igv ? sub * 0.18 : 0;
  return { sub, igv: t, tot: sub + t };
}

function totals() {
  const c = cfg();
  const a = sums(items.initial, c.m, c.igv);
  const mo = sums((items.recurring || []).filter(i => i.per === 'mensual'), c.m, c.igv);
  const an = sums((items.recurring || []).filter(i => i.per === 'anual'), c.m, c.igv);
  return { a, mo, an, y1: a.tot + mo.tot * c.months + an.tot };
}

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
  + (S[k] || []).map((t, i) => `<li class="flex justify-between gap-3 py-2 text-sm"><span>${esc(t.replace('{dias}', S.days))}</span><button class="text-xs font-semibold underline shrink-0" onclick="editText('${k}',${i})">Editar</button></li>`).join('')
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
    v.push('<h2 class="text-lg font-bold text-[#141c31]">2. Pago inicial (único)</h2><p class="text-xs text-neutral-500">Desarrollo y puesta en marcha. Toca un servicio para editarlo.</p>', itemList('initial'),
      `<div class="card space-y-1 text-sm">${row('Subtotal', t.a.sub)}${S.igv ? row('IGV (18%)', t.a.igv) : ''}${row('Total a pagar al inicio', t.a.tot, 1)}</div>`);
  } else if (step === 2) {
    v.push('<h2 class="text-lg font-bold text-[#141c31]">3. Planes y servicios renovables</h2><p class="text-xs text-neutral-500">Dominios, hosting y suscripciones recurrentes.</p>', itemList('recurring'),
      `<div class="card space-y-1 text-sm">${row('Total mensual' + (S.igv ? ' + IGV' : ''), t.mo.tot)}${row('Total anual' + (S.igv ? ' + IGV' : ''), t.an.tot)}</div>`);
  } else if (step === 3) {
    v.push('<h2 class="text-lg font-bold text-[#141c31]">4. Incluye y condiciones</h2>', textList('incl', 'Incluye', 'Lo que recibe el cliente con esta cotización.'), textList('cond', 'Condiciones', 'Plazos, formas de pago y términos.'));
  } else {
    v.push('<h2 class="text-lg font-bold text-[#141c31]">5. Resumen de pagos</h2>',
      `<div class="card space-y-1.5 text-sm"><p class="font-bold text-base text-[#141c31]">${esc(S.client) || 'Cotización'}</p><p class="text-neutral-500 pb-2">${esc(S.code)}</p>
      ${row('Pago inicial (único)', t.a.tot)}${row('Renovación mensual', t.mo.tot)}${row('Renovación anual', t.an.tot)}${row('Total primer año', t.y1, 1)}
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

function buildPDF() {
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' }), c = cfg();
  const W = 210, M = 16, R = W - M, INK = [20, 28, 49], GR = [100, 116, 139];
  let y = 18;
  const need = h => { if (y + h > 282) { doc.addPage(); y = 18 } };
  const txt = (t, x, yy, o = {}) => { doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 9); doc.setTextColor(...(o.c || INK)); doc.text(t, x, yy, { align: o.a || 'left' }) };
  const now = new Date(), exp = new Date(now.getTime() + c.days * 864e5);

  if (S.hdr.on && (S.hdr.name || S.hdr.l1 || S.hdr.l2)) {
    if (S.hdr.name) { txt(S.hdr.name, M, y, { b: 1, s: 16 }); y += 5 }
    [S.hdr.l1, S.hdr.l2].filter(Boolean).forEach(l => { txt(l, M, y, { s: 8.5, c: GR }); y += 4.5 }); y += 6;
  }
  txt('C O T I Z A C I Ó N', M, y, { b: 1, s: 17 }); y += 6.5;
  txt(S.code, M, y, { b: 1, s: 10.5 }); y += 5.5;
  txt(`Fecha ${fdate(now)}  ·  válida hasta ${fdate(exp)}`, M, y, { s: 9, c: GR }); y += 8;
  txt('Cliente: ', M, y, { b: 1 }); txt(S.client || '-', M + 16, y); y += 5.5;
  txt('Plan propuesto: ', M, y, { b: 1 }); txt(S.plan || '-', M + 27, y); y += 9;

  const table = (list, withPer) => {
    const body = [], n = withPer ? 5 : 4;
    list.forEach(it => {
      const u = unit(it, c.m), free = !u;
      const r = [{ content: it.desc, styles: { fontStyle: 'bold' } }];
      if (withPer) r.push(it.per === 'anual' ? 'Anual' : 'Mensual');
      r.push(String(it.cant), free ? 'Incluido' : money(u), free ? 'Incluido' : money(u * it.cant));
      if (it.detail) { r._pad = 1; body.push(r); const d = [{ content: it.detail, colSpan: n, styles: { fontSize: 8, textColor: GR } }]; d._last = 1; d._detail = 1; body.push(d) }
      else { r._last = 1; body.push(r) }
    });
    const head = ['Descripción'].concat(withPer ? ['Periodo'] : [], ['Cant.', 'P. unitario', 'Importe']);
    const cs = withPer ? { 1: { cellWidth: 20 }, 2: { cellWidth: 13, halign: 'center' }, 3: { cellWidth: 28, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' } } : { 1: { cellWidth: 14, halign: 'center' }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 30, halign: 'right' } };
    doc.autoTable({
      startY: y, margin: { left: M, right: M }, head: [head], body, theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: { top: 2, bottom: 2, left: 1, right: 1 } },
      headStyles: { fontStyle: 'bold', fontSize: 8.5, textColor: GR }, columnStyles: cs,
      didParseCell: d => {
        if (d.section === 'body') { if (d.row.raw._pad) d.cell.styles.cellPadding = { top: 2, bottom: 0.4, left: 1, right: 1 }; if (d.row.raw._detail) d.cell.styles.cellPadding = { top: 0, bottom: 2.2, left: 1, right: 1 } }
        if (d.section === 'head' && d.column.index >= (withPer ? 2 : 1)) d.cell.styles.halign = d.column.index === (withPer ? 2 : 1) && withPer ? 'center' : (withPer ? 'right' : (d.column.index === 1 ? 'center' : 'right'))
      },
      didDrawCell: d => {
        const yy = d.cell.y + d.cell.height;
        if (d.section === 'head') { doc.setDrawColor(...INK); doc.setLineWidth(.35); doc.line(d.cell.x, yy, d.cell.x + d.cell.width, yy) }
        else if (d.section === 'body' && d.row.raw._last) { doc.setDrawColor(215, 215, 215); doc.setLineWidth(.15); doc.line(d.cell.x, yy, d.cell.x + d.cell.width, yy) }
      }
    });
    y = doc.lastAutoTable.finalY + 4;
  };
  const drawTotals = rows => {
    rows.forEach(([l, v, b]) => {
      need(7);
      if (b) { doc.setDrawColor(...INK); doc.setLineWidth(.3); doc.line(R - 78, y - 3.8, R, y - 3.8) }
      txt(l, R - 78, y, { b, s: b ? 10 : 9, c: b ? INK : GR }); txt(money(v), R, y, { b, s: b ? 10 : 9, a: 'right' }); y += b ? 7 : 5.2
    }); y += 3
  };

  need(40); txt('1. Pago inicial (único)', M, y, { b: 1, s: 12 }); y += 4;
  table(items.initial, false);
  const a = sums(items.initial, c.m, c.igv);
  drawTotals([['Subtotal', a.sub]].concat(c.igv ? [['IGV (18%)', a.igv]] : [], [['Total a pagar al inicio', a.tot, 1]]));

  need(40); txt('2. Planes y servicios renovables', M, y, { b: 1, s: 12 }); y += 4;
  table(items.recurring, true);
  const mo = sums(items.recurring.filter(i => i.per === 'mensual'), c.m, c.igv), an = sums(items.recurring.filter(i => i.per === 'anual'), c.m, c.igv);
  const blk = (t, s) => [[`Subtotal ${t}`, s.sub]].concat(c.igv ? [[`IGV (18%) ${t}`, s.igv]] : [], [[`Total ${t}${c.igv ? ' + IGV':''}`, s.tot, 1]]);
  drawTotals(blk('mensual', mo).concat(blk('anual', an)));

  const lines = id => S[id].map(s => s.replace('{dias}', c.days));
  const bullets = (title, arr) => {
    need(14); txt(title, M, y, { b: 1, s: 10.5 }); y += 5.5;
    arr.forEach(l => {
      const w = doc.setFont('helvetica', 'normal').setFontSize(9).splitTextToSize(l, R - M - 6); need(w.length * 4.2 + 2);
      txt('•', M + 1, y); w.forEach(s => { txt(s, M + 6, y); y += 4.2 }); y += 0.8
    }); y += 3
  };
  bullets('Incluye:', lines('incl'));

  const y1 = a.tot + mo.tot * c.months + an.tot;
  need(34); txt('Resumen de pagos', M, y, { b: 1, s: 12 }); y += 6;
  [['Pago inicial (único)', a.tot], ['Renovación mensual (desde el mes 2 de servicio)', mo.tot], ['Renovación anual (dominios y similares)', an.tot]].forEach(([l, v]) => { txt(l, M, y); txt(money(v), R, y, { a: 'right' }); y += 5.5 });
  doc.setDrawColor(...INK); doc.setLineWidth(.4); doc.line(M, y - 3.5, R, y - 3.5);
  txt('Total primer año', M, y + 1, { b: 1, s: 11 }); txt(money(y1), R, y + 1, { b: 1, s: 11, a: 'right' }); y += 6;
  txt(c.igv ? 'Montos con IGV incluido.' : 'Montos sin IGV.', R, y, { s: 8, c: GR, a: 'right' }); y += 9;

  bullets('Condiciones', lines('cond'));

  need(26); y += 12;
  doc.setDrawColor(...INK); doc.setLineWidth(.3); doc.line(R - 60, y, R, y);
  txt('Conformidad del cliente', R, y + 5, { s: 9, a: 'right' });

  doc.fname = `${S.code}_${(S.client || 'cotizacion').replace(/[^\wÀ-ÿ]+/g, '_')}.pdf`;
  return doc;
}

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

async function fetchQuotations() {
  try {
    const res = await fetch('/api/quotations');
    if (!res.ok) throw new Error('Error al conectar con la base de datos');
    allQuotations = await res.json();
    if ($('badgeCount')) $('badgeCount').textContent = allQuotations.length;

    // Check if URL has ?id=...
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');
    if (idParam) {
      const found = allQuotations.find(q => q.id === idParam);
      if (found) loadQuotationIntoState(found);
    }
  } catch (err) {
    console.error('Error cargando cotizaciones:', err);
  }
}

function loadQuotationIntoState(q) {
  S.id = q.id;
  S.code = q.code || '';
  S.client = q.client || '';
  S.plan = q.plan || '';
  S.days = q.days || 15;
  S.margin = q.margin !== undefined ? q.margin : 30;
  S.igv = q.igv !== undefined ? q.igv : true;
  S.months = q.months !== undefined ? q.months : 12;
  S.hdr = {
    on: Boolean(q.hdrOn),
    name: q.hdrName || '',
    l1: q.hdrL1 || '',
    l2: q.hdrL2 || ''
  };

  items.initial = (q.items || [])
    .filter(i => i.type === 'initial')
    .map(i => ({ desc: i.desc, detail: i.detail || '', cant: i.cant || 1, cost: i.cost || 0 }));

  items.recurring = (q.items || [])
    .filter(i => i.type === 'recurring')
    .map(i => ({ desc: i.desc, detail: i.detail || '', per: i.per || 'mensual', cant: i.cant || 1, cost: i.cost || 0 }));

  S.incl = (q.includes || []).map(inc => inc.text);
  S.cond = (q.conditions || []).map(con => con.text);

  render();
}

async function saveToDatabase() {
  const btn = $('btnSaveDB');
  const lbl = $('saveLabel');
  if (btn) btn.disabled = true;
  if (lbl) lbl.textContent = 'Guardando...';

  const payload = {
    client: S.client || 'Cliente sin nombre',
    code: S.code,
    plan: S.plan || 'Propuesta Comercial',
    days: S.days,
    margin: S.margin,
    igv: S.igv,
    months: S.months,
    hdr: S.hdr,
    items: items,
    incl: S.incl,
    cond: S.cond
  };

  try {
    let res;
    if (S.id) {
      res = await fetch(`/api/quotations/${S.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) throw new Error('Error al guardar en el servidor');
    const saved = await res.json();
    S.id = saved.id;
    await fetchQuotations();
    alert('Cotización guardada exitosamente');
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
    if (lbl) lbl.textContent = 'Guardar';
  }
}

function createNewQuotation() {
  const nextNum = String(allQuotations.length + 1).padStart(3, '0');
  S = {
    id: null,
    client: "",
    code: `COT-${new Date().getFullYear()}-${nextNum}`,
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

  items = {
    initial: [],
    recurring: []
  };

  step = 0;
  render();
}

async function duplicateCurrentQuotation() {
  const baseCode = S.code || 'COT';
  const newCode = `${baseCode}-COPIA`;
  
  const payload = {
    client: S.client ? `${S.client} (Copia)` : 'Copia',
    code: newCode,
    plan: S.plan,
    days: S.days,
    margin: S.margin,
    igv: S.igv,
    months: S.months,
    hdr: S.hdr,
    items: items,
    incl: S.incl,
    cond: S.cond
  };

  try {
    const res = await fetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al duplicar');
    const duplicated = await res.json();
    await fetchQuotations();
    loadQuotationIntoState(duplicated);
    alert(`Cotización duplicada: ${duplicated.code}`);
  } catch (err) {
    alert('Error al duplicar: ' + err.message);
  }
}

// Initial Boot
render();
fetchQuotations();
