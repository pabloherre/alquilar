# AlquilAR — PWA Offline-First & Mobile UI

**Fecha:** 2026-06-24
**Estado:** Aprobado

## Objetivo

Convertir AlquilAR en una PWA offline-first instalable y optimizar toda la interfaz para uso en dispositivos móviles, manteniendo el stack existente (React + MUI v9 + vite-plugin-pwa).

## Alcance

- Ambos roles (admin e inquilino) con igual prioridad en mobile
- Drawer mejorado (hamburger) como patrón de navegación mobile
- ContractDetailPage con acordeones colapsables en mobile
- Offline-first para lectura; escrituras muestran error claro sin red
- Sin IndexedDB ni sync queue — las acciones de escritura requieren conexión

---

## 1. Arquitectura PWA & Offline

### Estrategias de caché Workbox (`vite.config.js`)

| Recurso | Estrategia | Motivo |
|---|---|---|
| Assets estáticos (JS, CSS, fuentes, íconos) | `CacheFirst` | No cambian entre visitas |
| Llamadas `/api/*` | `NetworkFirst` | Datos frescos si hay red, fallback a caché si offline |
| Imágenes | `StaleWhileRevalidate` | Balance entre frescura y velocidad |

### Íconos del manifest

Separar en dos entradas para correcta resolución en Android:

```js
{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
{ src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
{ src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
```

### Página offline

- Ruta: `/offline.html` (archivo estático en `client/public/`)
- Contenido: logo + mensaje "Estás sin conexión. Los datos que ya viste siguen disponibles."
- Se sirve cuando la navegación falla y no existe entrada en caché
- Configurada como `navigateFallback` en Workbox

### Pre-caché de rutas SPA

Las rutas `/`, `/contracts/:id`, `/change-password`, `/admin/new-contract` se pre-cachean en el install del service worker para apertura offline inmediata.

---

## 2. Navegación & Layout

### AppBar

- **Mobile (`xs`):** hamburger izquierda + logo centrado, altura 56px
- **Desktop (`md+`):** logo izquierda + botones de nav derecha (sin cambio funcional)

### Drawer mejorado (280px de ancho)

Estructura:
1. **Cabecera:** avatar con inicial, nombre completo, chip de rol
2. **Ítems de navegación** con íconos y área touch mínima 48px:
   - Inicio (HomeIcon)
   - Cambiar contraseña (LockIcon)
   - Nuevo Contrato (AddCircleIcon) — solo admin
3. **Divider**
4. Cerrar sesión (LogoutIcon)

### Contenedor principal

```jsx
<Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}>
```

### Safe areas

```css
padding-bottom: env(safe-area-inset-bottom);
```

Aplicado en el wrapper raíz de `App.jsx` para respetar home indicator en iPhone.

### Tipografía responsive

- Títulos de página: `h5` en mobile, `h4` en desktop
- Subtítulos: `body2` con `color="text.secondary"`

---

## 3. Dashboard

### Grid de contratos

| Breakpoint | Columnas |
|---|---|
| `xs` | 1 |
| `sm` | 2 |
| `md+` | 3 |

### Contenido de cada card

1. Header: título + chip de estado
2. Monto ARS actual (tipografía grande, protagonista)
3. Fila compacta: próximo incremento · vencimiento
4. Footer: nombre inquilino (solo admin) + botón "Ver detalle" full-width en mobile

### FAB admin

```jsx
<Fab color="primary" sx={{
  position: 'fixed', bottom: `calc(24px + env(safe-area-inset-bottom))`, right: 24,
  display: { xs: 'flex', md: 'none' }
}}>
  <AddIcon />
</Fab>
```

Navega a `/admin/new-contract`. Solo visible para admin en mobile.

### Empty state

Ilustración simple + texto descriptivo + botón de acción primaria, centrado verticalmente.

---

## 4. ContractDetailPage — Acordeones

En mobile (`xs`/`sm`) la página usa `MuiAccordion`. En desktop (`md+`) mantiene el layout actual en secciones.

### Acordeón 1 — "Información del contrato" (expandido por defecto)

- Monto USD y ARS en tipografía grande
- Grilla 2×2: índice, frecuencia, vencimiento, próximo incremento
- Chips de alerta contextual (vencido / próximo a vencer / próximo a incrementar)
- Nombre del inquilino

### Acordeón 2 — "Proyección"

- `ProjectionChart` con `height={200}` en mobile (300px en desktop)
- Sin overflow horizontal

### Acordeón 3 — "Cuotas e historial"

- **Mobile:** cards por cuota — mes, monto, chip de estado, botón de acción
- **Desktop:** tabla existente sin cambios
- Scroll vertical dentro del acordeón

### Acordeón 4 — "Gestión" (solo admin, colapsado por defecto)

- Editar contrato, confirmar incremento, generar recibo, link mágico, renovar
- Sub-secciones con `Divider`
- Botones `fullWidth` en mobile
- Formularios con campos apilados verticalmente

### Navegación de regreso

Botón `← Contratos` con `startIcon={<ArrowBackIcon />}` en el top de la página.

---

## 5. Formularios & Páginas restantes

### Anti-zoom iOS

Todos los `TextField` llevan:
```jsx
inputProps={{ style: { fontSize: 16 } }}
```
Evita el zoom automático del viewport en iOS (se activa cuando `font-size < 16px`).

### NewContractPage

- Dos columnas colapsan a una columna en mobile
- Formulario "Crear inquilino" se mueve a un `Dialog` en mobile

### LoginPage

- Botón de Google `fullWidth` en mobile
- Padding ajustado

### Tema global — overrides mobile

```js
MuiButton: { styleOverrides: { root: { minHeight: 44 } } },
```

Garantiza área touch mínima de 44px en todos los botones del sistema.

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `client/vite.config.js` | Reconfigurar Workbox con estrategias explícitas + íconos corregidos |
| `client/public/offline.html` | Crear página offline |
| `client/public/pwa-192.png` / `pwa-512.png` | Generar PNGs desde los SVGs existentes (mejor compatibilidad) |
| `client/src/components/Topbar.jsx` | Rediseñar drawer con cabecera de usuario |
| `client/src/App.jsx` | Agregar safe-area padding |
| `client/src/pages/DashboardPage.jsx` | Grid responsive + FAB admin + empty state |
| `client/src/pages/ContractDetailPage.jsx` | Acordeones en mobile |
| `client/src/pages/NewContractPage.jsx` | Dialog para crear inquilino en mobile |
| `client/src/theme.js` | Override `MuiButton.minHeight` |

## Fuera de alcance

- Sync queue / background sync para escrituras offline
- Push notifications
- Cambios en el backend
