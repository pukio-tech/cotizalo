// Generador único del PDF de cotización (requiere jsPDF + autotable y core.js).
// Solo dibuja las secciones que tienen contenido; la numeración se ajusta sola.

function buildQuotationPDF(q, date = new Date()) {
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16, R = W - M, INK = [20, 28, 49], GR = [100, 116, 139];
  const t = quoteTotals(q);
  let y = 18, n = 0;
  const need = h => { if (y + h > 282) { doc.addPage(); y = 18 } };
  const txt = (s, x, yy, o = {}) => { doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 9); doc.setTextColor(...(o.c || INK)); doc.text(s, x, yy, { align: o.a || 'left' }) };
  const section = title => { need(40); txt(`${++n}. ${title}`, M, y, { b: 1, s: 12 }); y += 4 };
  const exp = new Date(date.getTime() + q.days * 864e5);

  if (q.hdr.on && (q.hdr.name || q.hdr.l1 || q.hdr.l2)) {
    if (q.hdr.name) { txt(q.hdr.name, M, y, { b: 1, s: 16 }); y += 5 }
    [q.hdr.l1, q.hdr.l2].filter(Boolean).forEach(l => { txt(l, M, y, { s: 8.5, c: GR }); y += 4.5 }); y += 6;
  }
  txt('C O T I Z A C I Ó N', M, y, { b: 1, s: 17 }); y += 6.5;
  txt(q.code || 'COT', M, y, { b: 1, s: 10.5 }); y += 5.5;
  txt(`Fecha ${fdate(date)}  ·  válida hasta ${fdate(exp)}`, M, y, { s: 9, c: GR }); y += 8;
  txt('Cliente: ', M, y, { b: 1 }); txt(q.client || '-', M + 16, y); y += 5.5;
  txt('Plan propuesto: ', M, y, { b: 1 }); txt(q.plan || '-', M + 27, y); y += 9;

  const table = (list, withPer) => {
    const body = [], cols = withPer ? 5 : 4;
    list.forEach(it => {
      const u = unit(it, q.margin), free = !u;
      const r = [{ content: it.desc, styles: { fontStyle: 'bold' } }];
      if (withPer) r.push(isAnnual(it) ? 'Anual' : 'Mensual');
      r.push(String(it.cant), free ? 'Incluido' : money(u), free ? 'Incluido' : money(u * it.cant));
      if (it.detail) { r._pad = 1; body.push(r); const d = [{ content: it.detail, colSpan: cols, styles: { fontSize: 8, textColor: GR } }]; d._last = 1; d._detail = 1; body.push(d) }
      else { r._last = 1; body.push(r) }
    });
    const head = ['Descripción'].concat(withPer ? ['Periodo'] : [], ['Cant.', 'P. unitario', 'Importe']);
    const cs = withPer ? { 1: { cellWidth: 20 }, 2: { cellWidth: 13, halign: 'center' }, 3: { cellWidth: 28, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' } } : { 1: { cellWidth: 14, halign: 'center' }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 30, halign: 'right' } };
    const cantCol = withPer ? 2 : 1;
    doc.autoTable({
      startY: y, margin: { left: M, right: M }, head: [head], body, theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: { top: 2, bottom: 2, left: 1, right: 1 } },
      headStyles: { fontStyle: 'bold', fontSize: 8.5, textColor: GR }, columnStyles: cs,
      didParseCell: d => {
        if (d.section === 'body') { if (d.row.raw._pad) d.cell.styles.cellPadding = { top: 2, bottom: 0.4, left: 1, right: 1 }; if (d.row.raw._detail) d.cell.styles.cellPadding = { top: 0, bottom: 2.2, left: 1, right: 1 } }
        if (d.section === 'head' && d.column.index >= cantCol) d.cell.styles.halign = d.column.index === cantCol ? 'center' : 'right';
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
  const bullets = (title, arr) => {
    need(14); txt(title, M, y, { b: 1, s: 10.5 }); y += 5.5;
    arr.forEach(l => {
      const w = doc.setFont('helvetica', 'normal').setFontSize(9).splitTextToSize(l, R - M - 6); need(w.length * 4.2 + 2);
      txt('•', M + 1, y); w.forEach(s => { txt(s, M + 6, y); y += 4.2 }); y += 0.8
    }); y += 3
  };

  if (t.has.initial) {
    section('Pago inicial (único)');
    table(q.initial, false);
    drawTotals([['Subtotal', t.a.sub]].concat(q.igv ? [['IGV (18%)', t.a.igv]] : [], [['Total a pagar al inicio', t.a.tot, 1]]));
  }

  if (t.has.monthly || t.has.annual) {
    section('Planes y servicios renovables');
    table(q.recurring, true);
    const blk = (p, s) => [[`Subtotal ${p}`, s.sub]].concat(q.igv ? [[`IGV (18%) ${p}`, s.igv]] : [], [[`Total ${p}${q.igv ? ' + IGV' : ''}`, s.tot, 1]]);
    drawTotals([].concat(t.has.monthly ? blk('mensual', t.mo) : [], t.has.annual ? blk('anual', t.an) : []));
  }

  const lines = arr => (arr || []).map(s => fillDays(s, q.days)).filter(s => s.trim());
  const incl = lines(q.incl), cond = lines(q.cond);
  if (incl.length) bullets('Incluye:', incl);

  const rows = summaryRows(q, t);
  if (rows.length) {
    need(34); txt('Resumen de pagos', M, y, { b: 1, s: 12 }); y += 6;
    rows.forEach(([l, v]) => { txt(l, M, y); txt(money(v), R, y, { a: 'right' }); y += 5.5 });
    doc.setDrawColor(...INK); doc.setLineWidth(.4); doc.line(M, y - 3.5, R, y - 3.5);
    txt('Total primer año', M, y + 1, { b: 1, s: 11 }); txt(money(t.y1), R, y + 1, { b: 1, s: 11, a: 'right' }); y += 6;
    txt(q.igv ? 'Montos con IGV incluido.' : 'Montos sin IGV.', R, y, { s: 8, c: GR, a: 'right' }); y += 9;
  }

  if (cond.length) bullets('Condiciones', cond);

  need(26); y += 12;
  doc.setDrawColor(...INK); doc.setLineWidth(.3); doc.line(R - 60, y, R, y);
  txt('Conformidad del cliente', R, y + 5, { s: 9, a: 'right' });

  doc.fname = `${q.code || 'COT'}_${(q.client || 'cotizacion').replace(/[^\wÀ-ÿ]+/g, '_')}.pdf`;
  return doc;
}
