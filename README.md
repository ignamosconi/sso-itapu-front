# SSO ITAPU — Panel de administración

Panel de administración web para el sistema SSO de ITAPU. Permite gestionar el padrón de usuarios, cargos, especialidades, aplicaciones OAuth y administradores del sistema.

## ¿Qué hace este repositorio?

Provee la interfaz gráfica para que los administradores del SSO puedan:

- Iniciar sesión con autenticación de dos factores (TOTP) obligatoria.
- Gestionar el **padrón de usuarios**: alta individual, carga masiva por Excel, edición, suspensión, baja y reenvío de email de bienvenida.
- Configurar **cargos institucionales** (con sus reglas) y **especialidades** disponibles en el sistema. Un usuario puede tener varios cargos y varias especialidades.
- Gestionar **administradores** del panel (crear, listar, eliminar).
- Registrar y gestionar **aplicaciones cliente OAuth** (crear, editar, suspender, activar, eliminar, regenerar secret, enviar credenciales por email).
- Ver **estadísticas** del sistema: apps integradas, usuarios registrados, pendientes de activación y distribución por especialidad.
- Monitorear el estado del backend SSO.
- Actualizar el propio perfil, cambiar contraseña y resetear el autenticador 2FA.

Además, incluye dos páginas públicas que abren los usuarios desde un email, con token de un solo uso y modo claro/oscuro:

- Configurar la contraseña de una cuenta nueva (`/set-password`).
- Confirmar un cambio de email (`/confirm-email`).


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
| Tests | Vitest + Testing Library |
| Lint | oxlint |


## Requisitos previos

- Node.js 22+
- El backend `sso-itapu-back` corriendo y accesible, con `AUTH_ROUTE_PATH=sso` (es el valor de su `.env.example`): este panel llama a `/sso/set-password`, `/sso/validate-reset-token` y `/sso/confirm-email-change`.


## Instalación y configuración

```bash
git clone https://github.com/ignamosconi/sso-itapu-front.git
cd sso-itapu-front
npm ci
cp .env.example .env
```

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL base del backend SSO, sin barra final. | `http://localhost:3000` |

> Las variables con prefijo `VITE_` quedan embebidas en el bundle de producción. No pongas secretos acá.
>
> `VITE_API_BASE_URL` se lee **al hacer el build** y además se escribe en la política de seguridad del navegador (CSP, `connect-src` de `index.html`). Si cambia la URL del backend hay que volver a construir el panel.

`npm ci` instala exactamente lo que dice `package-lock.json`. Para actualizar dependencias usá `npm install <paquete>@<versión>`; si npm 10 falla con `Cannot read properties of null (reading 'edgesOut')`, usá `npx npm@11 install`.


## Tema y estilos

- El tema de Mantine está en `src/theme.ts`: paleta `itapu` basada en el violeta del logo (`#422774`). En modo claro los botones usan ese tono; en modo oscuro, uno más luminoso (`#7650B3`) para que se distingan del fondo.
- Modo claro: fondo crema (`#FEF8F1`), tarjetas blancas y tablas con filas alternas. Estos ajustes están en `src/index.css`.
- Las páginas que abren los usuarios desde un email (`/set-password`, `/confirm-email`) comparten el marco `src/components/layout/UserPageLayout.tsx`: logo, tarjeta y selector de tema. Arrancan en modo claro, igual que los emails, si la persona nunca eligió un tema.
- Para cambiar el color de los botones y acentos de todo el panel, editá solo `src/theme.ts`. No uses `style={{ background: ... }}` en cada botón.


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
| `/confirm-email?token=...` | Confirmación de cambio de email de un usuario | ✓ |
| `/dashboard` | Estadísticas y health del sistema | — |
| `/padron` | Tabla de usuarios con filtros, paginación y acciones (editar, cambiar email, suspender, baja) | — |
| `/padron/cargar` | Alta individual y carga masiva por Excel | — |
| `/padron/roles` | Alta, listado y baja de cargos institucionales y sus reglas | — |
| `/padron/especialidades` | CRUD de especialidades | — |
| `/admins` | Lista de administradores | — |
| `/admins/me` | Perfil propio | — |
| `/clients` | Clientes OAuth registrados | — |
| `/faqs` | Documentación para admins y desarrolladores | — |


## Flujo de autenticación de administradores

```
POST /admin/auth/login → pending_token

Primera vez (requires_2fa_setup = true):
  POST /admin/auth/2fa/setup   → QR + confirm_pending_token
  POST /admin/auth/2fa/confirm → access_token + refresh_token

Logins posteriores:
  POST /admin/auth/2fa/validate → access_token + refresh_token
```

### Almacenamiento de tokens

| Token | Dónde | Por qué |
|-------|-------|---------|
| `accessToken` | Memoria (Zustand) | No persiste al cerrar el tab |
| `refreshToken` | `sessionStorage` | Persiste entre recargas, se borra al cerrar el tab |
| `pendingToken` | Memoria (Zustand) | Vida corta, no necesita sobrevivir recargas |

### Refresh automático y mutex

El interceptor de Axios detecta respuestas `401` e intenta renovar el access token automáticamente. Un mutex garantiza que múltiples requests concurrentes que fallen con `401` solo disparen **un único refresh**, evitando race conditions.


## Seguridad

El informe de la auditoría (hallazgos, cómo se verificaron y cómo se resolvió cada uno) está en [`SECURITY-AUDIT.md`](./SECURITY-AUDIT.md). Resumen de lo que hay que saber:

- **Sesión del administrador.** El refresh token vive en `sessionStorage` y se borra al cerrar la pestaña. Es un riesgo conocido y aceptado: si algún día hubiera un XSS, un script podría leerlo. Se reduce con la CSP (`script-src 'self'`, sin scripts en línea) y porque el código no usa `dangerouslySetInnerHTML`, `innerHTML` ni `eval`: todo lo que viene del servidor se muestra como texto. Pasar a cookies `HttpOnly` exigiría cambios en el backend.
- **Política de contenido (CSP).** Está en `index.html` (`<meta>`): solo scripts propios, conexiones solo al backend, sin `object`, `base` ni envío de formularios a otros sitios. También se pide `no-referrer` porque los links de los mails llevan un token en la URL. Los estilos en línea están permitidos porque Mantine los necesita.
- **Encabezados HTTP.** Algunas protecciones **no se pueden poner en un `<meta>`**, como `frame-ancestors` (impide que otro sitio meta este panel en un `<iframe>`, el *clickjacking*). Tienen que ir como encabezados del hosting. El repo trae la configuración lista: `public/_headers` (Netlify y Cloudflare Pages) y `vercel.json` (Vercel). Usá el que corresponda y borrá el otro. Si el panel se sirve desde otro lado (Nginx, Apache), hay que agregar los mismos encabezados a mano: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` y `Content-Security-Policy: frame-ancestors 'none'`. Además, comprobá en tu plataforma que HTTPS y HSTS estén activos.
- **Errores del servidor.** `src/utils/apiError.ts` convierte cualquier error en un mensaje para mostrar: junta los mensajes de validación (que llegan como lista), traduce el 429 con el tiempo de espera y la caída de red, y no muestra textos técnicos de un 500. Las páginas lo usan en lugar de leer `response.data.message` directamente.
- **Links de los mails.** `/set-password` y `/confirm-email` sacan el token de la URL apenas la página carga. En `/set-password`, los errores que se pueden corregir (contraseña inválida, límite de pedidos, caída de red) dejan el formulario abierto, porque con el token fuera de la URL perder el formulario obliga a pedir otro mail. Solo un link inexistente, usado, vencido o de una cuenta suspendida corta el flujo.
- **Política de contraseñas.** En los tres formularios donde se elige una contraseña nueva (`/set-password`, alta de admin y **Mi perfil**) se exige lo mismo que en el backend: al menos 8 caracteres, una mayúscula, una minúscula, un número y un caracter especial (cualquier símbolo que no sea letra, número ni espacio). Debajo del campo se ve en vivo qué requisitos se cumplen y cuáles faltan, y al enviar aparece **un solo mensaje con todo lo que falta**. La regla está en `src/utils/passwordPolicy.ts` (copia de `src/common/validators/password-policy.validator.ts` del backend: si cambia, cambiar las dos). Las contraseñas anteriores a la política siguen sirviendo para entrar; se exige al cambiarlas.
- **Límites de los campos.** Los formularios usan los mismos máximos que el backend (por ejemplo, contraseñas de hasta 128 caracteres y 72 bytes, búsqueda de hasta 100 caracteres, Excel de hasta 5 MB y 500 filas). El backend es quien decide: ante cualquier diferencia, se muestra su mensaje.
- **Caché del dashboard.** Los conteos del dashboard se guardan 15 minutos en `localStorage`; se borran al cerrar sesión.
- **Dependencias y CI.** Ver la sección de CI más abajo.


## Gestión del padrón

### Cargos, especialidades y reglas (v2.0.0)

Desde la versión 2.0.0 cada usuario tiene **uno o más cargos** y **una o más especialidades** (por ejemplo, alguien que es Profesor y Preceptor). Al crear un cargo, en **Cargos institucionales**, se pueden marcar dos reglas:

| Regla | Efecto |
|-------|--------|
| **No se combina con otros cargos** | Quien tenga este cargo no puede tener ningún otro (por ejemplo, Alumno). |
| **Exactamente una especialidad** | Quien tenga este cargo debe tener una sola especialidad. |

- Todo usuario tiene siempre al menos un cargo y al menos una especialidad. Para quien no pertenece a una especialidad en particular, conviene crear una general (por ejemplo, "ITAPU").
- **Las reglas no se pueden cambiar** después de crear el cargo (tampoco por API). Para cambiarlas: crear un cargo nuevo con las reglas correctas, pasar a los usuarios con **Editar usuario** y eliminar el viejo.
- En **Cargar usuarios** y **Editar usuario**, el desplegable de cargos se cierra solo al elegir un cargo que no se combina (por ejemplo, Alumno), y el de especialidades se cierra al elegir una si algún cargo elegido exige exactamente una. Se pueden volver a abrir para elegir más, y en ese caso aparece el aviso de reglas. Con cargos que se combinan (por ejemplo, Profesor) el desplegable queda abierto para seguir eligiendo.
- El panel avisa al instante si una selección no cumple las reglas, pero quien decide es el backend: las valida en el alta individual, en la carga por Excel (preview y confirmación) y en la edición.
- No se puede eliminar un cargo o especialidad que tenga usuarios asignados.

### Editar usuario

En **Padrón**, el botón **Editar usuario** permite cambiar nombre/s, apellido/s, DNI, fecha de nacimiento, cargos y especialidades (los elegidos reemplazan a los anteriores).

- Para guardar se pide **la contraseña del admin que hace el cambio**. Tras varios intentos fallidos seguidos (5 por defecto) la edición queda bloqueada unos minutos y el panel muestra la cuenta regresiva.
- Solo se envían los campos que cambiaron.
- El usuario recibe un email con los datos anteriores y los nuevos.
- Las apps conectadas ven el cambio en hasta 15 minutos (al refrescar el token) o cuando el usuario vuelve a iniciar sesión. El nombre de usuario y el `sub` no cambian.
- El email y la contraseña no se editan desde acá: el email tiene su propio flujo con confirmación.

### Carga masiva por Excel

1. Descargá el Excel de ejemplo desde la sección **Cargar usuarios → Carga masiva**.
2. Completá las columnas: `Nombre/s`, `Apellido/s`, `DNI`, `Email`, `Fecha de nacimiento`, `Cargo`, `Especialidad`.
3. Los valores de **Cargo** y **Especialidad** deben coincidir con los cargados en el sistema. El Excel de ejemplo los lista al costado de la planilla, con una tabla de las reglas de cada cargo, y trae filas de ejemplo con un valor y con varios.
   - **Varios valores:** en la misma celda, separados por punto y coma (`Profesor; Preceptor`).
   - Las filas con valores inexistentes o repetidos, o que no cumplan las reglas de los cargos, se marcan con error en el preview y no se importan.
4. Las fechas se cargan con formato fecha de Excel (DD/MM/AAAA).
5. Formatos aceptados: `.xlsx`, `.xls` (Excel) y `.ods` (LibreOffice Calc). Máximo **500 alumnos** y **5 MB** por archivo; si tenés más, dividilo en partes.
6. Subí el archivo y usá el **preview** para verificar errores antes de confirmar.
7. Confirmá: solo se importan las filas válidas. El backend las vuelve a validar al confirmar; si algo cambió desde el preview (por ejemplo, se borró un cargo), no se importa nada y hay que generar el preview de nuevo.

Al crear un usuario (individual o masivo), el sistema genera automáticamente su nombre de usuario y le envía un email de bienvenida con un link para configurar su contraseña.

### Generación de nombre de usuario

El nombre de usuario se genera a partir de los datos del usuario:
- Primera letra de cada nombre + apellido(s) completo(s) + últimos 3 dígitos del DNI.
- Todo en minúsculas, sin tildes.
- Si hay colisión, se agrega sufijo numérico (`_2`, `_3`, etc.).

Ejemplo: `Ignacio Mariano Mosconi, DNI 30123456` → `immosconi456`

### Cambio de email

Un administrador puede iniciar el cambio de email de un usuario activo. Se envía un link de confirmación al email nuevo y un aviso al actual; el cambio se aplica recién cuando el usuario confirma desde `/confirm-email`. Al confirmar se cierran todas sus sesiones.


## Gestión de clientes OAuth

Cada app que usa el SSO es un cliente OAuth. El flujo desde el panel:

1. El admin completa el nombre de la app, hasta 5 redirect URIs y elige el **usuario responsable** (un alumno activo).
2. El backend genera el `client_secret` y lo guarda hasheado (bcrypt). **El secret no viaja al panel ni se muestra en pantalla.**
3. En el modal que aparece, el admin hace click en **Enviar credenciales por email**: el responsable recibe un **link de un solo uso** (cifrado con AES-256-GCM, válido 24 horas por defecto) donde ve el `client_id`, el `client_secret` y las instrucciones de integración.
4. El link queda inválido tras el primer acceso. Para reenviar las credenciales hay que regenerar el secret desde la tabla de clientes.
5. Cambiar el responsable de una app regenera su secret; el panel pide confirmación antes de guardar nada.

### Reglas de las redirect URIs

El backend valida cada URI al crear o editar un cliente y el panel muestra el motivo exacto cuando rechaza una:

- Deben usar `https://`. `http://` se acepta solo para `localhost`, `127.0.0.1` y `[::1]` (desarrollo).
- **En producción (`NODE_ENV=production`) el backend rechaza también las de localhost**, salvo que se defina `ALLOW_LOCALHOST_REDIRECTS=true` en su `.env`.
- No se admiten comodines (`*`), usuario y contraseña en la URL (`https://usuario:clave@sitio`) ni fragmentos (`#`). Máximo 2048 caracteres y 5 URIs por cliente.
- Las URIs ya registradas antes de estas reglas no se revalidan hasta que se vuelvan a guardar.


## Tests

```bash
npm run test
```

Los tests están junto al código que prueban (`*.spec.ts(x)` y `*.test.ts(x)`):

- `src/api/` — clientes HTTP (admin, auth, catálogos, estadísticas, alumnos) e interceptor de Axios.
- `src/store/authStore.test.ts` — lógica del store (setTokens, logout, refresh, bootstrap).
- `src/hooks/useAuth.test.ts` — flujo completo de 2FA.
- `src/components/layout/` — layout y rutas protegidas.
- `src/pages/` — una spec por página, incluidas las públicas (`SetPasswordPage`, `ConfirmEmailChangePage`).
- `src/utils/` — normalización de texto, rate limit y mensajes de error.


## CI — GitHub Actions

El pipeline corre en cada PR y push a `master` y `dev`:

1. **Lint, build y tests** con cobertura.
2. **`npm audit`**: bloquea si una dependencia de producción tiene una vulnerabilidad alta o crítica. El mismo análisis sobre las de desarrollo solo informa.
3. **Búsqueda de secretos con gitleaks** (la configuración está en `.gitleaks.toml`: ignora los tests, que usan datos inventados).
4. **CodeQL** (`.github/workflows/codeql.yml`): análisis estático del código, también una vez por semana.
5. **Dependabot** (`.github/dependabot.yml`): propone semanalmente actualizaciones de dependencias y de las acciones de GitHub.

Configuración en `.github/`.


## Backend relacionado

El backend SSO está en [github.com/ignamosconi/sso-itapu-back](https://github.com/ignamosconi/sso-itapu-back).

## App de ejemplo
Se desarrolló un "Gestor de PDFs de fechas de exámenes" que consume este SSO, para que los desarrolladores tengan un caso práctico de utilización del SSO.  
Puede consultarse a través del siguiente enlace:  
• Backend: [github.com/ignamosconi/sso-itapu-testApp-back](https://github.com/ignamosconi/sso-itapu-testApp-back).  
• Frontend: [github.com/ignamosconi/sso-itapu-testApp-front](https://github.com/ignamosconi/sso-itapu-testApp-front).
