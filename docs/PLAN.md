# Cotízalo · Plan de mejora y migración a Next.js

Documento vivo. Cada fase termina en algo desplegable; no se pasa a la siguiente sin cerrar la anterior.

---

## Diagnóstico del sistema actual

**Stack:** Express 4 + Prisma 5 (PostgreSQL/Neon) + HTML estático con Tailwind por CDN y jsPDF en el navegador. Desplegado en Vercel como función serverless.

### Problemas encontrados

| # | Problema | Impacto |
|---|----------|---------|
| 1 | El PDF muestra todas las secciones aunque estén vacías (renovables, incluye, resumen con S/ 0.00…) | Propuesta poco profesional |
| 2 | El generador de PDF está **duplicado** en `editor.js` y `cotizaciones.js` y ya se comportan distinto | Mismo documento sale diferente según desde dónde se descargue |
| 3 | `margin: 0`, `months: 0` o `days: 0` se guardan como 30 / 12 / 15 (`parseFloat(x) \|\| 30`) | Datos corruptos al guardar |
| 4 | "Duplicar" crea el código `COT-…-COPIA`; la segunda vez falla porque `code` es único | Error al duplicar dos veces |
| 5 | `onclick="deleteQuotation('id', 'código')"` interpola texto del usuario en JS | XSS si el código lleva comillas |
| 6 | `{dias}` solo se reemplaza en la primera aparición | Texto con `{dias}` literal en el PDF |
| 7 | **La API no tiene autenticación**: cualquiera con la URL puede listar o borrar cotizaciones | Riesgo de seguridad alto |
| 8 | `GET /api/quotations` trae todo con relaciones, sin paginar; el correlativo se calcula leyendo toda la tabla | No escala; dos usuarios pueden obtener el mismo código |
| 9 | Sin validación de entrada (cualquier JSON se acepta) | Datos inconsistentes |
| 10 | Tailwind por CDN en producción, `alert()`/`confirm()` como feedback, tabla no usable en móvil | UX pobre |
| 11 | La fecha del PDF es "hoy" desde el editor pero `createdAt` desde el listado | Inconsistencia (decidir regla en Fase 2) |

---

## Fase 0 · Arreglos inmediatos en la app actual ✅

Objetivo: valor inmediato en producción, sin cambiar de stack.

- [x] Módulo único de PDF (`public/js/pdf.js`) y utilidades/cálculos compartidos (`public/js/core.js`) usados por ambas páginas.
- [x] **Secciones condicionales en el PDF:**
  - *Pago inicial* solo si hay servicios iniciales.
  - *Planes y servicios renovables* solo si hay renovables; dentro, el bloque mensual o anual solo si tiene ítems.
  - *Incluye* y *Condiciones* solo si tienen puntos.
  - *Resumen de pagos* solo con las filas que existen, y solo si aporta (más de un tipo de pago o hay mensualidades).
  - La numeración de secciones (1, 2, …) se ajusta a las que aparecen.
- [x] Mismas reglas en el resumen del editor (pasos 2, 3 y 5).
- [x] API: `0` deja de convertirse en valor por defecto; lógica de create/update unificada; se ignoran puntos vacíos.
- [x] Duplicar usa el siguiente correlativo (`/api/next-code`) en lugar de `-COPIA`.
- [x] Guardar ya no limpia el formulario: la cotización queda abierta y la URL guarda `?id=`.
- [x] Escape de HTML reforzado y sin texto de usuario dentro de `onclick`.

## Fase 1 · Base Next.js (sin cambiar la base de datos) ✅ (rama `next`)

Objetivo: el mismo producto funcionando en Next.js, desplegado en Vercel, con la misma BD.

**Hecho:**

- [x] Next.js 16.4 (App Router, Cache Components, Partial Prefetching) + TypeScript + Tailwind v4 + shadcn/ui; Express eliminado.
- [x] Mismo `schema.prisma` y misma BD; las URLs antiguas redirigen a las nuevas.
- [x] Dominio en TS: esquema zod único, cálculos, reglas de secciones del PDF y formato.
- [x] PDF portado a TS con jsPDF cargado bajo demanda (no pesa en la carga inicial).
- [x] Server Actions validadas con zod (guardar, duplicar, eliminar, cargar) y repositorio Prisma como único acceso a datos.
- [x] Listado con búsqueda y paginación en servidor; tabla en escritorio y tarjetas en móvil; confirmación accesible para eliminar.
- [x] Editor con campos en línea, resumen siempre visible en escritorio, toasts, aviso de cambios sin guardar y estados de carga.
- [x] 13 tests (Vitest), lint, typecheck y `next build` en verde. Probado de punta a punta en navegador contra Postgres local (PGlite).

**Pendiente para publicar:** probar la rama `next` en un *preview deployment* de Vercel contra Neon y luego fusionar a `main`.

Detalle original de la fase:

- Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui, en el mismo repo (rama `next`), reemplazando Express al final.
- Reutilizar `prisma/schema.prisma` tal cual → **sin migración de datos**.
- Estructura por *features* para que crezca ordenada:

```
src/
  app/
    (dashboard)/layout.tsx                 # sidebar + topbar
    (dashboard)/cotizaciones/page.tsx      # listado (Server Component)
    (dashboard)/cotizaciones/nueva/page.tsx
    (dashboard)/cotizaciones/[id]/page.tsx # editor
  features/quotations/
    domain/      # schema zod, cálculos, reglas de visibilidad de secciones
    pdf/         # generador de PDF (port de pdf.js a TS)
    server/      # repositorio Prisma + Server Actions
    components/  # editor, listado, vista previa
  components/ui/ # design system (shadcn)
  lib/           # prisma client, formato de moneda/fechas
```

- Mutaciones con Server Actions validadas con **zod** (un único esquema para cliente y servidor).
- Listado paginado y búsqueda en servidor.
- Tests con **Vitest** para cálculos y reglas del PDF.

## Fase 2 · Dominio y PDF robustos ✅ (rama `next`, sin cambios de esquema)

- [x] **Montos en céntimos:** el unitario se redondea al céntimo, el importe es exactamente unitario × cantidad y el IGV se redondea una vez sobre el subtotal. Lo que ve el cliente cuadra al céntimo.
- [x] Reglas de secciones como funciones puras testeadas (`visibleSections`, desde la Fase 1).
- [x] **Correlativo atómico** con un *advisory lock* de Postgres dentro de la transacción, en vez de una tabla `Counter`, así que no hace falta migrar Neon. Si dos personas guardan el mismo código automático, la segunda recibe el siguiente y el editor lo avisa. Un código personalizado repetido da error.
- [x] **Fecha del PDF coherente:** la de creación si está guardada y la de hoy si no, igual desde el editor y desde el listado (`issueDate` en `pdf/client.ts`).
- [x] **Plantilla del PDF:**
  - Barra de marca y cabecera en dos columnas (emisor / cotización).
  - Recuadro de cliente que ajusta textos largos y resumen destacado.
  - Pie con datos de contacto y "Página X de Y" en todas las páginas.
  - Encabezado de tabla repetido al saltar de página; un servicio y su detalle nunca se separan.
- [x] **Tests de integración** del repositorio contra Postgres en memoria (PGlite): correlativo, guardados simultáneos, códigos repetidos, actualización, borrado en cascada, búsqueda y paginación. En total, 27 tests.

**Movido a la Fase 4** (necesitan cambios de esquema y se aplicarán junto con organizaciones):

- Fecha de emisión editable (`issuedAt`).
- Logo en el PDF (necesita almacenamiento de archivos).

## Fase 3 · Rediseño de UI con design system

- Tokens de diseño (color, tipografía Plus Jakarta Sans, espaciado, radios, sombras) en Tailwind; modo oscuro opcional.
- Editor en dos columnas: formulario a la izquierda, **vista previa en vivo** del resumen/PDF a la derecha (en móvil, pestañas).
- Edición inline de servicios (sin modales para todo), arrastrar para reordenar.
- Toasts en vez de `alert()`, diálogo de confirmación accesible, aviso de cambios sin guardar, autoguardado de borrador.
- Listado: tabla en desktop / tarjetas en móvil, filtros por estado y fecha, estados vacíos y *skeletons*.
- Accesibilidad: labels, foco visible, navegación por teclado, contraste AA.

## Fase 4 · Producto escalable

- **Autenticación** (Auth.js o Clerk) y protección de todas las rutas/acciones.
- Multiempresa: `Organization` con datos de cabecera y logo; cada cotización pertenece a una.
- Catálogo de servicios reutilizables (precio base, detalle, periodicidad).
- Estados de cotización: borrador → enviada → aceptada / rechazada / vencida.
- Enlace público de solo lectura para que el cliente vea y acepte la propuesta.

## Fase 5 · Extras

- Envío por correo / WhatsApp con el PDF adjunto o enlace.
- Generación del PDF en servidor (route handler) para enlaces y correos.
- Métricas: monto cotizado, tasa de aceptación, por mes.

---

## Decisiones pendientes

1. ¿Next.js en el mismo repositorio (rama `next`) o en uno nuevo? → recomendado: mismo repo.
2. Proveedor de autenticación (Auth.js con email/Google vs. Clerk).
3. Fecha del PDF: ¿fecha de creación o fecha de emisión editable?
