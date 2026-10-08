let allQuotations = [];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const money = n => 'S/ ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
const fdate = d => String(d.getDate()).padStart(2, '0') + ' ' + MES[d.getMonth()] + ' ' + d.getFullYear();

async function fetchQuotations() {
  try {
    const res = await fetch('/api/quotations');
    if (!res.ok) throw new Error('Error al conectar con la base de datos');
    allQuotations = await res.json();
    if ($('badgeCount')) $('badgeCount').textContent = allQuotations.length;
    renderQuotationsTable();
  } catch (err) {
    console.error('Error cargando cotizaciones:', err);
    const tbody = $('quotationsTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-red-600">Error al cargar cotizaciones del servidor.</td></tr>`;
  }
}

function renderQuotationsTable(filter = '') {
  const tbody = $('quotationsTableBody');
  if (!tbody) return;

  const q = (filter || '').toLowerCase().trim();
  const list = allQuotations.filter(item => 
    (item.client || '').toLowerCase().includes(q) ||
    (item.code || '').toLowerCase().includes(q) ||
    (item.plan || '').toLowerCase().includes(q)
  );

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-neutral-400">No se encontraron cotizaciones registradas. Crea una nueva con el botón "+ Crear".</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    return `
    <tr class="hover:bg-cyan-50/30 transition-colors">
      <td class="py-3.5 px-4 font-mono font-bold text-[#141c31]">${esc(item.code)}</td>
      <td class="py-3.5 px-4 font-medium text-neutral-800">${esc(item.client) || '<span class="text-neutral-400 italic">Sin cliente</span>'}</td>
      <td class="py-3.5 px-4 text-neutral-600">${esc(item.plan) || '-'}</td>
      <td class="py-3.5 px-4 text-center text-neutral-500">${item.days} días</td>
      <td class="py-3.5 px-4 text-right text-neutral-500 font-mono">${dateStr}</td>
      <td class="py-3.5 px-4 text-right whitespace-nowrap">
        <button onclick="previewQuotationPDF('${item.id}')" class="btn btn-pukio text-xs py-1 px-2.5 mr-1" title="Ver PDF rápidamente">
          <svg class="w-3.5 h-3.5 inline-block -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
          </svg>
          Ver PDF
        </button>
        <a href="/index.html?id=${item.id}" class="btn pri text-xs py-1 px-2.5 mr-1">
          Editar
        </a>
        <button onclick="duplicateQuotation('${item.id}')" class="btn sec text-xs py-1 px-2 mr-1" title="Duplicar cotización">
          Duplicar
        </button>
        <button onclick="deleteQuotation('${item.id}', '${esc(item.code)}')" class="btn sec text-xs py-1 px-2 text-red-600 hover:bg-red-50" title="Eliminar">
          ✕
        </button>
      </td>
    </tr>`;
  }).join('');
}

function filterTable(val) {
  renderQuotationsTable(val);
}

// ----------------- PDF BUILDER & PREVIEW MODAL -----------------

function buildPDFFromData(q) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16, R = W - M, INK = [20, 28, 49], GR = [100, 116, 139];
  let y = 18;

  const margin = Number(q.margin) || 0;
  const igv = Boolean(q.igv);
  const days = Number(q.days) || 15;
  const months = Number(q.months) || 12;

  const unit = it => (Number(it.cost) || 0) * (1 + margin / 100);
  const sums = list => {
    const sub = (list || []).reduce((s, i) => s + unit(i) * (Number(i.cant) || 1), 0);
    const t = igv ? sub * 0.18 : 0;
    return { sub, igv: t, tot: sub + t };
  };

  const initialItems = (q.items || []).filter(i => i.type === 'initial');
  const recurringItems = (q.items || []).filter(i => i.type === 'recurring');

  const need = h => { if (y + h > 282) { doc.addPage(); y = 18 } };
  const txt = (t, x, yy, o = {}) => {
    doc.setFont('helvetica', o.b ? 'bold' : 'normal');
    doc.setFontSize(o.s || 9);
    doc.setTextColor(...(o.c || INK));
    doc.text(t, x, yy, { align: o.a || 'left' });
  };

  const now = new Date(q.createdAt || Date.now());
  const exp = new Date(now.getTime() + days * 864e5);

  if (q.hdrOn && (q.hdrName || q.hdrL1 || q.hdrL2)) {
    if (q.hdrName) { txt(q.hdrName, M, y, { b: 1, s: 16 }); y += 5; }
    [q.hdrL1, q.hdrL2].filter(Boolean).forEach(l => { txt(l, M, y, { s: 8.5, c: GR }); y += 4.5; });
    y += 6;
  }

  txt('C O T I Z A C I Ó N', M, y, { b: 1, s: 17 }); y += 6.5;
  txt(q.code || 'COT', M, y, { b: 1, s: 10.5 }); y += 5.5;
  txt(`Fecha ${fdate(now)}  ·  válida hasta ${fdate(exp)}`, M, y, { s: 9, c: GR }); y += 8;
  txt('Cliente: ', M, y, { b: 1 }); txt(q.client || '-', M + 16, y); y += 5.5;
  txt('Plan propuesto: ', M, y, { b: 1 }); txt(q.plan || '-', M + 27, y); y += 9;

  const table = (list, withPer) => {
    const body = [], n = withPer ? 5 : 4;
    list.forEach(it => {
      const u = unit(it), free = !u;
      const r = [{ content: it.desc, styles: { fontStyle: 'bold' } }];
      if (withPer) r.push(it.per === 'anual' ? 'Anual' : 'Mensual');
      r.push(String(it.cant), free ? 'Incluido' : money(u), free ? 'Incluido' : money(u * it.cant));
      if (it.detail) {
        r._pad = 1;
        body.push(r);
        const d = [{ content: it.detail, colSpan: n, styles: { fontSize: 8, textColor: GR } }];
        d._last = 1;
        d._detail = 1;
        body.push(d);
      } else {
        r._last = 1;
        body.push(r);
      }
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

  if (initialItems.length > 0) {
    need(40); txt('1. Pago inicial (único)', M, y, { b: 1, s: 12 }); y += 4;
    table(initialItems, false);
    const a = sums(initialItems);
    drawTotals([['Subtotal', a.sub]].concat(igv ? [['IGV (18%)', a.igv]] : [], [['Total a pagar al inicio', a.tot, 1]]));
  }

  if (recurringItems.length > 0) {
    need(40); txt('2. Planes y servicios renovables', M, y, { b: 1, s: 12 }); y += 4;
    table(recurringItems, true);
    const mo = sums(recurringItems.filter(i => i.per === 'mensual')), an = sums(recurringItems.filter(i => i.per === 'anual'));
    const blk = (t, s) => [[`Subtotal ${t}`, s.sub]].concat(igv ? [[`IGV (18%) ${t}`, s.igv]] : [], [[`Total ${t}${igv ? ' + IGV':''}`, s.tot, 1]]);
    drawTotals(blk('mensual', mo).concat(blk('anual', an)));
  }

  const inclLines = (q.includes || []).map(i => i.text ? i.text.replace('{dias}', days) : i);
  if (inclLines.length > 0) {
    const bullets = (title, arr) => {
      need(14); txt(title, M, y, { b: 1, s: 10.5 }); y += 5.5;
      arr.forEach(l => {
        const w = doc.setFont('helvetica', 'normal').setFontSize(9).splitTextToSize(l, R - M - 6); need(w.length * 4.2 + 2);
        txt('•', M + 1, y); w.forEach(s => { txt(s, M + 6, y); y += 4.2 }); y += 0.8
      }); y += 3
    };
    bullets('Incluye:', inclLines);
  }

  const a = sums(initialItems);
  const mo = sums(recurringItems.filter(i => i.per === 'mensual'));
  const an = sums(recurringItems.filter(i => i.per === 'anual'));
  const y1 = a.tot + mo.tot * months + an.tot;

  need(34); txt('Resumen de pagos', M, y, { b: 1, s: 12 }); y += 6;
  [['Pago inicial (único)', a.tot], ['Renovación mensual (desde el mes 2 de servicio)', mo.tot], ['Renovación anual (dominios y similares)', an.tot]].forEach(([l, v]) => { txt(l, M, y); txt(money(v), R, y, { a: 'right' }); y += 5.5 });
  doc.setDrawColor(...INK); doc.setLineWidth(.4); doc.line(M, y - 3.5, R, y - 3.5);
  txt('Total primer año', M, y + 1, { b: 1, s: 11 }); txt(money(y1), R, y + 1, { b: 1, s: 11, a: 'right' }); y += 6;
  txt(igv ? 'Montos con IGV incluido.' : 'Montos sin IGV.', R, y, { s: 8, c: GR, a: 'right' }); y += 9;

  const condLines = (q.conditions || []).map(c => c.text ? c.text.replace('{dias}', days) : c);
  if (condLines.length > 0) {
    const bullets = (title, arr) => {
      need(14); txt(title, M, y, { b: 1, s: 10.5 }); y += 5.5;
      arr.forEach(l => {
        const w = doc.setFont('helvetica', 'normal').setFontSize(9).splitTextToSize(l, R - M - 6); need(w.length * 4.2 + 2);
        txt('•', M + 1, y); w.forEach(s => { txt(s, M + 6, y); y += 4.2 }); y += 0.8
      }); y += 3
    };
    bullets('Condiciones', condLines);
  }

  need(26); y += 12;
  doc.setDrawColor(...INK); doc.setLineWidth(.3); doc.line(R - 60, y, R, y);
  txt('Conformidad del cliente', R, y + 5, { s: 9, a: 'right' });

  doc.fname = `${q.code || 'COT'}_${(q.client || 'cotizacion').replace(/[^\wÀ-ÿ]+/g, '_')}.pdf`;
  return doc;
}

function previewQuotationPDF(id) {
  const item = allQuotations.find(q => q.id === id);
  if (!item) return;

  const d = buildPDFFromData(item);
  const url = URL.createObjectURL(d.output('blob'));

  $('ov').className = '';
  $('ov').innerHTML = `
  <div class="fixed inset-0 bg-black/40 z-40" onclick="closeP()"></div>
  <div class="fixed z-50 bg-white shadow-xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[96%] max-w-4xl h-[92%] rounded-xl p-4 flex flex-col gap-3">
    <div class="flex justify-between items-center pb-2 border-b border-neutral-200">
      <h3 class="text-base font-bold text-[#141c31]">Vista previa: ${esc(item.code)} - ${esc(item.client) || 'Cotización'}</h3>
      <button onclick="closeP()" class="text-neutral-400 hover:text-neutral-600 font-bold p-1">✕</button>
    </div>
    <iframe src="${url}" class="flex-1 w-full border border-neutral-300 rounded"></iframe>
    <div class="flex gap-2 flex-wrap">
      <button class="btn pri" onclick="downloadPDF('${id}')">Descargar PDF</button>
      <a class="btn sec" href="${url}" target="_blank">Abrir en otra pestaña</a>
      <button class="btn sec ml-auto" onclick="closeP()">Cerrar</button>
    </div>
  </div>`;
}

function downloadPDF(id) {
  const item = allQuotations.find(q => q.id === id);
  if (!item) return;
  const d = buildPDFFromData(item);
  d.save(d.fname);
}

function closeP() {
  $('ov').className = 'hidden';
  $('ov').innerHTML = '';
}

// ----------------- DUPLICATE & DELETE -----------------

async function duplicateQuotation(id) {
  const item = allQuotations.find(q => q.id === id);
  if (!item) return;

  const baseCode = item.code || 'COT';
  const newCode = `${baseCode}-COPIA`;
  
  const payload = {
    client: item.client ? `${item.client} (Copia)` : 'Copia',
    code: newCode,
    plan: item.plan,
    days: item.days,
    margin: item.margin,
    igv: item.igv,
    months: item.months,
    hdr: { on: item.hdrOn, name: item.hdrName, l1: item.hdrL1, l2: item.hdrL2 },
    items: {
      initial: (item.items || []).filter(i => i.type === 'initial'),
      recurring: (item.items || []).filter(i => i.type === 'recurring')
    },
    incl: (item.includes || []).map(i => i.text),
    cond: (item.conditions || []).map(c => c.text)
  };

  try {
    const res = await fetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al duplicar');
    await fetchQuotations();
    alert(`Cotización duplicada con código: ${newCode}`);
  } catch (err) {
    alert('Error al duplicar: ' + err.message);
  }
}

async function deleteQuotation(id, code) {
  if (!confirm(`¿Eliminar la cotización ${code}?`)) return;

  try {
    const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar');
    await fetchQuotations();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

fetchQuotations();
