# Cotízalo (Next.js + Prisma + PostgreSQL)

Generación y administración de cotizaciones con margen, IGV y exportación a **PDF**. Base de datos **PostgreSQL (Neon)** con **Prisma ORM**.

Plan de evolución por fases: [docs/PLAN.md](docs/PLAN.md).

## Stack

- **Next.js 16** (App Router, Cache Components, Server Actions) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (tokens de marca PUKIO y modo oscuro en `src/app/globals.css`)
- **dnd-kit** para reordenar servicios con mouse, toque o teclado
- **Prisma 5** sobre PostgreSQL (mismo esquema que la versión Express: no requiere migrar datos)
- **zod** para validar todo lo que llega a las Server Actions
- **jsPDF** + autotable para el PDF (se genera en el navegador)
- **Vitest** para dominio y PDF

## Requisitos

- Node.js 20.9 o superior
- `DATABASE_URL` en `.env`

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unitarios + integración (Postgres en memoria con PGlite, no toca el .env)
npm run lint
npm run typecheck
npm run build        # prisma generate + next build
```

> npm 11 pide aprobar los scripts de instalación: los de Prisma ya están aprobados en `allowScripts` de `package.json`.

## Estructura

```
src/
  app/
    (app)/layout.tsx                 # sidebar + contenido
    (app)/cotizaciones/page.tsx      # listado con búsqueda y paginación en servidor
    (app)/cotizaciones/nueva/        # editor de cotización nueva
    (app)/cotizaciones/[id]/         # editor de cotización existente
  features/quotations/
    domain/      # esquema zod, cálculos, reglas de visibilidad de secciones (+ tests)
    pdf/         # generador del PDF (+ tests) y carga perezosa en el cliente
    server/      # repositorio Prisma (único acceso a BD) y Server Actions
    components/  # editor, listado, vista previa del PDF
  components/    # sidebar y componentes de UI (shadcn)
  lib/           # cliente Prisma, utilidades
prisma/schema.prisma
```

## Reglas del PDF

Solo se dibujan las secciones con contenido y se renumeran:

- **Pago inicial** y **Planes y servicios renovables**: solo si tienen servicios (dentro de renovables, el bloque mensual/anual solo si tiene ítems).
- **Incluye** y **Condiciones**: solo si tienen puntos.
- **Resumen de pagos**: solo las filas presentes, y solo si hay más de un tipo de pago o mensualidades.

Están en `src/features/quotations/domain/sections.ts` y cubiertas por tests.

## Montos y correlativo

- Todos los cálculos se hacen en **céntimos** (`domain/calc.ts`): unitario redondeado al céntimo, importe = unitario × cantidad, IGV redondeado una vez sobre el subtotal.
- El correlativo `COT-AAAA-NNN` se asigna dentro de una transacción con un *advisory lock* de Postgres (`server/repository.ts`), así que nunca se repite aunque dos personas guarden a la vez.

## Base de datos

```bash
npm run db:push      # sincroniza el esquema
npm run db:studio    # interfaz gráfica
```

## Despliegue (Vercel)

`vercel.json` fija el framework en Next.js. La variable `DATABASE_URL` del proyecto se mantiene. Las URLs antiguas (`/index.html?id=…`, `/cotizaciones.html`) redirigen a las nuevas.
