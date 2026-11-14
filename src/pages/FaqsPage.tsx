import {
  Box, Title, Text, Accordion, Code, Anchor, Group,
  ThemeIcon, List, Card, Alert,
} from '@mantine/core';
import {
  IconBook, IconServer, IconPlus, IconHelp, IconCode,
  IconShieldCheck, IconUsers,
} from '@tabler/icons-react';
import { ENV } from '@/config/env';

export function FaqsPage() {
  const ssoUrl = ENV.API_BASE_URL;

  return (
    <Box>
      <Title order={2} mb={4}>FAQs</Title>
      <Text c="dimmed" mb="xl" size="sm">
        Guía de referencia para administradores del SSO y desarrolladores que quieran integrarlo.
      </Text>

      {/* Repositorios */}
      <Card withBorder radius="md" p="lg" mb="xl">
        <Group mb="sm">
          <ThemeIcon variant="light" color="orange" radius="md">
            <IconBook size={16} />
          </ThemeIcon>
          <Text fw={600}>Repositorios</Text>
        </Group>
        <List spacing="xs" size="sm">
          <List.Item>
            <Text size="sm">
              Backend SSO:{' '}
              <Anchor href="https://github.com/ignamosconi/sso-itapu-back" target="_blank" rel="noopener noreferrer">
                github.com/ignamosconi/sso-itapu-back
              </Anchor>
            </Text>
          </List.Item>
          <List.Item>
            <Text size="sm">
              Panel de administración:{' '}
              <Anchor href="https://github.com/ignamosconi/sso-itapu-front" target="_blank" rel="noopener noreferrer">
                github.com/ignamosconi/sso-itapu-front
              </Anchor>
            </Text>
          </List.Item>
        </List>
      </Card>

      {/* ── Integración SSO ── */}
      <Box mb="xl">
        <Title order={3} mb="md">Integración SSO</Title>
        <Accordion variant="separated" radius="md">

          <Accordion.Item value="nuevo-cliente">
            <Accordion.Control icon={<IconPlus size={16} />}>
              Soy administrador. ¿Cómo registro una nueva app para que use el SSO?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>Andá a <strong>Clientes OAuth</strong> en el menú lateral.</List.Item>
                <List.Item>Hacé click en <strong>Nuevo cliente</strong>.</List.Item>
                <List.Item>
                  Completá el nombre de la app y las redirect URIs. Podés cargar localhost para
                  desarrollo y la URL de producción. Las URIs deben empezar con{' '}
                  <Code>http://</Code> (debe usarse solo para localhost) o <Code>https://</Code>. 
                </List.Item>
                <List.Item>
                  El sistema genera el <Code>client_secret</Code> automáticamente. Para enviárselo
                  al desarrollador, ingresá su email en el modal que aparece: recibirá un
                  link de un solo uso válido por 24 horas con instrucciones completas de integración.
                </List.Item>
                <List.Item>
                  Si necesitás reenviar las credenciales más adelante, regenerá el secret desde la
                  tabla de clientes y volvé a enviar el email.
                </List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="integrar-sso">
            <Accordion.Control icon={<IconCode size={16} />}>
              Soy desarrollador. ¿Cómo integro mi app con el SSO?
            </Accordion.Control>
            <Accordion.Panel>
              <Alert icon={<IconShieldCheck size={16} />} color="orange" mb="md" radius="md">
                <Text size="sm">
                  Este instructivo también va en el email de credenciales que recibe el desarrollador.
                </Text>
              </Alert>

              <Text size="sm" mb="sm">
                Necesitás un <Code>client_id</Code>, un <Code>client_secret</Code> y al menos una{' '}
                <Code>redirect_uri</Code> registrada. Un administrador tiene que registrar tu app.
              </Text>

              <Text size="sm" fw={600} mb={4}>URL del SSO: <Code>{ssoUrl}</Code></Text>

              <List size="sm" spacing="sm">
                <List.Item>
                  <Text size="sm" fw={500}>0. Consultá los valores dinámicos (no hardcodees)</Text>
                  <Code block mt={4}>
                    {`GET ${ssoUrl}/sso/info/domain-roles\n// → ["Alumno", "Docente", "Autoridad", ...]\n// Valores posibles del campo "grupo" en /sso/me\n\nGET ${ssoUrl}/sso/info/specialties\n// → ["Sistemas", "Mecánica", ...]\n// Valores posibles del campo "carrera" en /sso/me`}
                  </Code>
                  <Text size="xs" c="dimmed" mt={4}>
                    Estos endpoints son públicos. Si el administrador agrega o renombra un cargo o
                    especialidad, tu app lo refleja sin cambios de código.
                  </Text>
                </List.Item>

                <List.Item>
                  <Text size="sm" fw={500}>1. Abrí el popup de login</Text>
                  <Code block mt={4}>
                    {`const state = crypto.randomUUID();\nsessionStorage.setItem('oauth_state', state);\n\nwindow.open(\n  '${ssoUrl}/sso/login' +\n  '?client_id=TU_ID' +\n  '&redirect_uri=TU_URI' +\n  '&state=' + state +\n  '&theme=dark',    // o theme=light\n  'sso-login',\n  'width=480,height=560'\n);`}
                  </Code>
                  <Text size="xs" c="dimmed" mt={4}>
                    El popup pide usuario y contraseña en dos pasos. Si el usuario no configuró
                    contraseña todavía, el SSO le envía un email automáticamente.
                  </Text>
                </List.Item>

                <List.Item>
                  <Text size="sm" fw={500}>2. Escuchá el postMessage</Text>
                  <Code block mt={4}>
                    {`window.addEventListener('message', (event) => {\n  // Verificá siempre el origen — nunca omitas esto\n  if (event.origin !== '${ssoUrl}') return;\n\n  const { code, state } = event.data;\n\n  if (state !== sessionStorage.getItem('oauth_state')) {\n    console.error('State inválido — posible CSRF');\n    return;\n  }\n  sessionStorage.removeItem('oauth_state');\n\n  // Mandá el code a tu backend\n});`}
                  </Code>
                </List.Item>

                <List.Item>
                  <Text size="sm" fw={500}>3. Tu backend canjea el code por tokens</Text>
                  <Code block mt={4}>
                    {`POST ${ssoUrl}/sso/token\n{\n  "client_id": "TU_ID",\n  "client_secret": "TU_SECRET",\n  "code": "EL_CODE",\n  "redirect_uri": "TU_URI"\n}\n// El code es de un solo uso y expira en 2 minutos`}
                  </Code>
                </List.Item>

                <List.Item>
                  <Text size="sm" fw={500}>4. Identificá al usuario</Text>
                  <Code block mt={4}>
                    {`GET ${ssoUrl}/sso/me\nAuthorization: Bearer ACCESS_TOKEN\n\n// Respuesta:\n// {\n//   "sub": "uuid",              ← ID único, usalo como clave en tu sistema\n//   "nombre": "Ignacio Mariano",\n//   "apellido": "Mosconi",\n//   "username": "immosconi136",\n//   "especialidad": "Sistemas", ← ver /sso/info/specialties\n//   "email": "...",\n//   "cargo": "Alumno"           ← ver /sso/info/domain-roles\n// }`}
                  </Code>
                </List.Item>

                <List.Item>
                  <Text size="sm" fw={500}>5. Renovar el access_token (expira cada 15 minutos)</Text>
                  <Code block mt={4}>
                    {`POST ${ssoUrl}/sso/refresh\n{ "refresh_token": "TU_REFRESH_TOKEN" }\n\n// Respuesta: nuevo access_token Y nuevo refresh_token\n// IMPORTANTE: reemplazá AMBOS — el refresh anterior queda inválido\n// Si usás un refresh ya consumido, toda la sesión se revoca`}
                  </Code>
                </List.Item>

                <List.Item>
                  <Text size="sm" fw={500}>6. Cerrar sesión</Text>
                  <Code block mt={4}>
                    {`POST ${ssoUrl}/sso/logout\n{ "refresh_token": "TU_REFRESH_TOKEN" }\n\n// También eliminá los tokens del almacenamiento de tu app`}
                  </Code>
                </List.Item>
              </List>

              <Alert color="blue" mt="md" radius="md">
                <Text size="sm" fw={500} mb={4}>Duración de la sesión</Text>
                <List size="sm" spacing={2}>
                  <List.Item>Logout voluntario → tokens revocados en el servidor.</List.Item>
                  <List.Item>Inactividad de 8 horas sin usar el refresh_token.</List.Item>
                  <List.Item>Límite absoluto de 3 días desde el primer login.</List.Item>
                  <List.Item>Reutilización de refresh_token usado → familia revocada al instante.</List.Item>
                </List>
              </Alert>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="urls-recomendadas">
            <Accordion.Control icon={<IconServer size={16} />}>
              Soy desarrollador. ¿Qué redirect URIs registro en mi app?
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" mb="sm">Te recomendamos registrar todas las que vas a usar en desarrollo y producción:</Text>
              <List size="sm" spacing="xs">
                <List.Item>Backend local: <Code>http://localhost:3000</Code></List.Item>
                <List.Item>Frontend Vite (dev): <Code>http://localhost:5173</Code></List.Item>
                <List.Item>Frontend Vite (preview): <Code>http://localhost:4173</Code></List.Item>
                <List.Item>Producción: <Code>https://tu-app.com/callback</Code></List.Item>
              </List>
              <Text size="xs" c="dimmed" mt="sm">
                La redirect_uri que uses en el popup debe coincidir exactamente con una de las registradas.
              </Text>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="roles-especialidades">
            <Accordion.Control icon={<IconCode size={16} />}>
              ¿Cómo sé qué valores puede tener el campo "grupo" o "carrera" del usuario?
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" mb="sm">
                El campo <Code>grupo</Code> contiene el cargo institucional (Alumno, Docente, etc.) y{' '}
                <Code>carrera</Code> la especialidad. Estos valores los configura el administrador y
                pueden cambiar. Para no hardcodearlos, consultá los endpoints públicos:
              </Text>
              <Code block mb="sm">
                {`GET ${ssoUrl}/sso/info/domain-roles\n→ ["Alumno", "Docente", "Autoridad", ...]\n\nGET ${ssoUrl}/sso/info/specialties\n→ ["Sistemas", "Mecánica", ...]`}
              </Code>
              <Text size="sm">
                Ejemplo de uso: si tu app solo debe permitir el acceso a docentes, hacé{' '}
                <Code>GET /sso/info/domain-roles</Code> al iniciar y verificá que el rol "Docente"
                exista. Luego, al autenticar, verificá que <Code>grupo === 'Docente'</Code>.
              </Text>
            </Accordion.Panel>
          </Accordion.Item>

        </Accordion>
      </Box>

      {/* ── Uso del panel ── */}
      <Box mb="xl">
        <Title order={3} mb="md">Uso de este panel</Title>
        <Accordion variant="separated" radius="md">

          <Accordion.Item value="nuevo-admin">
            <Accordion.Control icon={<IconHelp size={16} />}>
              ¿Cómo creo un nuevo administrador del panel?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>Andá a <strong>Configuración → Administradores</strong>.</List.Item>
                <List.Item>Hacé click en <strong>Nuevo admin</strong> e ingresá usuario y contraseña.</List.Item>
                <List.Item>
                  En el primer login, el sistema le pedirá escanear un QR para configurar
                  el autenticador 2FA (Google Authenticator o similar).
                </List.Item>
                <List.Item>Las credenciales de admin son independientes de las del SSO de alumnos.</List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="cargar-usuarios">
            <Accordion.Control icon={<IconUsers size={16} />}>
              ¿Cómo cargo usuarios en el sistema?
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" mb="sm">Hay dos formas:</Text>
              <Text size="sm" fw={500} mb={4}>Alta individual</Text>
              <List size="sm" spacing="xs" mb="sm">
                <List.Item>Andá a <strong>Usuarios → Cargar usuarios → Alta individual</strong>.</List.Item>
                <List.Item>Completá todos los campos y confirmá. El sistema genera el nombre de usuario automáticamente y envía un email de bienvenida al usuario con un link para configurar su contraseña.</List.Item>
              </List>
              <Text size="sm" fw={500} mb={4}>Carga masiva por Excel</Text>
              <List size="sm" spacing="xs">
                <List.Item>Andá a <strong>Usuarios → Cargar usuarios → Carga masiva</strong>.</List.Item>
                <List.Item>Descargá el Excel de ejemplo — incluye los cargos y especialidades válidos en las columnas I y J.</List.Item>
                <List.Item>Completá el archivo y subilo. Se muestra un preview con errores por fila antes de confirmar.</List.Item>
                <List.Item>Al confirmar, se importan solo las filas válidas y se envían emails de bienvenida a cada usuario.</List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="usuario-no-recibio-mail">
            <Accordion.Control icon={<IconHelp size={16} />}>
              Un usuario dice que no recibió el email de bienvenida. ¿Qué hago?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>Andá a <strong>Usuarios → Padrón</strong> y buscá al usuario.</List.Item>
                <List.Item>Si su estado es <strong>Pendiente</strong>, su cuenta existe pero no configuró contraseña.</List.Item>
                <List.Item>
                  Hacé click en el ícono de sobre azul en la columna de acciones para reenviar el email
                  de bienvenida. El modal muestra el email censurado al que se enviará.
                </List.Item>
                <List.Item>Si el email está mal cargado, editá al usuario (ícono de lápiz) para corregirlo antes de reenviar.</List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="secret-perdido">
            <Accordion.Control icon={<IconHelp size={16} />}>
              Un desarrollador perdió el client_secret de su app. ¿Qué hago?
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm">
                Andá a <strong>Clientes OAuth</strong>, buscá la app y hacé click en el ícono de regenerar secret.
                El sistema genera uno nuevo y el anterior queda invalidado inmediatamente. Desde el modal
                podés enviárselo al desarrollador por email — recibirá un link de un solo uso válido por 24 horas.
              </Text>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="2fa-comprometido">
            <Accordion.Control icon={<IconShieldCheck size={16} />}>
              Creo que mi autenticador 2FA fue comprometido. ¿Qué hago?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>Andá a <strong>Configuración → Mi perfil</strong>.</List.Item>
                <List.Item>En la tab <strong>Autenticador 2FA</strong>, ingresá tu contraseña y hacé click en <strong>Resetear autenticador 2FA</strong>.</List.Item>
                <List.Item>El secret TOTP anterior queda invalidado en el servidor inmediatamente.</List.Item>
                <List.Item>En el próximo login, el sistema te pedirá escanear un nuevo QR.</List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="roles-especialidades-admin">
            <Accordion.Control icon={<IconHelp size={16} />}>
              ¿Cómo creo o elimino cargos y especialidades?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>Los cargos se gestionan en <strong>Usuarios → Roles institucionales</strong>.</List.Item>
                <List.Item>Las especialidades se gestionan en <strong>Usuarios → Especialidades</strong>.</List.Item>
                <List.Item>Podés crear los que necesites. El nombre solo admite letras y espacios.</List.Item>
                <List.Item>
                  <strong>No podés eliminar</strong> un cargo o especialidad que tenga usuarios asignados.
                  Primero reasigná o dá de baja a esos usuarios.
                </List.Item>
                <List.Item>
                  Cualquier cambio se refleja automáticamente en los endpoints públicos{' '}
                  <Code>/sso/info/domain-roles</Code> y <Code>/sso/info/specialties</Code>.
                </List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

        </Accordion>
      </Box>

      {/* ── Repositorios ── */}
      <Box mb="xl">
        <Title order={3} mb="md">Levantar los repositorios</Title>
        <Accordion variant="separated" radius="md">

          <Accordion.Item value="levantar-backend">
            <Accordion.Control icon={<IconServer size={16} />}>
              ¿Cómo levanto el backend del SSO?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>Cloná el repo: <Code>git clone https://github.com/ignamosconi/sso-itapu-back.git</Code></List.Item>
                <List.Item>Copiá <Code>.env.example</Code> a <Code>.env</Code> y completá todos los valores.</List.Item>
                <List.Item>Corré <Code>npm install</Code>.</List.Item>
                <List.Item>Levantá la base de datos y Redis: <Code>docker compose up -d</Code></List.Item>
                <List.Item>Levantá el servidor: <Code>npm run start:dev</Code> (las migraciones corren automáticamente).</List.Item>
                <List.Item>El servidor queda en <Code>{ssoUrl}</Code>.</List.Item>
                <List.Item>
                  La documentación Swagger está en <Code>{ssoUrl}/docs</Code> (requiere usuario y contraseña del .env).
                </List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="levantar-panel">
            <Accordion.Control icon={<IconServer size={16} />}>
              ¿Cómo levanto este panel de administración?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>Cloná el repo: <Code>git clone https://github.com/ignamosconi/sso-itapu-front.git</Code></List.Item>
                <List.Item>Copiá <Code>.env.example</Code> a <Code>.env</Code> y verificá que <Code>VITE_API_BASE_URL</Code> apunte al backend.</List.Item>
                <List.Item>Corré <Code>npm install</Code>.</List.Item>
                <List.Item>Corré <Code>npm run dev</Code> para desarrollo o <Code>npm run build</Code> para producción.</List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

        </Accordion>
      </Box>
    </Box>
  );
}