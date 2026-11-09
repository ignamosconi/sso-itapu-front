import {
  Box, Title, Text, Accordion, Code, Anchor, Group,
  ThemeIcon, List, Card, Alert,
} from '@mantine/core';
import {
  IconBook, IconServer, IconPlus, IconHelp, IconCode,
  IconShieldCheck,
} from '@tabler/icons-react';
import { ENV } from '@/config/env';

export function FaqsPage() {
  const ssoUrl = ENV.API_BASE_URL;

  return (
    <Box>
      <Title order={2} mb={4}>FAQs</Title>
      <Text c="dimmed" mb="xl" size="sm">
        Guía rápida para admins del SSO y desarrolladores que quieran utilizarlo.
      </Text>

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
              <Anchor
                href="https://github.com/ignamosconi/sso-frvm"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/ignamosconi/sso-frvm
              </Anchor>
            </Text>
          </List.Item>
          <List.Item>
            <Text size="sm">
              Front-end administración:{' '}
              <Anchor
                href="https://github.com/ignamosconi/sso-frvm-admin"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/ignamosconi/sso-frvm-admin
              </Anchor>
            </Text>
          </List.Item>
        </List>
      </Card>

      <Box mb = "xl">
        <Title order={3} mb={4}>Implementación SSO</Title>
        <Accordion variant="separated" radius="md">

          {/* Soy administrador. ¿Cómo registro una nueva app para que pueda usar el SSO? */}
          <Accordion.Item value="nuevo-cliente">
            <Accordion.Control icon={<IconPlus size={16} />}>
              Soy administrador. ¿Cómo registro una nueva app para que pueda usar el SSO?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>Andá a la sección <strong>Clientes OAuth</strong> en el menú</List.Item>
                <List.Item>Hacé click en <strong>Nuevo cliente</strong></List.Item>
                <List.Item>
                  Completá el nombre de la app y las redirect URIs (podés cargar hasta 5,
                  incluyendo localhost para desarrollo). Las URIs deben empezar con{' '}
                  <Code>http://</Code> o <Code>https://</Code>
                </List.Item>
                <List.Item>
                  El sistema genera el <Code>client_secret</Code> automáticamente. Para que el desarrollador
                  lo vea, hay que enviarselo por mail desde el mismo modal que aparece a continuación.
                </List.Item>
                <List.Item>
                  El email incluye un <strong>link de un solo uso</strong> válido 24 horas con las
                  instrucciones de integración
                </List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Soy desarrollador ¿Cómo integro mi app con el SSO? */}
          <Accordion.Item value="integrar-sso">
            <Accordion.Control icon={<IconCode size={16} />}>
              Soy desarrollador ¿Cómo integro mi app con el SSO?
            </Accordion.Control>
            <Accordion.Panel>

              <Alert
                icon={<IconShieldCheck size={16} />}
                color="orange"
                mb="md"
                radius="md"
              >
                <Text size="sm">
                  Este mismo instructivo va a llegarle al desarrollador cuando reciba el email con sus credenciales.
                </Text>
              </Alert>

              <Text size="sm" mb="sm">
                Necesitás un <Code>client_id</Code>, un <Code>client_secret</Code> y hasta cinco <Code>redirect_uri</Code>. 
                Para obtenerlos, un administrador tiene que registrar tu app en el sistema. 
              </Text>

              <Text size="sm" fw={500} mb={4}>URL del SSO: <Code>{ssoUrl}</Code></Text>
              <List size="sm" spacing="sm">
                <List.Item>
                  <Text size="sm" fw={500}>1. Abrí el popup de login</Text>
                  <Code block mt={4}>
                    {`window.open(\n  '${ssoUrl}/sso/login' +\n  '?client_id=TU_ID' +\n  '&redirect_uri=TU_URI' +\n  '&state=VALOR_ALEATORIO' +\n  '&theme=dark',   // o theme=light\n  'sso-login',\n  'width=500,height=420'\n)`}
                  </Code>
                </List.Item>
                <List.Item>
                  <Text size="sm" fw={500}>2. Escuchá el postMessage</Text>
                  <Code block mt={4}>
                    {`window.addEventListener('message', (event) => {\n  // Verificá siempre el origen\n  if (event.origin !== '${ssoUrl}') return;\n  const { code, state } = event.data;\n  // Verificá que state coincida con el que generaste\n  // Mandá el code a tu backend\n})`}
                  </Code>
                </List.Item>
                <List.Item>
                  <Text size="sm" fw={500}>3. Tu backend canjea el code por tokens (server-to-server)</Text>
                  <Code block mt={4}>
                    {`POST ${ssoUrl}/sso/token\n{\n  "client_id": "TU_ID",\n  "client_secret": "TU_SECRET",\n  "code": "EL_CODE",\n  "redirect_uri": "TU_URI"\n}`}
                  </Code>
                </List.Item>
                <List.Item>
                  <Text size="sm" fw={500}>4. Identificá al usuario con el access_token</Text>
                  <Code block mt={4}>
                    {`GET ${ssoUrl}/sso/me\nAuthorization: Bearer ACCESS_TOKEN`}
                  </Code>
                </List.Item>

                <List.Item>
                  <Text size="sm" fw={500}>5. Renovar el access_token cuando expire (cada 15 minutos)</Text>
                  <Code block mt={4}>
                    {`POST ${ssoUrl}/sso/refresh\n{ "refresh_token": "TU_REFRESH_TOKEN" }\n\n// Respuesta: nuevo access_token Y nuevo refresh_token\n// IMPORTANTE: reemplazá AMBOS tokens almacenados\n// El refresh_token anterior queda inválido tras el canje`}
                  </Code>
                </List.Item>
                <List.Item>
                  <Text size="sm" fw={500}>6. Cerrar sesión del alumno voluntariamente</Text>
                  <Code block mt={4}>
                    {`POST ${ssoUrl}/sso/logout\n{ "refresh_token": "TU_REFRESH_TOKEN" }\n\n// Además: eliminá los tokens de sessionStorage en tu app`}
                  </Code>
                </List.Item>

              </List>

              <Alert color="blue" mt="md" radius="md">
                <Text size="sm" fw={500} mb={4}>Gestión de sesión</Text>
                <Text size="sm">La sesión del alumno finaliza si ocurre cualquiera de estas condiciones:</Text>
                <List size="sm" mt={4} spacing={2}>
                  <List.Item>Usar sessionStorage, no localstorage. Así, si se cierra la pestaña, se borran las credenciales.</List.Item>
                  <List.Item>Hace logout → tokens revocados en el servidor</List.Item>
                  <List.Item>Inactividad de 8 horas sin usar el refresh_token</List.Item>
                  <List.Item>Límite absoluto de 3 días desde el primer login</List.Item>
                  <List.Item>Reutilización de un refresh_token ya usado → familia completa revocada</List.Item>
                </List>
              </Alert>

            </Accordion.Panel>
          </Accordion.Item>

          {/* Soy desarrollador ¿Qué URLs pongo al registrar mi app? */}
          <Accordion.Item value="urls-recomendadas">
              <Accordion.Control icon={<IconServer size={16} />}>
                Soy desarrollador ¿Qué URLs pongo al registrar mi app?
              </Accordion.Control>
              <Accordion.Panel>
                <List size="sm" spacing="xs">
                  <List.Item>Te recomendamos cargar las siguientes URLs:</List.Item>
                  <List.Item>Localhost backend <Code>http://localhost:3000 </Code> </List.Item>
                  <List.Item>Localhost frontend (dev) <Code>https://localhost:5173</Code> </List.Item>
                  <List.Item>Localhost frontend (build) <Code>http://localhost:4173</Code> </List.Item>
                  <List.Item>URL que vas a usar para el SSO<Code>https://tu.app.com/callback</Code> </List.Item>
                </List>
            </Accordion.Panel>
          </Accordion.Item>

        </Accordion>
      </Box>

      <Box mb = "xl">
        <Title order={3} mb={4}>Uso de este panel de administración</Title>
        <Accordion variant="separated" radius="md">
          {/* ¿Cómo creo un nuevo administrador del panel? */}
          <Accordion.Item value="nuevo-admin">
            <Accordion.Control icon={<IconHelp size={16} />}>
              ¿Cómo creo un nuevo administrador del panel?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>Andá a la sección <strong>Administradores</strong> en el menú</List.Item>
                <List.Item>Hacé click en <strong>Nuevo admin</strong></List.Item>
                <List.Item>Completá el usuario y la contraseña</List.Item>
                <List.Item>
                  El nuevo admin puede ingresar al panel con esas credenciales — en el primer
                  login deberá configurar su autenticador 2FA (Google Authenticator)
                </List.Item>
                <List.Item>Las credenciales de admin son independientes de las de autogestión</List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Un desarrollador perdió el client_secret de su app, ¿qué hago? */}
          <Accordion.Item value="secret-perdido">
            <Accordion.Control icon={<IconHelp size={16} />}>
              Un desarrollador perdió el client_secret de su app, ¿qué hago?
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm">
                Andá a <strong>Clientes OAuth</strong>, buscá la app y hacé click en el ícono de
                regenerar secret. El sistema genera uno nuevo y el anterior queda invalidado
                inmediatamente. Desde el modal del nuevo secret podés enviárselo al desarrollador
                por email — recibirá un link de un solo uso válido por 24 horas.
              </Text>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Soy administrador. ¿Qué hago si creo que mi código 2FA fue comprometido? */}
          <Accordion.Item value="2fa-comprometido">
            <Accordion.Control icon={<IconShieldCheck size={16} />}>
              Soy administrador. ¿Qué hago si creo que mi código 2FA fue comprometido?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>
                  Andá a <strong>Mi perfil</strong> en el menú de navegación
                </List.Item>
                <List.Item>
                  En la sección <strong>Autenticación de dos factores</strong>, ingresá tu
                  contraseña actual y hacé click en <strong>Resetear autenticador 2FA</strong>
                </List.Item>
                <List.Item>
                  El secret TOTP anterior queda invalidado en el servidor inmediatamente — cualquier
                  código generado con él va a fallar
                </List.Item>
                <List.Item>
                  La próxima vez que inicies sesión, el sistema te pedirá escanear un nuevo QR
                  con tu autenticador
                </List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Box>
      
      <Box mb = "xl">
        <Title order={3} mb={4}>Repositorios de SSO FRVM</Title>
        <Accordion variant="separated" radius="md">
          {/* Backend */}
          <Accordion.Item value="levantar-backend">
            <Accordion.Control icon={<IconServer size={16} />}>
              ¿Cómo levanto el repositorio backend del SSO?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>Cloná el repo: <Code>git clone htpps://www.github.com/ignamosconi/sso-frvm.git</Code></List.Item>
                <List.Item>Copiá <Code>.env.example</Code> a <Code>.env</Code> y completá los valores</List.Item>
                <List.Item>Corré <Code>npm install</Code></List.Item>
                <List.Item>Levantá la base de datos: <Code>docker compose up -d</Code></List.Item>
                <List.Item>Levantá el servidor: <Code>npm run start:prod</Code></List.Item>
                <List.Item>El servidor queda en <Code>{ssoUrl}</Code></List.Item>
                <List.Item>
                  La documentación de la API está en <Code>{ssoUrl}/docs</Code> (requiere usuario y contraseña del .env)
                </List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Frontend */}
          <Accordion.Item value="levantar-panel">
            <Accordion.Control icon={<IconServer size={16} />}>
              ¿Cómo levanto este panel de administración?
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>Cloná el repo: <Code>git clone htpps://www.github.com/ignamosconi/sso-frvm-admin.git</Code></List.Item>
                <List.Item>
                  Copiá <Code>.env.example</Code> a <Code>.env</Code> y verificá que{' '}
                  <Code>VITE_API_BASE_URL</Code> apunte al backend
                </List.Item>
                <List.Item>Corré <Code>npm install</Code></List.Item>
                <List.Item>
                  Corré <Code>npm run dev</Code> para desarrollo o <Code>npm run build</Code> para producción
                </List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

        </Accordion>
      </Box>

    </Box>
  );
}