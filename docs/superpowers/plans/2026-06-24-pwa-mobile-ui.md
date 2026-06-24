# AlquilAR PWA Offline-First & Mobile UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir AlquilAR en una PWA offline-first instalable y optimizar la interfaz para uso móvil en ambos roles (admin e inquilino).

**Architecture:** Workbox con estrategias de caché explícitas (NetworkFirst para `/api/*`, CacheFirst para assets). La app React detecta conectividad con `navigator.onLine` y muestra un banner offline. ContractDetailPage usa acordeones en mobile (`xs`/`sm`) y layout normal en desktop.

**Tech Stack:** React 18 + MUI v9 + vite-plugin-pwa + Workbox (vía VitePWA) + React Router v6

## Global Constraints

- No hay test runner configurado — verificación manual con `npm run dev` en viewport mobile (Chrome DevTools → iPhone 14)
- No modificar el backend (`server/`)
- No agregar dependencias nuevas salvo las indicadas
- Anti-zoom iOS: todos los `TextField` deben tener `inputProps={{ style: { fontSize: 16 } }}`
- MUI breakpoints: `xs` = 0–600px (mobile), `sm` = 600–900px (tablet), `md` = 900px+ (desktop)
- Área touch mínima: 44–48px en todos los botones e ítems de lista
- Sin IndexedDB, sin sync queue — las acciones de escritura muestran error si no hay red
- Comandos se ejecutan desde `client/`

---

## Task 1: PWA Config — Workbox + Manifest Icons

**Files:**
- Modify: `client/vite.config.js`
- Create: `client/public/offline.html`

**Interfaces:**
- Produces: Service worker con NetworkFirst para `/api/*`, CacheFirst para assets; manifest con íconos separados por purpose.

- [ ] **Step 1: Actualizar `client/vite.config.js`**

Reemplazar el contenido completo con:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.svg', 'offline.html'],
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/offline\.html$/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.href.includes('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'image-cache' }
          }
        ]
      },
      manifest: {
        name: 'AlquilAR Contratos',
        short_name: 'AlquilAR',
        description: 'Gestión de contratos de alquiler, incrementos y recibos en ARS.',
        theme_color: '#0f766e',
        background_color: '#f1f5f9',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'es',
        icons: [
          { src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'maskable' },
          { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      }
    })
  ],
  server: { port: 5173 }
});
```

- [ ] **Step 2: Crear `client/public/offline.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sin conexión — AlquilAR</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Poppins, 'Segoe UI', sans-serif;
      background: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: white;
      border-radius: 14px;
      padding: 40px 32px;
      text-align: center;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 10px 24px rgba(15,23,42,0.07);
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 1.4rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    p { font-size: 0.95rem; color: #64748b; line-height: 1.6; }
    a {
      display: inline-block;
      margin-top: 24px;
      padding: 12px 28px;
      background: #0f766e;
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡</div>
    <h1>Sin conexión</h1>
    <p>Estás sin conexión. Los contratos y recibos que ya visitaste siguen disponibles.</p>
    <a href="/">Volver al inicio</a>
  </div>
</body>
</html>
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Esperado: build exitoso en `dist/`. El archivo `dist/sw.js` debe existir y `dist/manifest.webmanifest` debe listar 4 entradas de íconos.

```bash
grep -c "purpose" dist/manifest.webmanifest
```

Esperado: `4`

- [ ] **Step 4: Commit**

```bash
git add client/vite.config.js client/public/offline.html
git commit -m "feat(pwa): configure Workbox NetworkFirst for API, fix manifest icons"
```

---

## Task 2: Conectividad Offline — Hook + Banner

**Files:**
- Create: `client/src/hooks/useOnlineStatus.js`
- Modify: `client/src/App.jsx`

**Interfaces:**
- Produces: `useOnlineStatus()` → `boolean` (true = online). Usado por App.jsx para mostrar banner offline.

- [ ] **Step 1: Crear `client/src/hooks/useOnlineStatus.js`**

```js
import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

- [ ] **Step 2: Agregar banner offline + safe-area en `client/src/App.jsx`**

Reemplazar el contenido completo de `App.jsx`:

```jsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Alert, Box, Container } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Topbar from './components/Topbar';
import LoginPage from './pages/LoginPage';
import MagicLoginPage from './pages/MagicLoginPage';
import DashboardPage from './pages/DashboardPage';
import NewContractPage from './pages/NewContractPage';
import ContractDetailPage from './pages/ContractDetailPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { useOnlineStatus } from './hooks/useOnlineStatus';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <DashboardPage />;
}

function AppShell() {
  const isOnline = useOnlineStatus();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(165deg, #e2f7f3 0%, #eff6ff 55%, #f8fafc 100%)',
        pb: 'env(safe-area-inset-bottom)'
      }}
    >
      <Topbar />
      {!isOnline && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          Sin conexión — mostrando datos guardados.
        </Alert>
      )}
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, md: 3 } }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/magic/:token" element={<MagicLoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin/new-contract" element={<NewContractPage />} />
          </Route>
        </Routes>
      </Container>
    </Box>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Verificar en browser**

```bash
npm run dev
```

En Chrome DevTools → Network → Offline: debe aparecer el banner amarillo "Sin conexión". Al volver a Online: desaparece.

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useOnlineStatus.js client/src/App.jsx
git commit -m "feat(pwa): add offline banner and safe-area insets"
```

---

## Task 3: Tema Global — Touch Targets

**Files:**
- Modify: `client/src/theme.js`

**Interfaces:**
- Produces: Todos los `Button` de MUI tienen `minHeight: 44px` automáticamente.

- [ ] **Step 1: Actualizar `client/src/theme.js`**

Reemplazar el contenido completo:

```js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0f766e' },
    secondary: { main: '#0ea5e9' },
    background: { default: '#f1f5f9', paper: '#ffffff' }
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Poppins, "Segoe UI", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.07)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 44 }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { minHeight: 48 }
      }
    }
  }
});

export default theme;
```

- [ ] **Step 2: Verificar en browser**

```bash
npm run dev
```

En DevTools → Elements, seleccionar cualquier `<button>` del Topbar → debe tener `min-height: 44px` en Computed styles.

- [ ] **Step 3: Commit**

```bash
git add client/src/theme.js
git commit -m "feat(ui): set minimum touch target heights in theme"
```

---

## Task 4: Topbar — Drawer Mejorado

**Files:**
- Modify: `client/src/components/Topbar.jsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ user: { name, role }, logout }`
- Produces: AppBar responsive (56px mobile / 64px desktop), Drawer de 280px con cabecera de usuario.

- [ ] **Step 1: Reemplazar `client/src/components/Topbar.jsx`**

```jsx
import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import HomeIcon from '@mui/icons-material/Home';
import LockIcon from '@mui/icons-material/Lock';
import LockResetIcon from '@mui/icons-material/LockReset';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 280;

export default function Topbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (!user) return null;

  const navLinks = [
    { to: '/', label: 'Inicio', icon: <HomeIcon /> },
    { to: '/change-password', label: 'Cambiar contraseña', icon: <LockIcon /> },
    ...(user.role === 'admin'
      ? [{ to: '/admin/new-contract', label: 'Nuevo contrato', icon: <AddCircleIcon /> }]
      : [])
  ];

  const userInitial = (user.name || user.email || '?')[0].toUpperCase();
  const roleLabel = user.role === 'admin' ? 'Administrador' : 'Inquilino';

  return (
    <>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: '1px solid #dbe5ef', minHeight: { xs: 56, md: 64 } }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: { xs: 56, md: 64 } }}>
          <IconButton
            edge="start"
            onClick={() => setOpen(true)}
            sx={{ display: { md: 'none' } }}
            aria-label="Abrir menú"
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            sx={{ flexGrow: 1, textAlign: { xs: 'center', md: 'left' } }}
          >
            AlquilAR
          </Typography>

          <Chip
            label={roleLabel}
            color="primary"
            size="small"
            sx={{ display: { xs: 'none', md: 'flex' } }}
          />

          <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {navLinks.map((link) => (
              <Button
                key={link.to}
                component={RouterLink}
                to={link.to}
                variant={location.pathname === link.to ? 'contained' : 'text'}
                startIcon={link.icon}
              >
                {link.label}
              </Button>
            ))}
            <Button onClick={logout} color="inherit" startIcon={<LogoutIcon />}>
              Salir
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: DRAWER_WIDTH } }}
      >
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44, fontWeight: 700 }}>
            {userInitial}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
              {user.name || user.email}
            </Typography>
            <Chip label={roleLabel} color="primary" size="small" sx={{ mt: 0.3 }} />
          </Box>
        </Box>

        <Divider />

        <List disablePadding>
          {navLinks.map((link) => (
            <ListItemButton
              key={link.to}
              component={RouterLink}
              to={link.to}
              selected={location.pathname === link.to}
              onClick={() => setOpen(false)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{link.icon}</ListItemIcon>
              <ListItemText primary={link.label} />
            </ListItemButton>
          ))}
        </List>

        <Divider sx={{ mt: 'auto' }} />

        <List disablePadding>
          <ListItemButton onClick={() => { setOpen(false); logout(); }}>
            <ListItemIcon sx={{ minWidth: 40 }}><LogoutIcon /></ListItemIcon>
            <ListItemText primary="Cerrar sesión" />
          </ListItemButton>
        </List>
      </Drawer>
    </>
  );
}
```

- [ ] **Step 2: Verificar en browser**

```bash
npm run dev
```

- En viewport 390px (iPhone 14): AppBar muestra hamburger + "AlquilAR" centrado
- Tap en hamburger → Drawer de 280px con avatar, nombre, chip de rol, ítems con íconos, divider antes de "Cerrar sesión"
- En viewport 1024px+: Drawer no aparece, botones de nav visibles en el AppBar

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Topbar.jsx
git commit -m "feat(ui): redesign drawer with user avatar, role chip, and 48px touch targets"
```

---

## Task 5: DashboardPage — Grid Responsive + FAB + Empty State

**Files:**
- Modify: `client/src/pages/DashboardPage.jsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ user }` para FAB admin
- Consumes: `api.get('/contracts')` → array de contratos

- [ ] **Step 1: Reemplazar `client/src/pages/DashboardPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Fab,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIcon from '@mui/icons-material/Assignment';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDateDisplay, formatMoneyNoDecimals } from '../utils/formatters';

const NEAR_EXPIRATION_DAYS = 15;

export default function DashboardPage() {
  const [contracts, setContracts] = useState([]);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    api.get('/contracts')
      .then((res) => setContracts(res.data))
      .catch((err) => setError(err?.response?.data?.message || 'No se pudieron cargar contratos'));
  }, []);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant={{ xs: 'h5', md: 'h4' }} component="h1">Contratos</Typography>
        <Typography variant="body2" color="text.secondary">
          Seguimiento de alquileres, incrementos y recibos.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {contracts.length === 0 && !error && (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}
        >
          <AssignmentIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.secondary">
            No hay contratos aún
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {isAdmin ? 'Creá el primer contrato para comenzar.' : 'Tu administrador aún no asignó contratos.'}
          </Typography>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/admin/new-contract')}
            >
              Nuevo contrato
            </Button>
          )}
        </Box>
      )}

      <Grid container spacing={2}>
        {contracts.map((c) => {
          const daysUntilExpiration = dayjs(c.expirationDate).startOf('day').diff(dayjs().startOf('day'), 'day');
          const isExpired = c.status === 'expired' || daysUntilExpiration < 0;
          const isNearExpiration = !isExpired && daysUntilExpiration >= 0 && daysUntilExpiration <= NEAR_EXPIRATION_DAYS;

          const borderColor = isExpired ? 'error.main' : isNearExpiration ? 'warning.main' : 'divider';
          const bgColor = isExpired
            ? 'rgba(211, 47, 47, 0.06)'
            : isNearExpiration
              ? 'rgba(237, 108, 2, 0.08)'
              : 'background.paper';

          return (
            <Grid item xs={12} sm={6} md={4} key={c._id}>
              <Card sx={{ height: '100%', border: '1px solid', borderColor, backgroundColor: bgColor }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                      <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                        {c.title}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexShrink={0}>
                        <Chip label={c.indexType} size="small" color="secondary" sx={{ color: 'common.white' }} />
                        {isExpired && <Chip label="Expirado" size="small" color="error" />}
                        {isNearExpiration && <Chip label="Por vencer" size="small" color="warning" />}
                      </Stack>
                    </Stack>

                    <Typography variant="h5" component="p" color="primary.main" fontWeight={700}>
                      {formatMoneyNoDecimals(c.currentAmountUsd)}
                    </Typography>

                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <Box>
                        <Typography variant="caption" color="text.disabled" display="block">Próx. incremento</Typography>
                        <Typography variant="body2" fontWeight={500}>{formatDateDisplay(c.nextIncrementDate)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.disabled" display="block">Vence</Typography>
                        <Typography variant="body2" fontWeight={500}>{formatDateDisplay(c.expirationDate)}</Typography>
                      </Box>
                    </Stack>

                    {c.tenant?.name && (
                      <Typography variant="caption" color="text.secondary">
                        Inquilino: <strong>{c.tenant.name}</strong>
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    component={RouterLink}
                    to={`/contracts/${c._id}`}
                    startIcon={<VisibilityIcon />}
                    variant="outlined"
                    fullWidth
                  >
                    Ver detalle
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {isAdmin && (
        <Fab
          color="primary"
          onClick={() => navigate('/admin/new-contract')}
          aria-label="Nuevo contrato"
          sx={{
            position: 'fixed',
            bottom: 'calc(24px + env(safe-area-inset-bottom))',
            right: 24,
            display: { xs: 'flex', md: 'none' }
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Stack>
  );
}
```

- [ ] **Step 2: Verificar en browser**

```bash
npm run dev
```

- En mobile (390px): 1 columna, monto ARS en grande, botón "Ver detalle" ocupa todo el ancho, FAB visible (si admin)
- En tablet (768px): 2 columnas
- En desktop (1280px): 3 columnas, FAB oculto
- Sin contratos: empty state con ícono + texto + botón

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/DashboardPage.jsx
git commit -m "feat(ui): responsive dashboard grid, prominent ARS amount, FAB for admin"
```

---

## Task 6: ContractDetailPage — Acordeones Mobile + Botón Volver

**Files:**
- Modify: `client/src/pages/ContractDetailPage.jsx`

**Interfaces:**
- Consumes: `useMediaQuery(theme.breakpoints.down('md'))` para detectar mobile
- Consumes: `useNavigate()` para botón volver
- Produces: Layout con 4 acordeones en mobile (`xs`/`sm`), layout de cards apiladas en desktop.

- [ ] **Step 1: Reemplazar `client/src/pages/ContractDetailPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PaymentIcon from '@mui/icons-material/Payment';
import PreviewIcon from '@mui/icons-material/Preview';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DownloadIcon from '@mui/icons-material/Download';
import LinkIcon from '@mui/icons-material/Link';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProjectionChart from '../components/ProjectionChart';
import {
  formatCompactMoney,
  formatDateDisplay,
  formatMoneyNoDecimals,
  formatMonthYearDisplay
} from '../utils/formatters';

const NEAR_INCREMENT_DAYS = 15;
const NEAR_EXPIRATION_DAYS = 15;
const INDEXES = ['ICL', 'IPC', 'CasaPropia', 'CAC', 'CER', 'IS', 'IPIM', 'UVA', 'OTHER'];

const SOURCE_LABELS = {
  start: 'Inicio',
  manual_next_amount: 'Manual confirmado',
  estimated_manual_next: 'Manual estimado',
  estimated_increment: 'Indice estimado',
  confirmed_increment: 'Indice confirmado',
  arquiler_api: 'Indice API',
  manual_override: 'Override'
};

function statusChip(status) {
  if (status === 'paid') return <Chip size="small" color="success" label="Pagada" />;
  if (status === 'past') return <Chip size="small" color="warning" label="Pasada" />;
  if (status === 'current') return <Chip size="small" color="info" label="Actual" />;
  return <Chip size="small" label="Futura" />;
}

function InstallmentCard({ row, isAdmin, onDownload, onGenerate, generatingKey }) {
  const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
  return (
    <Card variant="outlined" sx={{ p: 0 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="subtitle2" fontWeight={600}>
              {formatMonthYearDisplay(row.periodStart)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatMoneyNoDecimals(row.amountUsd)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {statusChip(row.status)}
            {row.receiptId && (
              <Button
                size="small"
                variant="text"
                startIcon={<DownloadIcon />}
                onClick={() => onDownload(row.receiptId, row.year, row.month)}
              >
                Recibo
              </Button>
            )}
            {isAdmin && (
              <Button
                size="small"
                variant={row.receiptId ? 'outlined' : 'contained'}
                startIcon={<PaymentIcon />}
                onClick={() => onGenerate(row.year, row.month)}
                disabled={generatingKey === key}
              >
                {row.receiptId ? 'Regen.' : 'Generar'}
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ContractDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [contract, setContract] = useState(null);
  const [projection, setProjection] = useState([]);
  const [preview, setPreview] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [error, setError] = useState('');

  const [manualNextAmountInput, setManualNextAmountInput] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const [magicLink, setMagicLink] = useState('');
  const [generatingMagicLink, setGeneratingMagicLink] = useState(false);

  const [renewStartDateInput, setRenewStartDateInput] = useState('');
  const [renewBaseAmountInput, setRenewBaseAmountInput] = useState('');
  const [renewDurationYearsInput, setRenewDurationYearsInput] = useState('');
  const [renewing, setRenewing] = useState(false);

  const [editForm, setEditForm] = useState({
    title: '',
    tenantId: '',
    startDate: '',
    baseAmountUsd: '',
    incrementFrequencyMonths: 3,
    durationYears: 2,
    indexType: 'ICL',
    manualOverridePercent: 0
  });
  const [tenants, setTenants] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [generatingReceiptKey, setGeneratingReceiptKey] = useState('');

  const isAdmin = user?.role === 'admin';

  const load = async () => {
    const [c, p, s] = await Promise.all([
      api.get(`/contracts/${id}`),
      api.get(`/contracts/${id}/projection`),
      api.get(`/contracts/${id}/installments`)
    ]);

    setContract(c.data);
    setProjection(p.data.points || []);
    setInstallments(s.data.installments || []);

    setManualNextAmountInput(
      c.data.manualNextAmountUsd !== null && c.data.manualNextAmountUsd !== undefined
        ? String(c.data.manualNextAmountUsd)
        : ''
    );
    setRenewStartDateInput(dayjs(c.data.expirationDate).format('YYYY-MM-DD'));
    setRenewBaseAmountInput(String(c.data.currentAmountUsd || c.data.baseAmountUsd || ''));
    setRenewDurationYearsInput(String(c.data.durationYears || ''));

    setEditForm({
      title: c.data.title || '',
      tenantId: c.data.tenant?._id || c.data.tenant || '',
      startDate: dayjs(c.data.startDate).format('YYYY-MM-DD'),
      baseAmountUsd: String(c.data.baseAmountUsd ?? ''),
      incrementFrequencyMonths: Number(c.data.incrementFrequencyMonths || 3),
      durationYears: Number(c.data.durationYears || 2),
      indexType: c.data.indexType || 'ICL',
      manualOverridePercent: Number(c.data.manualOverridePercent || 0)
    });
  };

  useEffect(() => {
    load().catch((err) => setError(err?.response?.data?.message || 'No se pudo cargar el contrato'));
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/auth/admin/users')
      .then((res) => setTenants(res.data || []))
      .catch(() => setTenants([]));
  }, [isAdmin]);

  const previewIncrement = async () => {
    const { data } = await api.post(`/contracts/${id}/increments/preview`);
    setPreview(data);
  };

  const confirmIncrement = async () => {
    await api.post(`/contracts/${id}/increments/confirm`);
    await load();
    setPreview(null);
  };

  const genReceipt = async () => {
    await api.post(`/contracts/${id}/receipts/generate`);
    await load();
  };

  const saveContractEdits = async () => {
    setError('');
    const payload = {
      title: editForm.title,
      tenantId: editForm.tenantId,
      startDate: editForm.startDate,
      baseAmountUsd: Number(editForm.baseAmountUsd),
      incrementFrequencyMonths: Number(editForm.incrementFrequencyMonths),
      durationYears: Number(editForm.durationYears),
      indexType: editForm.indexType,
      manualOverridePercent: Number(editForm.manualOverridePercent)
    };

    if (!payload.title || !payload.tenantId || !payload.startDate || !Number.isFinite(payload.baseAmountUsd) || payload.baseAmountUsd <= 0) {
      setError('Completa titulo, inquilino, fecha de inicio y monto base valido');
      return;
    }

    setSavingEdit(true);
    try {
      await api.patch(`/contracts/${id}`, payload);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo editar el contrato');
    } finally {
      setSavingEdit(false);
    }
  };

  const downloadReceiptById = async (receiptId, year, month) => {
    setError('');
    try {
      const response = await api.get(`/receipts/${receiptId}/download`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `recibo-${id}-${year}-${String(month).padStart(2, '0')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo descargar el comprobante');
    }
  };

  const genReceiptForMonth = async (year, month) => {
    setError('');
    const key = `${year}-${String(month).padStart(2, '0')}`;
    setGeneratingReceiptKey(key);
    try {
      const { data } = await api.post(`/contracts/${id}/receipts/generate`, null, { params: { year, month } });
      await load();
      if (data?._id) await downloadReceiptById(data._id, year, month);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo generar el comprobante para ese periodo');
    } finally {
      setGeneratingReceiptKey('');
    }
  };

  const generateMagicLinkForContract = async () => {
    setError('');
    setGeneratingMagicLink(true);
    try {
      const tenantId = contract?.tenant?._id || contract?.tenant;
      if (!tenantId) throw new Error('Contrato sin inquilino asignado');
      const { data } = await api.post('/auth/magic-link/request', { userId: tenantId });
      setMagicLink(data.link || '');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'No se pudo generar el magic link');
    } finally {
      setGeneratingMagicLink(false);
    }
  };

  const saveManualNextAmount = async () => {
    setError('');
    const value = Number(manualNextAmountInput);
    if (!Number.isFinite(value) || value <= 0) {
      setError('El monto manual debe ser un numero mayor a 0');
      return;
    }
    setSavingManual(true);
    try {
      await api.patch(`/contracts/${id}`, { manualNextAmountUsd: value });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo guardar el monto manual');
    } finally {
      setSavingManual(false);
    }
  };

  const clearManualNextAmount = async () => {
    setError('');
    setSavingManual(true);
    try {
      await api.patch(`/contracts/${id}`, { manualNextAmountUsd: null });
      await load();
      setPreview(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo limpiar el monto manual');
    } finally {
      setSavingManual(false);
    }
  };

  const renewContract = async () => {
    setError('');
    const baseAmount = Number(renewBaseAmountInput);
    const durationYears = Number(renewDurationYearsInput);
    if (!renewStartDateInput) { setError('La fecha de inicio del nuevo contrato es obligatoria'); return; }
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) { setError('El monto inicial debe ser mayor a 0'); return; }
    if (!Number.isFinite(durationYears) || durationYears <= 0) { setError('La duracion debe ser mayor a 0'); return; }
    setRenewing(true);
    try {
      const { data } = await api.post(`/contracts/${id}/renew`, { startDate: renewStartDateInput, baseAmountUsd: baseAmount, durationYears });
      if (data?.newContract?._id) { navigate(`/contracts/${data.newContract._id}`); return; }
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo renovar el contrato');
    } finally {
      setRenewing(false);
    }
  };

  if (!contract) return <Typography sx={{ p: 3 }}>Cargando...</Typography>;

  const periodMonths = Number(contract.incrementFrequencyMonths || 0);
  const periodEnd = dayjs(contract.nextIncrementDate).startOf('month').format('YYYY-MM-DD');
  const periodStart = dayjs(contract.nextIncrementDate).subtract(periodMonths, 'month').startOf('month').format('YYYY-MM-DD');

  const daysUntilIncrement = dayjs(contract.nextIncrementDate).startOf('day').diff(dayjs().startOf('day'), 'day');
  const isIncrementOverdue = daysUntilIncrement < 0;
  const isIncrementNear = daysUntilIncrement >= 0 && daysUntilIncrement <= NEAR_INCREMENT_DAYS;
  const nextIncrementChipColor = isIncrementOverdue ? 'error' : isIncrementNear ? 'warning' : 'default';

  const daysUntilExpiration = dayjs(contract.expirationDate).startOf('day').diff(dayjs().startOf('day'), 'day');
  const isExpirationOverdue = daysUntilExpiration < 0;
  const isExpirationNear = daysUntilExpiration >= 0 && daysUntilExpiration <= NEAR_EXPIRATION_DAYS;
  const expirationChipColor = isExpirationOverdue ? 'error' : isExpirationNear ? 'warning' : 'default';

  const isContractExpired = contract.status === 'expired';

  const infoContent = (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Box>
          <Typography variant="caption" color="text.disabled">Monto actual</Typography>
          <Typography variant="h5" fontWeight={700} color="primary.main">
            {formatMoneyNoDecimals(contract.currentAmountUsd)}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip label={`Índice: ${contract.indexType}`} color="secondary" size="small" sx={{ color: 'common.white' }} />
        <Chip label={`Próx. incremento: ${formatDateDisplay(contract.nextIncrementDate)}`} size="small" color={nextIncrementChipColor} />
        <Chip label={`Vence: ${formatDateDisplay(contract.expirationDate)}`} size="small" color={expirationChipColor} />
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Inquilino: <strong>{contract.tenant?.name}</strong>
      </Typography>

      {isContractExpired && <Alert severity="error">Este contrato está marcado como expirado.</Alert>}
      {(isIncrementNear || isIncrementOverdue) && (
        <Alert severity={isIncrementOverdue ? 'error' : 'warning'}>
          {isIncrementOverdue
            ? `El incremento está vencido desde hace ${Math.abs(daysUntilIncrement)} días.`
            : `Faltan ${daysUntilIncrement} días para el próximo incremento.`}
        </Alert>
      )}
      {(isExpirationNear || isExpirationOverdue) && (
        <Alert severity={isExpirationOverdue ? 'error' : 'warning'}>
          {isExpirationOverdue
            ? `El contrato está vencido desde hace ${Math.abs(daysUntilExpiration)} días.`
            : `Faltan ${daysUntilExpiration} días para el vencimiento del contrato.`}
        </Alert>
      )}
      {contract.manualNextAmountUsd !== null && contract.manualNextAmountUsd !== undefined && (
        <Alert severity="info">Próxima cuota manual pendiente: {formatCompactMoney(contract.manualNextAmountUsd)}</Alert>
      )}
    </Stack>
  );

  const chartContent = (
    <ProjectionChart
      data={projection}
      currentPeriodStart={periodStart}
      currentPeriodEnd={periodEnd}
      periodMonths={periodMonths}
      height={isMobile ? 200 : 300}
    />
  );

  const installmentsContent = isMobile ? (
    <Stack spacing={1}>
      {installments.map((row) => (
        <InstallmentCard
          key={`${row.year}-${row.month}`}
          row={row}
          isAdmin={isAdmin}
          onDownload={downloadReceiptById}
          onGenerate={genReceiptForMonth}
          generatingKey={generatingReceiptKey}
        />
      ))}
    </Stack>
  ) : (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Periodo</TableCell>
            <TableCell>Monto</TableCell>
            {isAdmin && <TableCell>Origen</TableCell>}
            <TableCell>Estado</TableCell>
            <TableCell>Comprobante</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {installments.map((row) => (
            <TableRow key={`${row.year}-${row.month}`} hover>
              <TableCell>{formatMonthYearDisplay(row.periodStart)}</TableCell>
              <TableCell>{formatMoneyNoDecimals(row.amountUsd)}</TableCell>
              {isAdmin && <TableCell>{SOURCE_LABELS[row.source] || row.source}</TableCell>}
              <TableCell>{statusChip(row.status)}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {row.receiptId ? (
                    <Button size="small" variant="text" startIcon={<DownloadIcon />} onClick={() => downloadReceiptById(row.receiptId, row.year, row.month)}>
                      Descargar
                    </Button>
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                  {isAdmin && (
                    <Button
                      size="small"
                      variant={row.receiptId ? 'outlined' : 'contained'}
                      startIcon={<PaymentIcon />}
                      onClick={() => genReceiptForMonth(row.year, row.month)}
                      disabled={generatingReceiptKey === `${row.year}-${String(row.month).padStart(2, '0')}`}
                    >
                      {row.receiptId ? 'Regenerar' : 'Generar'}
                    </Button>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const adminContent = isAdmin && (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>Editar contrato</Typography>
            <TextField label="Titulo" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} fullWidth inputProps={{ style: { fontSize: 16 } }} />
            <TextField select label="Inquilino" value={editForm.tenantId} onChange={(e) => setEditForm((f) => ({ ...f, tenantId: e.target.value }))} fullWidth inputProps={{ style: { fontSize: 16 } }}>
              <MenuItem value="">Seleccionar</MenuItem>
              {tenants.map((t) => <MenuItem key={t._id || t.id} value={t._id || t.id}>{t.name} ({t.email})</MenuItem>)}
            </TextField>
            <TextField type="date" label="Fecha inicio" InputLabelProps={{ shrink: true }} value={editForm.startDate} onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} fullWidth inputProps={{ style: { fontSize: 16 } }} />
            <TextField type="number" label="Monto inicial ARS" inputProps={{ step: '0.01', min: 0, style: { fontSize: 16 } }} value={editForm.baseAmountUsd} onChange={(e) => setEditForm((f) => ({ ...f, baseAmountUsd: e.target.value }))} fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Frecuencia (meses)" value={editForm.incrementFrequencyMonths} onChange={(e) => setEditForm((f) => ({ ...f, incrementFrequencyMonths: e.target.value }))} fullWidth inputProps={{ style: { fontSize: 16 } }}>
                {[2, 3, 4, 6, 12].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
              <TextField type="number" label="Duracion (años)" inputProps={{ min: 1, style: { fontSize: 16 } }} value={editForm.durationYears} onChange={(e) => setEditForm((f) => ({ ...f, durationYears: e.target.value }))} fullWidth />
              <TextField select label="Indice" value={editForm.indexType} onChange={(e) => setEditForm((f) => ({ ...f, indexType: e.target.value }))} fullWidth inputProps={{ style: { fontSize: 16 } }}>
                {INDEXES.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField type="number" label="Override % (interno)" inputProps={{ step: '0.01', style: { fontSize: 16 } }} value={editForm.manualOverridePercent} onChange={(e) => setEditForm((f) => ({ ...f, manualOverridePercent: e.target.value }))} fullWidth />
            <Button variant="contained" onClick={saveContractEdits} disabled={savingEdit} fullWidth={isMobile}>
              Guardar cambios del contrato
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Divider />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField type="number" label="Proxima cuota manual ARS" inputProps={{ step: '0.01', min: 0, style: { fontSize: 16 } }} value={manualNextAmountInput} onChange={(e) => setManualNextAmountInput(e.target.value)} fullWidth />
        <Button variant="contained" onClick={saveManualNextAmount} disabled={savingManual} sx={{ flexShrink: 0 }}>Guardar</Button>
        <Button variant="outlined" onClick={clearManualNextAmount} disabled={savingManual} sx={{ flexShrink: 0 }}>Limpiar</Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
        <Button variant="outlined" startIcon={<PreviewIcon />} onClick={previewIncrement} fullWidth={isMobile}>Previsualizar incremento</Button>
        <Button variant="contained" startIcon={<TaskAltIcon />} onClick={confirmIncrement} fullWidth={isMobile}>Confirmar incremento</Button>
        <Button variant="outlined" startIcon={<PaymentIcon />} onClick={genReceipt} fullWidth={isMobile}>Generar recibo del mes</Button>
        <Button variant="outlined" startIcon={<LinkIcon />} onClick={generateMagicLinkForContract} disabled={generatingMagicLink} fullWidth={isMobile}>
          Generar magic link
        </Button>
      </Stack>

      {magicLink && (
        <Alert severity="info">
          Magic link: <Link href={magicLink} target="_blank" rel="noreferrer">Abrir enlace</Link>
        </Alert>
      )}
      {preview && (
        <Alert severity="success">
          Incremento según índice {contract.indexType}: {preview.percent.toFixed(2)}% → {formatCompactMoney(preview.newAmount)}
        </Alert>
      )}

      <Divider />

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>Expirar y crear nuevo contrato</Typography>
            <TextField type="date" label="Inicio nuevo contrato" InputLabelProps={{ shrink: true }} value={renewStartDateInput} onChange={(e) => setRenewStartDateInput(e.target.value)} fullWidth inputProps={{ style: { fontSize: 16 } }} />
            <TextField type="number" label="Monto inicial ARS" inputProps={{ step: '0.01', min: 0, style: { fontSize: 16 } }} value={renewBaseAmountInput} onChange={(e) => setRenewBaseAmountInput(e.target.value)} fullWidth />
            <TextField type="number" label="Duracion (años)" inputProps={{ step: '1', min: 1, style: { fontSize: 16 } }} value={renewDurationYearsInput} onChange={(e) => setRenewDurationYearsInput(e.target.value)} fullWidth />
            <Button variant="contained" color="warning" onClick={renewContract} disabled={renewing} fullWidth={isMobile}>
              Expirar contrato y crear nuevo
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );

  if (isMobile) {
    return (
      <Stack spacing={1.5}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ alignSelf: 'flex-start' }}
        >
          Contratos
        </Button>

        <Typography variant="h5" fontWeight={700}>{contract.title}</Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Información del contrato</Typography>
          </AccordionSummary>
          <AccordionDetails>{infoContent}</AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Proyección</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>{chartContent}</AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Cuotas e historial</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1 }}>{installmentsContent}</AccordionDetails>
        </Accordion>

        {isAdmin && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>Gestión</Typography>
            </AccordionSummary>
            <AccordionDetails>{adminContent}</AccordionDetails>
          </Accordion>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ alignSelf: 'flex-start' }}>
        Contratos
      </Button>

      {error && <Alert severity="error">{error}</Alert>}

      <Card sx={{
        border: isContractExpired ? '1px solid' : 'none',
        borderColor: isContractExpired ? 'error.main' : 'transparent',
        backgroundColor: isContractExpired ? 'rgba(211, 47, 47, 0.06)' : 'background.paper'
      }}>
        <CardContent>
          <Stack spacing={0.5} sx={{ mb: 1.5 }}>
            <Typography variant="h5">{contract.title}</Typography>
          </Stack>
          {infoContent}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card sx={{
          border: isContractExpired ? '1px solid' : 'none',
          borderColor: isContractExpired ? 'error.main' : 'transparent',
          backgroundColor: isContractExpired ? 'rgba(211, 47, 47, 0.06)' : 'background.paper'
        }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1.5 }}>Acciones de administración</Typography>
            {adminContent}
          </CardContent>
        </Card>
      )}

      {chartContent}

      <Card sx={{
        border: isContractExpired ? '1px solid' : 'none',
        borderColor: isContractExpired ? 'error.main' : 'transparent',
        backgroundColor: isContractExpired ? 'rgba(211, 47, 47, 0.06)' : 'background.paper'
      }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Cuotas del contrato (histórico + proyección)</Typography>
          {installmentsContent}
        </CardContent>
      </Card>
    </Stack>
  );
}
```

- [ ] **Step 2: Actualizar `ProjectionChart.jsx` para aceptar prop `height`**

Leer `client/src/components/ProjectionChart.jsx` y verificar si `height` ya es configurable. Si `ResponsiveContainer` tiene `height={300}` hardcodeado, agregar la prop:

Abrir el archivo y cambiar:
```jsx
<ResponsiveContainer width="100%" height={300}>
```
por:
```jsx
<ResponsiveContainer width="100%" height={height ?? 300}>
```

Y agregar `height` como prop en la firma del componente:
```jsx
export default function ProjectionChart({ data, currentPeriodStart, currentPeriodEnd, periodMonths, height }) {
```

- [ ] **Step 3: Verificar en browser**

```bash
npm run dev
```

- En mobile (390px): botón "← Contratos", título, 4 acordeones. El primero expandido muestra monto ARS grande. "Gestión" visible solo para admin.
- En desktop (1280px): layout de cards apiladas, sin acordeones, botón "← Contratos" en top.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ContractDetailPage.jsx client/src/components/ProjectionChart.jsx
git commit -m "feat(ui): accordion layout for ContractDetailPage on mobile, back button"
```

---

## Task 7: NewContractPage — Dialog Mobile + Anti-zoom

**Files:**
- Modify: `client/src/pages/NewContractPage.jsx`

**Interfaces:**
- Consumes: `useTheme()` + `useMediaQuery()` para detectar mobile
- Produces: En mobile, "Crear inquilino" se mueve a un `Dialog`. Todos los campos con `fontSize: 16`.

- [ ] **Step 1: Reemplazar `client/src/pages/NewContractPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Link,
  useMediaQuery,
  useTheme
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LinkIcon from '@mui/icons-material/Link';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api/client';

const INDEXES = ['ICL', 'IPC', 'CasaPropia', 'CAC', 'CER', 'IS', 'IPIM', 'UVA', 'OTHER'];
const INPUT_STYLE = { style: { fontSize: 16 } };

export default function NewContractPage() {
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [form, setForm] = useState({
    title: '',
    tenantId: '',
    startDate: '',
    baseAmountUsd: '',
    incrementFrequencyMonths: 3,
    durationYears: 2,
    indexType: 'ICL',
    manualOverridePercent: 0
  });

  const [newTenant, setNewTenant] = useState({ name: '', email: '', password: '' });
  const [magicLink, setMagicLink] = useState('');
  const navigate = useNavigate();

  const loadTenants = async () => {
    const { data } = await api.get('/auth/admin/users');
    setTenants(data);
  };

  useEffect(() => {
    loadTenants().catch(() => setError('No se pudieron cargar inquilinos'));
  }, []);

  const createTenant = async () => {
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post('/auth/admin/users', newTenant);
      await loadTenants();
      setForm((f) => ({ ...f, tenantId: data.id }));
      setNewTenant({ name: '', email: '', password: '' });
      setSuccess('Inquilino creado correctamente');
      setTenantDialogOpen(false);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo crear el inquilino');
    }
  };

  const generateMagicLink = async () => {
    setError('');
    if (!form.tenantId) { setError('Seleccioná un inquilino antes de generar el magic link'); return; }
    try {
      const { data } = await api.post('/auth/magic-link/request', { userId: form.tenantId });
      setMagicLink(data.link);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo generar el magic link');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/contracts', {
        ...form,
        baseAmountUsd: Number(form.baseAmountUsd),
        incrementFrequencyMonths: Number(form.incrementFrequencyMonths),
        durationYears: Number(form.durationYears),
        manualOverridePercent: Number(form.manualOverridePercent)
      });
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo crear el contrato');
    }
  };

  const tenantForm = (
    <Stack spacing={2}>
      <TextField label="Nombre" value={newTenant.name} onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })} inputProps={INPUT_STYLE} fullWidth />
      <TextField label="Email" value={newTenant.email} onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })} inputProps={INPUT_STYLE} fullWidth />
      <TextField label="Contraseña inicial" type="password" value={newTenant.password} onChange={(e) => setNewTenant({ ...newTenant, password: e.target.value })} inputProps={INPUT_STYLE} fullWidth />
    </Stack>
  );

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant={{ xs: 'h5', md: 'h4' }} component="h1">Nuevo contrato</Typography>
        <Typography variant="body2" color="text.secondary">Carga rápida de contrato e inquilino desde una sola pantalla.</Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Stack component="form" onSubmit={submit} spacing={2}>
                <TextField label="Título" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} inputProps={INPUT_STYLE} fullWidth />
                <TextField select label="Inquilino" required value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} fullWidth inputProps={INPUT_STYLE}>
                  <MenuItem value="">Seleccionar</MenuItem>
                  {tenants.map((t) => <MenuItem key={t._id || t.id} value={t._id || t.id}>{t.name} ({t.email})</MenuItem>)}
                </TextField>

                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField type="date" label="Fecha inicio" required fullWidth InputLabelProps={{ shrink: true }} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} inputProps={{ ...INPUT_STYLE.style && { style: { fontSize: 16 } } }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField type="number" label="Monto inicial ARS" required fullWidth inputProps={{ step: '0.01', style: { fontSize: 16 } }} value={form.baseAmountUsd} onChange={(e) => setForm({ ...form, baseAmountUsd: e.target.value })} />
                  </Grid>
                </Grid>

                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={4}>
                    <TextField select label="Frecuencia (meses)" fullWidth value={form.incrementFrequencyMonths} onChange={(e) => setForm({ ...form, incrementFrequencyMonths: e.target.value })} inputProps={{ style: { fontSize: 16 } }}>
                      {[2, 3, 4, 6, 12].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField type="number" label="Duración (años)" fullWidth inputProps={{ min: 1, style: { fontSize: 16 } }} value={form.durationYears} onChange={(e) => setForm({ ...form, durationYears: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select label="Índice" fullWidth value={form.indexType} onChange={(e) => setForm({ ...form, indexType: e.target.value })} inputProps={{ style: { fontSize: 16 } }}>
                      {INDEXES.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>

                <TextField type="number" label="Override % (interno)" fullWidth inputProps={{ step: '0.01', style: { fontSize: 16 } }} value={form.manualOverridePercent} onChange={(e) => setForm({ ...form, manualOverridePercent: e.target.value })} />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                  <Button type="submit" variant="contained" startIcon={<SaveIcon />} fullWidth={isMobile}>Guardar contrato</Button>
                  <Button type="button" variant="outlined" startIcon={<LinkIcon />} onClick={generateMagicLink} fullWidth={isMobile}>Generar magic link</Button>
                  <Button type="button" variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setTenantDialogOpen(true)} fullWidth={isMobile} sx={{ display: { md: 'none' } }}>
                    Crear inquilino
                  </Button>
                </Stack>
                {magicLink && <Link href={magicLink} target="_blank" rel="noreferrer">Abrir enlace mágico</Link>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'block' } }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Crear inquilino</Typography>
                {tenantForm}
                <Divider />
                <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={createTenant}>Crear y asignar</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={tenantDialogOpen} onClose={() => setTenantDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Crear inquilino</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {tenantForm}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTenantDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={createTenant}>Crear y asignar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
```

- [ ] **Step 2: Verificar en browser**

```bash
npm run dev
```

- En mobile: un solo campo de formulario, botón "Crear inquilino" visible. Al tocar → Dialog con formulario.
- En desktop: layout de dos columnas, panel "Crear inquilino" visible en columna derecha, sin botón ni Dialog.
- En iOS (o DevTools simulando): ningún campo hace zoom al enfocarse.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/NewContractPage.jsx
git commit -m "feat(ui): move tenant creation to Dialog on mobile, add anti-zoom inputs"
```

---

## Task 8: LoginPage + ChangePasswordPage — Pulido Mobile

**Files:**
- Modify: `client/src/pages/LoginPage.jsx`
- Modify: `client/src/pages/ChangePasswordPage.jsx`

**Interfaces:**
- Produces: Campos sin zoom en iOS, botón Google fullWidth en mobile.

- [ ] **Step 1: Leer `LoginPage.jsx` y `ChangePasswordPage.jsx`**

Leer ambos archivos para identificar todos los `TextField` y el botón de Google.

- [ ] **Step 2: En `LoginPage.jsx`, agregar `inputProps={{ style: { fontSize: 16 } }}` a todos los `TextField` y `fullWidth` al botón `GoogleLogin`**

Buscar el componente `<GoogleLogin` y asegurarse de que esté dentro de un `Box` con `width: '100%'`:

```jsx
<Box sx={{ width: '100%' }}>
  <GoogleLogin onSuccess={...} onError={...} width="100%" />
</Box>
```

Agregar a todos los `TextField` de email y password:
```jsx
inputProps={{ style: { fontSize: 16 } }}
```

- [ ] **Step 3: En `ChangePasswordPage.jsx`, agregar `inputProps={{ style: { fontSize: 16 } }}` a todos los `TextField` y `fullWidth` al botón de submit**

- [ ] **Step 4: Verificar en browser**

```bash
npm run dev
```

- Simular iPhone en DevTools, enfocar cualquier campo → sin zoom
- Botón de Google visible a full ancho en mobile

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/LoginPage.jsx client/src/pages/ChangePasswordPage.jsx
git commit -m "feat(ui): anti-zoom inputs and full-width Google button on mobile"
```

---

## Self-Review

**Spec coverage:**
- [x] PWA: Workbox NetworkFirst para `/api/*`, CacheFirst para assets → Task 1
- [x] Manifest icons separados por purpose → Task 1
- [x] Página offline → Task 1
- [x] Pre-caché SPA (globPatterns cubre el app shell) → Task 1
- [x] Banner offline + safe-area → Task 2
- [x] MuiButton.minHeight: 44px → Task 3
- [x] MuiListItemButton.minHeight: 48px → Task 3
- [x] Drawer 280px con avatar, rol, íconos → Task 4
- [x] AppBar mobile 56px centrado → Task 4
- [x] Dashboard: xs:1col/sm:2col/md:3col → Task 5
- [x] Card con monto ARS prominente → Task 5
- [x] FAB admin mobile → Task 5
- [x] Empty state → Task 5
- [x] ContractDetail: 4 acordeones en mobile → Task 6
- [x] ProjectionChart height={200} mobile → Task 6
- [x] Installment cards en mobile → Task 6
- [x] Botón ← Contratos → Task 6
- [x] Gestión solo admin, colapsado → Task 6
- [x] NewContractPage Dialog en mobile → Task 7
- [x] Anti-zoom iOS todos los campos → Tasks 6, 7, 8
- [x] LoginPage Google fullWidth → Task 8
- [x] Sin cambios en backend → respetado en todos los tasks

**Placeholder scan:** Ninguno encontrado.

**Type consistency:** `useOnlineStatus()` devuelve `boolean` — usado solo en Task 2, consistente. `ProjectionChart` recibe `height` prop — definida en Task 6 y usada en Task 6.
