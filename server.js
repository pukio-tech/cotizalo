require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// HTML View Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/cotizaciones', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cotizaciones.html'));
});

// Number with fallback only when missing/invalid (0 is a valid value)
const num = (v, def, parse = parseFloat) => {
  const n = parse(v, 10);
  return Number.isFinite(n) ? n : def;
};

const WITH_RELATIONS = {
  items: { orderBy: { order: 'asc' } },
  includes: { orderBy: { order: 'asc' } },
  conditions: { orderBy: { order: 'asc' } }
};

// Maps the editor payload to Prisma data (shared by create and update)
function toQuotationData(body) {
  const { client, code, plan, days, margin, igv, months, hdr, items, incl, cond } = body;
  const toItem = type => (it, idx) => ({
    type,
    desc: it.desc || '',
    detail: it.detail || '',
    per: type === 'recurring' ? (it.per === 'anual' ? 'anual' : 'mensual') : null,
    cant: Math.max(1, num(it.cant, 1, parseInt)),
    cost: Math.max(0, num(it.cost, 0)),
    order: idx
  });
  const initialItems = (items?.initial || []).map(toItem('initial'));
  const recurringItems = (items?.recurring || []).map(toItem('recurring')).map(it => ({ ...it, order: initialItems.length + it.order }));
  const toText = (text, idx) => ({ text: typeof text === 'string' ? text : (text?.text || ''), order: idx });

  return {
    fields: {
      code: code || undefined,
      client: client || undefined,
      plan: plan || undefined,
      days: Math.max(0, num(days, 15, parseInt)),
      margin: num(margin, 30),
      igv: igv !== undefined ? Boolean(igv) : true,
      months: Math.min(12, Math.max(0, num(months, 12, parseInt))),
      hdrOn: Boolean(hdr?.on),
      hdrName: hdr?.name || '',
      hdrL1: hdr?.l1 || '',
      hdrL2: hdr?.l2 || ''
    },
    items: [...initialItems, ...recurringItems],
    includes: (incl || []).map(toText).filter(r => r.text.trim()),
    conditions: (cond || []).map(toText).filter(r => r.text.trim())
  };
}

// API Routes

// GET /api/next-code - Get next correlative quotation code
app.get('/api/next-code', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const quotations = await prisma.quotation.findMany({
      select: { code: true }
    });

    let maxNum = 0;
    const regex = new RegExp(`COT-${currentYear}-(\\d+)`, 'i');
    quotations.forEach(q => {
      if (!q.code) return;
      const match = q.code.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const nextCode = `COT-${currentYear}-${String(maxNum + 1).padStart(3, '0')}`;
    res.json({ nextCode, maxNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/quotations - List all quotations
app.get('/api/quotations', async (req, res) => {
  try {
    const quotations = await prisma.quotation.findMany({
      orderBy: { updatedAt: 'desc' },
      include: WITH_RELATIONS
    });
    res.json(quotations);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({ error: 'Error al obtener las cotizaciones', details: error.message });
  }
});

// GET /api/quotations/:id - Get a single quotation
app.get('/api/quotations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: WITH_RELATIONS
    });
    if (!quotation) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    res.json(quotation);
  } catch (error) {
    console.error('Error fetching quotation:', error);
    res.status(500).json({ error: 'Error al obtener la cotización', details: error.message });
  }
});

// POST /api/quotations - Create a new quotation
app.post('/api/quotations', async (req, res) => {
  try {
    const d = toQuotationData(req.body);
    const created = await prisma.quotation.create({
      data: {
        ...d.fields,
        code: d.fields.code || `COT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        client: d.fields.client || 'Nuevo Cliente',
        plan: d.fields.plan || 'Nuevo Plan',
        items: { create: d.items },
        includes: { create: d.includes },
        conditions: { create: d.conditions }
      },
      include: WITH_RELATIONS
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating quotation:', error);
    res.status(500).json({ error: 'Error al crear la cotización', details: error.message });
  }
});

// PUT /api/quotations/:id - Update an existing quotation
app.put('/api/quotations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const d = toQuotationData(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      // Delete old relations
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      await tx.quotationInclude.deleteMany({ where: { quotationId: id } });
      await tx.quotationCondition.deleteMany({ where: { quotationId: id } });

      // Update quotation and recreate relations
      return await tx.quotation.update({
        where: { id },
        data: {
          ...d.fields,
          items: { create: d.items },
          includes: { create: d.includes },
          conditions: { create: d.conditions }
        },
        include: WITH_RELATIONS
      });
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating quotation:', error);
    res.status(500).json({ error: 'Error al actualizar la cotización', details: error.message });
  }
});

// DELETE /api/quotations/:id - Delete a quotation
app.delete('/api/quotations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.quotation.delete({ where: { id } });
    res.json({ success: true, message: 'Cotización eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting quotation:', error);
    res.status(500).json({ error: 'Error al eliminar la cotización', details: error.message });
  }
});

// Start server if not running on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  });
}

module.exports = app;
