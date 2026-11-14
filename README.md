# SSO ITAPU — Panel de administración

Panel de administración web para el sistema SSO de ITAPU. Permite gestionar el padrón de usuarios, cargos, especialidades, aplicaciones OAuth y administradores del sistema.

## ¿Qué hace este repositorio?

Provee la interfaz gráfica para que los administradores del SSO puedan:

- Iniciar sesión con autenticación de dos factores (TOTP) obligatoria.
- Gestionar el **padrón de usuarios**: alta individual, carga masiva por Excel, edición, suspensión, baja y reenvío de email de bienvenida.
- Configurar **cargos institucionales** y **especialidades** disponibles en el sistema.
- Gestionar **administradores** del panel (crear, listar, eliminar).
- Registrar y gestionar **aplicaciones cliente OAuth** (crear, editar, suspender, activar, eliminar, regenerar secret, enviar credenciales por email).
- Ver **estadísticas** del sistema: apps integradas, usuarios registrados, pendientes de activación y distribución por especialidad.
- Monitorear el estado del backend SSO.
- Actualizar propio perfil, cambiar contraseña y resetear el autenticador 2FA.
- Configurar contraseña de nuevos usuarios a través de una página pública con token de un solo uso.


## Tecnologías utilizadas

| Categoría | Tecnología |
|-----------|-----------|
| Framework | React 19 |
| Lenguaje | TypeScript |
| Build tool | Vite |
| UI | Mantine 9 |
| Íconos | Tabler Icons React |
| HTTP | Axios |
| Routing | React Router DOM 7 |
| Estado global | Zustand |
| Excel | SheetJS (`xlsx`) |
| Tests | Vitest + Testing Library |
| Lint | oxlint |


## Requisitos previos

- Node.js 22+
- El backend `sso-itapu-back` corriendo y accesible


## Instalación y configuración

```bash
git clone https://github.com/ignamosconi/sso-itapu-front.git
cd sso-itapu-front
npm install
cp .env.example .env
```

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL base del backend SSO, sin barra final. | `http://localhost:3000` |

> Las variables con prefijo `VITE_` quedan embebidas en el bundle de producción. No pongas secretos acá.


## Comandos disponibles

```bash
npm run dev          # desarrollo con hot reload
npm run build        # build de producción
npm run preview      # preview del build localmente
npm run lint         # lint
npm run test         # tests unitarios
npm run test:watch   # tests en modo watch
npm run test:cov     # tests con cobertura
```


## Rutas

| Ruta | Descripción | Pública |
|------|-------------|---------|
| `/login` | Login de administradores | ✓ |
| `/set-password?token=...` | Setup / reset de contraseña de usuarios | ✓ |
| `/dashboard` | Estadísticas y health del sistema | — |
| `/padron` | Tabla de usuarios con filtros y paginación | — |
| `/padron/cargar` | Alta individual y carga masiva por Excel | — |
| `/padron/roles` | CRUD de cargos institucionales | — |
| `/padron/especialidades` | CRUD de especialidades | — |
| `/admins` | Lista de administradores | — |
| `/admins/me` | Perfil propio | — |
| `/clients` | Clientes OAuth registrados | — |
| `/faqs` | Documentación para admins y desarrolladores | — |


## Flujo de autenticación de administradores

POST /admin/auth/login → pending_token

Primera vez (requires_2fa_setup = true):
POST /admin/auth/2fa/setup → QR + confirm_pending_token
POST /admin/auth/2fa/confirm → access_token + refresh_token

Logins posteriores:
POST /admin/auth/2fa/validate → access_token + refresh_token



### Almacenamiento de tokens

| Token | Dónde | Por qué |
|-------|-------|---------|
| `accessToken` | Memoria (Zustand) | No persiste al cerrar el tab |
| `refreshToken` | `sessionStorage` | Persiste entre recargas, se borra al cerrar el tab |
| `pendingToken` | Memoria (Zustand) | Vida corta, no necesita sobrevivir recargas |

### Refresh automático y mutex

El interceptor de Axios detecta respuestas `401` e intenta renovar el access token automáticamente. Un mutex garantiza que múltiples requests concurrentes que fallen con `401` solo disparen **un único refresh**, evitando race conditions.


## Gestión del padrón

### Carga masiva por Excel

1. Descargá el Excel de ejemplo desde la sección **Cargar usuarios → Carga masiva**.
2. Completá las columnas: `Nombre/s`, `Apellido/s`, `DNI`, `Email`, `Fecha de nacimiento`, `Cargo`, `Especialidad`.
3. Los valores de **Cargo** y **Especialidad** deben coincidir exactamente con los cargados en el sistema. El Excel de ejemplo los lista en las columnas I y J.
4. Las fechas se cargan con formato fecha de Excel (DD/MM/AAAA).
5. Subí el archivo y usá el **preview** para verificar errores antes de confirmar.
6. Confirmá: solo se importan las filas válidas.

Al crear un usuario (individual o masivo), el sistema genera automáticamente su nombre de usuario y le envía un email de bienvenida con un link para configurar su contraseña.

### Generación de nombre de usuario

El nombre de usuario se genera a partir de los datos del usuario:
- Primera letra de cada nombre + apellido(s) completo(s) + últimos 3 dígitos del DNI.
- Todo en minúsculas, sin tildes.
- Si hay colisión, se agrega sufijo numérico (`_2`, `_3`, etc.).

Ejemplo: `Ignacio Mariano Mosconi, DNI 44244136` → `immosconi136`


## Gestión de clientes OAuth

Al crear un cliente, el backend genera un `clientSecret` hasheado. El flujo es:

1. El admin completa nombre y redirect URIs.
2. Aparece un modal para ingresar el email del destinatario.
3. El backend genera un **link de un solo uso** (AES-256-GCM, válido 24 horas).
4. El destinatario abre el link y ve sus credenciales completas con instrucciones de integración.
5. El link queda inválido tras el primer acceso.

> El admin nunca ve el `plainSecret` directamente. Esto reduce la superficie de exposición del secret.


## Tests

```bash
npm run test
```

- `src/store/authStore.test.ts` — lógica del store (setTokens, logout, refresh, bootstrap)
- `src/hooks/useAuth.test.ts` — flujo completo de 2FA


## CI — GitHub Actions

El pipeline corre en cada PR y push a `main` y `develop`:

1. Lint
2. Build de producción
3. Tests con cobertura

Configuración en `.github/workflows/`.


## Backend relacionado

El backend SSO está en [github.com/ignamosconi/sso-itapu-back](https://github.com/ignamosconi/sso-itapu-back).