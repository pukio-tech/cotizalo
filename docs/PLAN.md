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

## Fase 3 · Rediseño de UI con design system ✅ (rama `next`)

- [x] **Tokens de diseño** en `globals.css`: paleta PUKIO, `brand` / `brand-soft` / `brand-contrast`, sombras `card` / `float` y colores del logo fijos.
- [x] **Modo oscuro** (Claro / Oscuro / Sistema) sin destello: un script en `<head>` aplica el tema antes del primer pintado, como recomienda la guía de Next 16.
- [x] **Editor en dos columnas** con panel lateral en pestañas: *Resumen* y *PDF en vivo*, que se regenera mientras editas.
- [x] **Móvil:** barra inferior fija con el total del primer año y los botones PDF y Guardar.
- [x] **Servicios editables en línea:** la tarjeta se expande, sin modales.
- [x] **Reordenar** servicios, "Incluye" y "Condiciones" arrastrando o con teclado (dnd-kit, con anuncios en español para lectores de pantalla).
- [x] **Borrador automático** en el navegador por cotización, con aviso para restaurarlo o descartarlo.
- [x] **Ctrl/⌘+S** para guardar.
- [x] **Diálogo propio** en lugar de `confirm()`.
- [x] Contadores en los pasos y aviso si falta el cliente en el resumen.
- [x] **Listado:**
  - Columna "Total primer año".
  - Orden: recientes, antiguas, código, cliente.
  - Filtro por fecha: 7 días, 30 días, este año.
  - Todo en la URL, para poder compartirla.
- [x] **Accesibilidad:**
  - Enlace "Saltar al contenido".
  - Ayudas de los campos asociadas con `aria-describedby`.
  - Foco visible.
  - Respeta `prefers-reduced-motion`.
  - Contraste AA en ambos temas.

**Pendiente para la Fase 4:** filtros por estado (requieren el campo de estado en la BD).

## Fase 4 · Producto escalable ✅ (rama `next`, requiere migrar la BD)

- [x] **Autenticación con Better Auth:**
  - Correo y contraseña.
  - Sesiones de 30 días.
  - `DISABLE_SIGNUP` para cerrar el registro.
- [x] **Protección de rutas:**
  - `proxy.ts` redirige rápido a `/ingresar`.
  - La verificación real está en la capa de acceso `src/lib/session.ts`.
  - Todas las Server Actions sacan la empresa de la sesión.
- [x] **Multiempresa:**
  - Cada cotización y servicio del catálogo pertenece a una empresa.
  - El repositorio exige la empresa en todas sus consultas: otra empresa no puede ver, editar, borrar ni compartir.
  - El correlativo y el código son únicos por empresa.
- [x] **Datos de la empresa** en Ajustes: nombre, líneas de cabecera y logo. El logo se reduce en el navegador y va en el PDF y en el enlace público.
- [x] **Catálogo de servicios:** se administra en Ajustes y se usa desde el editor con "Agregar desde el catálogo".
- [x] **Estados** borrador / enviada / aceptada / rechazada. "Vencida" se calcula sola según la fecha de emisión y la validez. Hay filtro por estado en el listado.
- [x] **Fecha de emisión editable** (hora de Lima). Las cotizaciones existentes conservan su fecha de creación.
- [x] **Enlace público `/p/[token]`:**
  - El cliente ve la propuesta, descarga el PDF y la acepta con su nombre.
  - Nunca recibe el costo base ni el margen.
  - Se puede dejar de compartir.
- [x] **Migraciones con Prisma Migrate:**
  - Línea base `0_init` igual al esquema actual de producción.
  - Migración `1_auth_empresas`, solo aditiva.
- [x] **Tests:** 41 (aislamiento entre empresas, enlace público, aceptación, estados, fechas, PDF con logo).
- [x] **Probado en el navegador:**
  - Registro y adopción de las cotizaciones antiguas.
  - Ajustes, catálogo, compartir y aceptación.
  - Cierre de sesión y una segunda empresa sin acceso a la primera.

**Pendiente (Fase 5):**

- Invitar miembros a la empresa: el plugin ya lo soporta, pero necesita envío de correos.
- Recuperar contraseña: también requiere correo.

### Cómo desplegar la Fase 4 (una sola vez)

1. En Vercel → Settings → Environment Variables (Production y Preview):
   - `BETTER_AUTH_SECRET`: **obligatoria**. Genera una con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
   - `COTIZALO_OWNER_EMAIL`: tu correo. Al registrarte, tu empresa adopta todas las cotizaciones creadas antes del inicio de sesión.
   - Opcional: `DISABLE_SIGNUP=true` después de crear tu cuenta, si no quieres registros abiertos.
2. Con la `DATABASE_URL` de Neon en tu `.env` local:
   ```bash
   npm run db:baseline   # marca 0_init como aplicada (la BD ya tiene esas tablas)
   npm run db:migrate    # aplica 1_auth_empresas
   ```
   La migración solo agrega tablas y columnas. La versión de `main` sigue funcionando con la BD migrada, así que puedes migrar antes de fusionar.
3. Despliega la rama `next`, entra a `/registro` con el correo de `COTIZALO_OWNER_EMAIL` y crea tu empresa: verás tus cotizaciones de siempre.

## Fase 4.1 · Tablero, panel y listado sin scroll ✅ (rama `next`, sin migración)

- [x] Estado nuevo **En negociación**:
  - Se guarda en la misma columna `status` (texto), así que no requiere migración.
  - No vence, y el cliente puede aceptar desde el enlace.
- [x] **Tablero** `/cotizaciones/tablero`:
  - Una columna por estado, con cantidad y total del primer año.
  - Se arrastra con el mouse, con toque prolongado o con el teclado (asa + flechas).
  - También se puede cambiar el estado desde el distintivo de cada tarjeta.
- [x] **Cambio de estado en el listado:** el distintivo de estado es un menú y guarda al instante.
  - Marcar una cotización como aceptada registra la fecha.
  - Sacarla de aceptada borra quién y cuándo la aceptó.
- [x] **Panel** `/panel`, que ahora es la página de inicio:
  - **Aceptado:** solo las aceptadas.
  - **Pronosticado:** aceptadas + borradores, enviadas, vencidas y en negociación; excluye las rechazadas.
  - **En curso** y **tasa de cierre**.
  - Desglose por estado y gráfico de los últimos 6 meses.
  - Filtro por fecha de emisión.
- [x] **Listado sin scroll horizontal:**
  - Tabla de ancho fijo y textos largos recortados.
  - Columnas secundarias que se ocultan según el ancho, y tarjetas por debajo de 1024 px.
  - Duplicar y eliminar se movieron a un menú "⋯".

## Fase 5 · Extras

- Envío por correo / WhatsApp con el PDF adjunto o enlace.
- Generación del PDF en servidor (route handler) para enlaces y correos.
- ~~Métricas: monto cotizado, tasa de aceptación, por mes~~ → hecho en la Fase 4.1 (panel).

---

## Decisiones pendientes

1. ¿Next.js en el mismo repositorio (rama `next`) o en uno nuevo? → recomendado: mismo repo.
2. ~~Proveedor de autenticación~~ → **Better Auth** (sin servicio externo; admite Google y 2FA más adelante).
3. ~~Fecha del PDF~~ → **fecha de emisión editable**, por defecto la de creación.
