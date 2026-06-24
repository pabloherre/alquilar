# Google OAuth — Diseño

**Fecha:** 2026-06-24  
**Proyecto:** AlquilAR  
**Estado:** Aprobado

## Resumen

Agregar autenticación con Google (OAuth 2.0) como método alternativo al login con email/contraseña. Aplica a todos los roles (admin y tenants). Se usa el flujo frontend-first con `@react-oauth/google` en el cliente y `google-auth-library` en el servidor.

## Alcance

- Cualquier usuario (admin o tenant) puede autenticarse con Google.
- Si el email de Google coincide con una cuenta existente, las cuentas se vinculan automáticamente.
- Si el email no existe en el sistema, se crea una cuenta nueva con rol `user`.
- El sistema JWT existente (7 días, localStorage) no cambia.

## Flujo de datos

```
Usuario → clic "Continuar con Google"
  → popup nativo de Google Identity Services
  → Google devuelve credential (ID token)
  → frontend: POST /api/auth/google { credential }
  → backend: verifica ID token con google-auth-library
  → extrae { email, name, googleId (sub) }
  → busca por googleId → encontrado → emite JWT
  → no encontrado → busca por email → encontrado → vincula googleId → emite JWT
  → no encontrado → crea usuario { name, email, googleId, role: 'user' } → emite JWT
  → frontend: guarda token + user en localStorage, setUser()
```

## Cambios al modelo User

```js
// Antes
passwordHash: { type: String, required: true }

// Después
passwordHash: { type: String }  // opcional — usuarios OAuth no tienen contraseña
googleId:     { type: String, sparse: true, unique: true }  // sparse permite null múltiple
```

## Backend

### Dependencia nueva
```
google-auth-library
```

### Nuevo endpoint: `POST /api/auth/google`
- Recibe: `{ credential }` (ID token de Google)
- Verifica con `OAuth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })`
- Ejecuta la lógica find-or-create descrita en el flujo
- Devuelve: `{ token, user: { id, name, role, email } }` — mismo shape que `/auth/login`

### Guard en `change-password`
- Si `!user.passwordHash`, devolver `400` con mensaje: `"Tu cuenta usa Google para autenticarse. No podés cambiar la contraseña desde aquí."`

### Variable de entorno nueva
```
GOOGLE_CLIENT_ID=<OAuth Client ID de Google Cloud Console>
```

## Frontend

### Dependencia nueva
```
@react-oauth/google
```

### `main.jsx`
Envolver `<App />` con `<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>`.

### `AuthContext.jsx`
Nueva función `loginWithGoogle(credential)`:
```js
const loginWithGoogle = async (credential) => {
  const { data } = await api.post('/auth/google', { credential });
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  setUser(data.user);
};
```
Exponer en el value del contexto junto a `login`, `loginWithMagic`, `logout`.

### `LoginPage.jsx`
Agregar separador "─── o ───" y botón `<GoogleLogin>` debajo del botón "Entrar":
```jsx
import { GoogleLogin } from '@react-oauth/google';

<GoogleLogin
  onSuccess={({ credential }) => loginWithGoogle(credential).then(() => navigate('/')).catch(setError)}
  onError={() => setError('Error al autenticar con Google')}
/>
```

### Variable de entorno nueva
```
VITE_GOOGLE_CLIENT_ID=<mismo Client ID>
```

## Configuración Google Cloud Console

1. Crear proyecto OAuth (o usar existente).
2. Habilitar **Google Identity API**.
3. Crear credencial → **OAuth 2.0 Client ID** → tipo **Web application**.
4. Agregar en "Authorized JavaScript origins":
   - `http://localhost:5173` (desarrollo)
   - dominio de producción cuando corresponda
5. Copiar el **Client ID** — no se necesita el Client Secret para este flujo.

## Archivos modificados

| Archivo | Tipo de cambio |
|---|---|
| `server/src/models/User.js` | `passwordHash` opcional, agregar `googleId` |
| `server/src/routes/authRoutes.js` | Nuevo `POST /auth/google`, guard en `change-password` |
| `server/.env` + `server/.env.example` | Agregar `GOOGLE_CLIENT_ID` |
| `client/src/main.jsx` | `GoogleOAuthProvider` |
| `client/src/context/AuthContext.jsx` | `loginWithGoogle` |
| `client/src/pages/LoginPage.jsx` | Botón Google + separador |
| `client/.env` + `client/.env.example` | Agregar `VITE_GOOGLE_CLIENT_ID` |
| `server/package.json` | `google-auth-library` |
| `client/package.json` | `@react-oauth/google` |
