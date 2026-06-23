# AlquilAR MERN

Aplicacion MERN para gestion de contratos de alquiler con dos roles: `admin` y `user`.

## Stack
- Backend: Node.js, Express, MongoDB, Mongoose, JWT
- Frontend: React + Vite
- Reportes: PDFKit para recibos PDF
- Graficos: Recharts

## Funcionalidades v1
- Login con email/password
- Roles con permisos:
  - Admin: crea usuarios inquilinos, crea/edita contratos, previsualiza/confirma incrementos, genera recibos
  - User: ve contratos asignados, ve proyeccion de incrementos y descarga recibos
- Magic link para inquilinos
- Contratos con:
  - Fecha inicio
  - Monto en USD
  - Frecuencia de incremento: 2/3/4/6/12 meses
  - Duracion (anios)
  - Fecha expiracion
  - Indice (`ICL`, `IPC`, `CasaPropia`, `CAC`, `CER`, `IS`, `IPIM`, `UVA`, `OTHER`)
  - Override manual (%)
- Integracion de indices via proveedor pluggable:
  - `ArquilerProvider` (adapter con URL/API key por env)
  - Fallback a override manual
- Un recibo por contrato/mes (upsert)

## Estructura
- `server/` API Express
- `client/` app React

## Setup
1. Copiar variables:
   - `server/.env.example` -> `server/.env`
   - `client/.env.example` -> `client/.env`
2. Instalar deps:
   - `npm install`
   - `npm --prefix server install`
   - `npm --prefix client install`
3. Seed demo:
   - `npm --prefix server run seed`
4. Ejecutar:
   - `npm run dev`

## Usuarios demo seed
- Admin: `admin@alquilar.local` / `admin1234`
- Tenant: `tenant@alquilar.local` / `tenant1234`

## Endpoints principales
- Auth:
  - `POST /api/auth/login`
  - `GET /api/auth/admin/users`
  - `POST /api/auth/admin/users`
  - `POST /api/auth/magic-link/request`
  - `POST /api/auth/magic-link/login`
- Contratos:
  - `POST /api/contracts`
  - `GET /api/contracts`
  - `GET /api/contracts/:id`
  - `PATCH /api/contracts/:id`
  - `POST /api/contracts/:id/increments/preview`
  - `POST /api/contracts/:id/increments/confirm`
  - `GET /api/contracts/:id/projection`
- Recibos:
  - `POST /api/contracts/:contractId/receipts/generate`
  - `GET /api/contracts/:contractId/receipts`
  - `GET /api/receipts/:id/download`