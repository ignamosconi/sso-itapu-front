# SSO FRVM Admin - Frontend

Panel de administración web para el sistema SSO de UTN FRVM. Permite gestionar administradores del sistema, registrar y administrar aplicaciones cliente OAuth, y monitorear el estado de los servicios.


## ¿Qué hace este repositorio?

Provee la interfaz gráfica para que los administradores del SSO puedan:

- Iniciar sesión con autenticación de dos factores (TOTP) obligatoria.
- Gestionar otros administradores del sistema (crear, listar, eliminar).
- Registrar aplicaciones cliente OAuth (crear, editar, suspender, activar, eliminar).
- Regenerar client secrets y enviarlos al desarrollador por email mediante un link de un solo uso.
- Monitorear en tiempo real el estado del backend SSO y del servicio de Autogestión UTN.
- Actualizar su propio perfil y resetear el autenticador 2FA.

## Tecnologías utilizadas

| Categoría | Tecnología |
|-----------|-----------|
| Framework | React 19 |
| Lenguaje | TypeScript 6 |
| Build tool | Vite 8 |
| UI | Mantine 9 |
| Íconos | Tabler Icons React |
| HTTP | Axios |
| Routing | React Router DOM 7 |
| Estado global | Zustand 5 |
| Tests | Vitest + Testing Library |
| Lint | oxlint |


## Requisitos previos

- Node.js 22+
- El backend `sso-frvm` corriendo y accesible


## Instalación y configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/ignamosconi/sso-frvm-admin.git
cd sso-frvm-admin
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editá el `.env` con los valores correctos:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL base del backend SSO, sin barra final. Se embebe en el bundle de producción. | `http://localhost:3000` |
| `VITE_AUTOGESTION_URL` | URL pública del webservice de Autogestión UTN. Usada para el health check del dashboard. | `https://webservice.frvm.utn.edu.ar/autogestion` |

> Las variables con prefijo `VITE_` son públicas y quedan embebidas en el bundle de producción. No pongas secretos acá.


## Comandos disponibles

```bash
# Levantar en modo desarrollo con hot reload
npm run dev

# Build de producción (TypeScript + Vite)
npm run build

# Preview del build de producción localmente
npm run preview

# Lint
npm run lint

# Correr tests unitarios una vez
npm run test

# Correr tests en modo watch (re-corre al guardar)
npm run test:watch

# Correr tests con reporte de cobertura
npm run test:cov
```

## Flujo de autenticación

El login está dividido en dos pasos obligatorios:

```
Paso 1: POST /admin/auth/login
  → Credenciales válidas → pending_token

  Si requires_2fa_setup = true (primera vez):
    Paso 2a: POST /admin/auth/2fa/setup  → QR + manualEntrySecret + confirm_pending_token
    Paso 3a: POST /admin/auth/2fa/confirm (con confirm_pending_token) → access_token + refresh_token

  Si requires_2fa_setup = false (logins posteriores):
    Paso 2b: POST /admin/auth/2fa/validate → access_token + refresh_token
```

### Bootstrap de sesión

Al cargar la app, si existe un `refreshToken` en `sessionStorage`, el sistema intenta recuperar la sesión automáticamente antes de renderizar cualquier UI protegida. Si el refresh falla, redirige al login sin mostrar contenido protegido.

### Almacenamiento de tokens

| Token | Almacenamiento | Motivo |
|-------|---------------|--------|
| `accessToken` | Memoria (Zustand) | No persiste, se pierde al cerrar el tab |
| `refreshToken` | `sessionStorage` | Persiste entre recargas, se borra al cerrar el tab |
| `pendingToken` | Memoria (Zustand) | Token de vida corta, no necesita sobrevivir recargas |

> `sessionStorage` fue elegido sobre `localStorage` porque no persiste entre tabs ni al cerrar el navegador, reduciendo la ventana de exposición del refresh token.

### Refresh automático y mutex

El interceptor de Axios detecta respuestas `401` e intenta renovar el access token automáticamente. Un mutex garantiza que múltiples requests concurrentes que fallen con `401` al mismo tiempo solo disparen **un único refresh**, evitando race conditions.

## Gestión de clientes OAuth

### Crear un cliente

Al crear un cliente, el backend genera un `clientSecret` hasheado. El flujo del panel es:

1. El admin completa nombre y redirect URIs.
2. El panel recibe la respuesta con el `plainSecret`.
3. Aparece un modal que pide el email del desarrollador.
4. El panel envía el secret al backend, que genera un **link de un solo uso** cifrado con AES-256-GCM, válido 24 horas.
5. El desarrollador abre el link y ve sus credenciales completas.
6. El link queda inválido tras el primer acceso.

> El admin nunca ve el `plainSecret` directamente, envía un email de credenciales automáticamente. Esto reduce la superficie de exposición del secret.

### Suspender / activar una app

Las apps pueden suspenderse temporalmente sin eliminarse. Una app suspendida no puede autenticar usuarios, ya que el backend rechaza sus requests con `401`. Las apps suspendidas se muestran con borde rojo y badge "Suspendido" en la lista.


## Tests

Los tests cubren la lógica de autenticación y el store:

```bash
# Correr todos los tests
npm run test
```

Los archivos de test están junto a los archivos que testean:
- `src/store/authStore.test.ts`: lógica del store (setTokens, logout, refresh, bootstrap)
- `src/hooks/useAuth.test.ts`: flujo completo de 2FA (loginStep1, confirm2fa, validate2fa, reset2fa)


## CI - GitHub Actions

El pipeline corre automáticamente en cada PR y push a `main` y `develop`:

1. Lint (`oxlint`)
2. Build de producción
3. Tests unitarios con cobertura

El archivo de configuración está en `.github/workflows/ci-frontend.yml`.

## Backend relacionado

El backend SSO está en [github.com/ignamosconi/sso-frvm](https://github.com/ignamosconi/sso-frvm).

Para levantar el backend localmente seguí las instrucciones de su README. El panel no funciona sin el backend corriendo.