let allQuotations = [];

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
        <button onclick="deleteQuotation('${esc(item.id)}')" class="btn sec text-xs py-1 px-2 text-red-600 hover:bg-red-50" title="Eliminar">
          ✕
        </button>
      </td>
    </tr>`;
  }).join('');
}

function filterTable(val) {
  renderQuotationsTable(val);
}

// ----------------- PDF PREVIEW MODAL -----------------

const pdfFor = item => buildQuotationPDF(fromRecord(item), new Date(item.createdAt || Date.now()));

function previewQuotationPDF(id) {
  const item = allQuotations.find(q => q.id === id);
  if (!item) return;

  const d = pdfFor(item);
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
  const d = pdfFor(item);
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
  const q = fromRecord(item);

  try {
    const codeRes = await fetch('/api/next-code');
    const newCode = codeRes.ok ? (await codeRes.json()).nextCode : undefined;
    const payload = {
      client: q.client ? `${q.client} (Copia)` : 'Copia',
      code: newCode,
      plan: q.plan,
      days: q.days,
      margin: q.margin,
      igv: q.igv,
      months: q.months,
      hdr: q.hdr,
      items: { initial: q.initial, recurring: q.recurring },
      incl: q.incl,
      cond: q.cond
    };
    const res = await fetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al duplicar');
    const created = await res.json();
    await fetchQuotations();
    alert(`Cotización duplicada con código: ${created.code}`);
  } catch (err) {
    alert('Error al duplicar: ' + err.message);
  }
}

async function deleteQuotation(id) {
  const item = allQuotations.find(q => q.id === id);
  if (!item || !confirm(`¿Eliminar la cotización ${item.code}?`)) return;

  try {
    const res = await fetch(`/api/quotations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar');
    await fetchQuotations();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

fetchQuotations();
