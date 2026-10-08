# Cotizador Pro (Node.js + Express + Prisma + PostgreSQL)

Sistema de generación y administración de cotizaciones con almacenamiento persistente en **PostgreSQL (Neon)** utilizando **Prisma ORM**, cálculo dinámico de márgenes e IGV, y exportación a **PDF**.

---

## 🚀 Requisitos previos

- **Node.js**: v18 o superior
- Base de datos **PostgreSQL** configurada en `.env`

---

## 🛠️ Instalación y Configuración

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Sincronizar esquema de base de datos con Prisma:**
   ```bash
   npx prisma db push
   ```

3. **Iniciar el servidor:**
   ```bash
   # Modo desarrollo (con recarga automática):
   npm run dev

   # Modo producción:
   npm start
   ```

4. Abrir en el navegador:
   ```
   http://localhost:3000
   ```

---

## 🗄️ Modelo de Base de Datos (Prisma)

El archivo `prisma/schema.prisma` contiene los siguientes modelos:

- **`Quotation`**: Cabecera de la cotización (código único, cliente, plan, días de validez, margen, IGV, meses, cabecera PDF).
- **`QuotationItem`**: Servicios y costos tanto iniciales (`type: 'initial'`) como recurrentes (`type: 'recurring'`, mensual/anual).
- **`QuotationInclude`**: Puntos incluidos en la propuesta.
- **`QuotationCondition`**: Condiciones comerciales y formas de pago.

---

## 📦 Comandos útiles de Prisma

- **Abrir interfaz gráfica de BD (Prisma Studio):**
  ```bash
  npm run db:studio
  ```

- **Actualizar cliente de Prisma:**
  ```bash
  npm run db:generate
  ```

- **Sincronizar cambios del esquema:**
  ```bash
  npm run db:push
  ```
