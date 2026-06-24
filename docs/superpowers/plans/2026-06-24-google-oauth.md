# Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar autenticación con Google como método alternativo al login con email/contraseña, para todos los roles, con vinculación automática por email y auto-registro.

**Architecture:** El frontend obtiene un ID token de Google via popup nativo (`@react-oauth/google`), lo envía a un nuevo endpoint `POST /api/auth/google`, el backend lo verifica con `google-auth-library` y devuelve el mismo JWT propio de la app que usan todos los demás flujos de auth.

**Tech Stack:** `google-auth-library` (backend), `@react-oauth/google` (frontend), Mongoose, Express, React + MUI.

## Global Constraints

- Node.js ESM (`"type": "module"`) — usar `import/export`, nunca `require()`
- Todos los errores de API devuelven `{ message: string }` en español
- JWT response shape: `{ token, user: { id, name, role, email } }` — idéntico a `/auth/login`
- `passwordHash` pasa a ser opcional — no romper usuarios existentes
- No hay test runner instalado — verificación via `curl` (backend) y browser manual (frontend)

---

## File Map

| Archivo | Acción |
|---|---|
| `server/src/models/User.js` | Modificar: `passwordHash` opcional, agregar `googleId` |
| `server/src/routes/authRoutes.js` | Modificar: nuevo `POST /auth/google`, guard en `change-password` |
| `server/.env` | Modificar: agregar `GOOGLE_CLIENT_ID` |
| `server/.env.example` | Modificar: agregar `GOOGLE_CLIENT_ID=` |
| `client/src/main.jsx` | Modificar: envolver app con `GoogleOAuthProvider` |
| `client/src/context/AuthContext.jsx` | Modificar: agregar `loginWithGoogle` |
| `client/src/pages/LoginPage.jsx` | Modificar: agregar separador + botón Google |
| `client/.env` | Modificar: agregar `VITE_GOOGLE_CLIENT_ID` |
| `client/.env.example` | Modificar: agregar `VITE_GOOGLE_CLIENT_ID=` |

---

## Task 1: Backend — User model + variables de entorno

**Files:**
- Modify: `server/src/models/User.js`
- Modify: `server/.env`
- Modify: `server/.env.example`

**Interfaces:**
- Produces: `User` con campos `passwordHash` (opcional) y `googleId` (String, sparse unique)

- [ ] **Step 1: Modificar el modelo User**

Reemplazar el contenido completo de `server/src/models/User.js`:

```js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String },
    googleId: { type: String, sparse: true, unique: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' }
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
```

- [ ] **Step 2: Agregar GOOGLE_CLIENT_ID a los archivos de entorno**

En `server/.env`, agregar al final:
```
GOOGLE_CLIENT_ID=<tu OAuth Client ID de Google Cloud Console>
```

En `server/.env.example`, agregar al final:
```
GOOGLE_CLIENT_ID=
```

- [ ] **Step 3: Verificar que el servidor arranca sin errores**

```bash
cd server && npm run dev
```
Esperado: `Server running on port 5000` sin errores de Mongoose.

- [ ] **Step 4: Commit**

```bash
git add server/src/models/User.js server/.env.example
git commit -m "feat: make passwordHash optional and add googleId to User model"
```

> **Nota:** No commitear `server/.env` (contiene secretos reales).

---

## Task 2: Backend — Instalar google-auth-library + endpoint POST /auth/google + guard change-password

**Files:**
- Modify: `server/package.json` (via npm install)
- Modify: `server/src/routes/authRoutes.js`

**Interfaces:**
- Consumes: `User` de Task 1 (con `googleId` opcional)
- Consumes: `signToken(user)` de `server/src/middleware/auth.js` — firma `{ id, role, email }`
- Produces: `POST /api/auth/google` — recibe `{ credential }`, devuelve `{ token, user: { id, name, role, email } }`

- [ ] **Step 1: Instalar google-auth-library**

```bash
cd server && npm install google-auth-library
```
Esperado: `added N packages` sin errores.

- [ ] **Step 2: Agregar el endpoint POST /auth/google a authRoutes.js**

Agregar el import de `OAuth2Client` al inicio del archivo, después de los imports existentes:

```js
import { OAuth2Client } from 'google-auth-library';
```

Agregar esta ruta antes de `export default router;`:

```js
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ message: 'credential requerido' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ message: 'Token de Google inválido' });
  }

  const { sub: googleId, email, name } = payload;

  // 1. Buscar por googleId
  let user = await User.findOne({ googleId });

  // 2. Si no, buscar por email y vincular
  if (!user) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.googleId = googleId;
      await user.save();
    }
  }

  // 3. Si no existe, crear nuevo usuario
  if (!user) {
    user = await User.create({
      name,
      email: email.toLowerCase(),
      googleId,
      role: 'user',
    });
  }

  return res.json({
    token: signToken(user),
    user: { id: user._id, name: user.name, role: user.role, email: user.email },
  });
});
```

- [ ] **Step 3: Agregar guard en change-password**

En la ruta `POST /change-password`, localizar la línea:
```js
const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
```

Agregar este bloque ANTES de esa línea:
```js
if (!user.passwordHash) {
  return res.status(400).json({ message: 'Tu cuenta usa Google para autenticarse. No podés cambiar la contraseña desde aquí.' });
}
```

- [ ] **Step 4: Verificar el endpoint con curl (sin credencial real — debe rechazar)**

Con el servidor corriendo (`npm run dev` en `server/`):

```bash
curl -s -X POST http://localhost:5000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"credential":"token_falso"}' | cat
```
Esperado:
```json
{"message":"Token de Google inválido"}
```

- [ ] **Step 5: Verificar que el endpoint sin body devuelve 400**

```bash
curl -s -X POST http://localhost:5000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{}' | cat
```
Esperado:
```json
{"message":"credential requerido"}
```

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/authRoutes.js server/package.json server/package-lock.json
git commit -m "feat: add POST /auth/google endpoint and change-password guard"
```

---

## Task 3: Frontend — Instalar @react-oauth/google + GoogleOAuthProvider + env vars

**Files:**
- Modify: `client/package.json` (via npm install)
- Modify: `client/src/main.jsx`
- Modify: `client/.env`
- Modify: `client/.env.example`

**Interfaces:**
- Produces: `GoogleOAuthProvider` envuelve toda la app con el `clientId` configurado
- Produces: `VITE_GOOGLE_CLIENT_ID` disponible en todo el frontend

- [ ] **Step 1: Instalar @react-oauth/google**

```bash
cd client && npm install @react-oauth/google
```
Esperado: `added N packages` sin errores.

- [ ] **Step 2: Agregar VITE_GOOGLE_CLIENT_ID a los archivos de entorno**

En `client/.env`, agregar al final:
```
VITE_GOOGLE_CLIENT_ID=<mismo Client ID que pusiste en server/.env>
```

En `client/.env.example`, agregar al final:
```
VITE_GOOGLE_CLIENT_ID=
```

- [ ] **Step 3: Envolver la app con GoogleOAuthProvider en main.jsx**

Reemplazar el contenido completo de `client/src/main.jsx`:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import theme from './theme';
import './styles.css';

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
```

- [ ] **Step 4: Verificar que el frontend arranca sin errores**

```bash
cd client && npm run dev
```
Esperado: Vite dev server en `http://localhost:5173` sin errores de consola relacionados con `GoogleOAuthProvider`.

- [ ] **Step 5: Commit**

```bash
git add client/src/main.jsx client/.env.example client/package.json client/package-lock.json
git commit -m "feat: add GoogleOAuthProvider to client app"
```

---

## Task 4: Frontend — loginWithGoogle en AuthContext + botón Google en LoginPage

**Files:**
- Modify: `client/src/context/AuthContext.jsx`
- Modify: `client/src/pages/LoginPage.jsx`

**Interfaces:**
- Consumes: `GoogleOAuthProvider` de Task 3
- Consumes: `POST /api/auth/google` de Task 2 — recibe `{ credential }`, devuelve `{ token, user }`
- Produces: `loginWithGoogle(credential)` — misma firma que `login(email, password)` pero sin contraseña

- [ ] **Step 1: Agregar loginWithGoogle a AuthContext**

Reemplazar el contenido completo de `client/src/context/AuthContext.jsx`:

```jsx
import { createContext, useContext, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const loginWithGoogle = async (credential) => {
    const { data } = await api.post('/auth/google', { credential });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const loginWithMagic = async (token) => {
    const { data } = await api.post('/auth/magic-link/login', { token });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, login, loginWithGoogle, loginWithMagic, logout }),
    [user]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 2: Agregar el botón de Google a LoginPage**

Reemplazar el contenido completo de `client/src/pages/LoginPage.jsx`:

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Divider, Stack, TextField, Typography } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || 'Error de autenticación');
    }
  };

  const onGoogleSuccess = async ({ credential }) => {
    setError('');
    try {
      await loginWithGoogle(credential);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al autenticar con Google');
    }
  };

  return (
    <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
      <Card sx={{ width: '100%', maxWidth: 460 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">Ingresar</Typography>
            <Typography variant="body2" color="text.secondary">
              Accedé al panel de contratos y recibos.
            </Typography>
            <Stack component="form" onSubmit={onSubmit} spacing={2}>
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
              <TextField label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
              <Button type="submit" variant="contained" size="large" startIcon={<LoginIcon />}>
                Entrar
              </Button>
            </Stack>
            <Divider>o</Divider>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin onSuccess={onGoogleSuccess} onError={() => setError('Error al autenticar con Google')} />
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
```

> **Nota:** El botón Google está fuera del `<form>` — no dispara la validación HTML5 de email/contraseña.

- [ ] **Step 3: Verificar en el browser**

Con `npm run dev` en ambos (`server/` y `client/`):

1. Abrir `http://localhost:5173`
2. Verificar que aparece el botón "Continuar con Google" bajo el separador "o"
3. Hacer clic en el botón → debe abrir el popup de Google
4. Autenticarse con una cuenta de Google real
5. Verificar que redirige al dashboard (`/`)
6. Verificar en MongoDB que se creó/actualizó el usuario con `googleId` seteado:
   ```bash
   # En mongosh
   use alquilar
   db.users.findOne({ googleId: { $exists: true } })
   ```

- [ ] **Step 4: Verificar vinculación de cuenta existente**

1. Hacer logout
2. Intentar login con email/contraseña del usuario que acabas de autenticar con Google
3. Debe seguir funcionando normalmente (la cuenta tiene ambos métodos)

- [ ] **Step 5: Commit**

```bash
git add client/src/context/AuthContext.jsx client/src/pages/LoginPage.jsx
git commit -m "feat: add Google login button and loginWithGoogle to AuthContext"
```

---

## Prerequisito: Configurar Google Cloud Console

> Hacer esto ANTES de ejecutar el Task 3/4 (se necesita el Client ID real).

1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear o seleccionar un proyecto
3. Menú → **APIs & Services** → **Credentials**
4. **+ Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized JavaScript origins: `http://localhost:5173`
7. Guardar → copiar el **Client ID** (termina en `.apps.googleusercontent.com`)
8. Pegarlo en `server/.env` como `GOOGLE_CLIENT_ID=...`
9. Pegarlo en `client/.env` como `VITE_GOOGLE_CLIENT_ID=...`
