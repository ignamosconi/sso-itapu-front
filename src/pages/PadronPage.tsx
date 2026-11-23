import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';
import {
  Box, Title, Text, Table, Group, Badge, TextInput, Select,
  ActionIcon, Loader, Center, Alert, Pagination, Modal,
  Button, PasswordInput, Tooltip, Flex,
} from '@mantine/core';
import {
  IconSearch, IconAlertCircle, IconPlayerPause,
  IconPlayerPlay, IconTrash, IconMail, IconClockPause, IconPencil, IconCheck,
} from '@tabler/icons-react';
import { studentsApi } from '@/api/studentsApi';
import { rolesApi } from '@/api/rolesApi';
import { specialtiesApi } from '@/api/specialtiesApi';
import { StudentResponse, DomainRoleResponse, SpecialtyResponse, ResponsibleApp } from '@/types/api.types';
import { getRateLimitInfo, getPasswordAttemptsInfo, formatWait, RateLimitKind } from '@/utils/rateLimit';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activo', color: 'green' },
  suspended: { label: 'Suspendido', color: 'red' },
  pending_registration: { label: 'Pendiente', color: 'orange' },
};

interface PadronQuery {
  search: string;
  status: string | null;
  role: string | null;
  spec: string | null;
  page: number;
  pageSize: number;
}

export function PadronPage() {
  const [students, setStudents] = useState<StudentResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [query, setQuery] = useState<PadronQuery>({
  search: '', status: null, role: null, spec: null, page: 1, pageSize: 10,
  });
  const { page, pageSize } = query;

  const PAGE_SIZE_OPTIONS = ['5', '10', '20', '50'];

  const [searchText, setSearchText] = useState('');
  const applySearch = useDebouncedCallback(
    (text: string) => setQuery(q => ({ ...q, search: text.trim(), page: 1 })),
    300,
  );


  const [roles, setRoles] = useState<DomainRoleResponse[]>([]);
  const [specs, setSpecs] = useState<SpecialtyResponse[]>([]);

  // Modal eliminar
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentResponse | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [resendModal, setResendModal] = useState(false);
  const [resendTarget, setResendTarget] = useState<StudentResponse | null>(null);
  const [resendConfirmLoading, setResendConfirmLoading] = useState(false);

  // Espera forzada por el backend (429): demasiados requests o demasiados intentos de contraseña.
  const [rateLimit, setRateLimit] = useState<{ kind: RateLimitKind; until: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Mientras se consulta si el alumno ya está bloqueado, no se deja intentar la baja.
  const [lockChecking, setLockChecking] = useState(false);
  const lockCheckId = useRef(0);


  // Modal cambiar email (comparte con la baja la espera, el bloqueo y la consulta de bloqueo)
  const [emailModal, setEmailModal] = useState(false);
  const [emailModalKey, setEmailModalKey] = useState(0);
  const [emailTarget, setEmailTarget] = useState<StudentResponse | null>(null);
  const [emailValue, setEmailValue] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);

  const maskEmail = (email: string): string => {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  };
  const [deleteModalKey, setDeleteModalKey] = useState(0);

  // Modal de conflicto: usuario es responsable de apps
  const [conflictModal, setConflictModal] = useState(false);
  const [conflictApps, setConflictApps] = useState<ResponsibleApp[]>([]);
  const [conflictStudentName, setConflictStudentName] = useState('');

  const latestRequest = useRef(0);

  const load = async (silent = false) => {
    const requestId = ++latestRequest.current;
    if (!silent) setLoading(true);
    try {
      const res = await studentsApi.findAll({
        search: query.search || undefined,
        accountStatus: query.status ?? undefined,
        domainRoleId: query.role ? parseInt(query.role, 10) : undefined,
        specialtyId: query.spec ? parseInt(query.spec, 10) : undefined,
        page: query.page,
        limit: query.pageSize,
      });
      if (requestId !== latestRequest.current) return;
      setStudents(res.data);
      setTotal(res.total);
    } catch {
      if (requestId === latestRequest.current) setError('Error al cargar el padrón.');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [query]);
  useEffect(() => {
    void rolesApi.findAll().then(setRoles);
    void specialtiesApi.findAll().then(setSpecs);
  }, []);

  // Cuenta regresiva de la espera: actualiza `now` cada segundo y limpia el bloqueo al llegar a 0.
  useEffect(() => {
    if (!rateLimit) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= rateLimit.until) setRateLimit(null);
    }, 1000);
    return () => clearInterval(id);
  }, [rateLimit]);

  const waitSeconds = rateLimit ? Math.max(0, Math.ceil((rateLimit.until - now) / 1000)) : 0;

  const handleResendWelcome = async () => {
    if (!resendTarget) return;
    setResendConfirmLoading(true);
    try {
      await studentsApi.resendWelcome(resendTarget.id);
      setResendModal(false);
      setResendTarget(null);
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax?.response?.data?.message ?? 'Error al reenviar el email.');
      setResendModal(false);
    } finally {
      setResendConfirmLoading(false);
    }
  };

  const handleSuspend = async (id: string) => {
    setActionLoadingId(id);
    try {
      await studentsApi.suspend(id);
      await load(true);
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax?.response?.data?.message ?? 'Error.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleActivate = async (id: string) => {
    setActionLoadingId(id);
    try {
      await studentsApi.activate(id);
      await load(true);
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax?.response?.data?.message ?? 'Error.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const startCooldown = (kind: RateLimitKind, seconds: number) => {
    const t = Date.now();
    setNow(t);
    setRateLimit({ kind, until: t + seconds * 1000 });
  };

  // Consulta si el alumno ya está en cooldown, sin gastar un intento para descubrirlo.
  const checkLock = (s: StudentResponse) => {
    const checkId = ++lockCheckId.current;
    if (!s.hasPassword) { setLockChecking(false); return; }
    setLockChecking(true);
    studentsApi.getPasswordLock(s.id)
      .then(status => {
        if (checkId === lockCheckId.current && status.locked) {
          startCooldown('locked', status.retryAfterSeconds);
        }
      })
      // Si la consulta falla no pasa nada grave: el servidor igual bloquea el intento.
      .catch(() => undefined)
      .finally(() => { if (checkId === lockCheckId.current) setLockChecking(false); });
  };

  // Errores comunes a la baja y al cambio de email: espera por demasiados requests (429),
  // alumno bloqueado (429) o contraseña incorrecta (403). Devuelve true si ya se lo mostró al usuario.
  const handleAttemptError = (err: unknown, showMessage: (message: string) => void): boolean => {
    const rl = getRateLimitInfo(err);
    if (rl) {
      startCooldown(rl.kind, rl.seconds);
      return true;
    }
    const wrongPassword = getPasswordAttemptsInfo(err);
    if (!wrongPassword) return false;
    if (wrongPassword.attemptsRemaining === 0) {
      // Era el último intento: el cooldown aparece ya, sin esperar a un intento más.
      startCooldown('locked', wrongPassword.retryAfterSeconds);
    } else {
      const n = wrongPassword.attemptsRemaining;
      showMessage(
        `La contraseña ingresada es incorrecta. Te ${n === 1 ? 'queda 1 intento' : `quedan ${n} intentos`}.`,
      );
    }
    return true;
  };

  const openDelete = (s: StudentResponse) => {
    setDeleteTarget(s); setDeletePassword(''); setDeleteError(null); setRateLimit(null);
    setDeleteModalKey(k => k + 1); setDeleteModal(true);
    checkLock(s);
  };

  const handleDelete = async () => {
    // Se ignora el envío si ya hay uno en curso (Enter + clic) o si hay una espera vigente.
    if (!deleteTarget || deleteLoading || lockChecking || waitSeconds > 0) return;
    setDeleteLoading(true); setDeleteError(null);
    try {
      await studentsApi.remove(deleteTarget.id, { password: deletePassword || undefined });
      setDeleteModal(false);
      await load(true);
    } catch (err) {
      if (!handleAttemptError(err, setDeleteError)) {
        const ax = err as { response?: { status?: number; data?: { message?: string; responsibleApps?: ResponsibleApp[] } } };
        if (ax?.response?.status === 409 && ax?.response?.data?.responsibleApps) {
          // Cerrar modal de baja y abrir modal de conflicto
          setDeleteModal(false);
          setConflictStudentName(`${deleteTarget.first_name} ${deleteTarget.last_name}`);
          setConflictApps(ax.response.data.responsibleApps);
          setConflictModal(true);
        } else {
          setDeleteError(ax?.response?.data?.message ?? 'Error al eliminar.');
        }
      }
    } finally { setDeleteLoading(false); }
  };

  const openEmailChange = (s: StudentResponse) => {
    setEmailTarget(s); setEmailValue(''); setEmailPassword(''); setEmailError(null);
    setEmailSentTo(null); setRateLimit(null);
    setEmailModalKey(k => k + 1); setEmailModal(true);
    checkLock(s);
  };

  const handleEmailChange = async () => {
    // Se ignora el envío si ya hay uno en curso (Enter + clic) o si hay una espera vigente.
    if (!emailTarget || emailLoading || lockChecking || waitSeconds > 0) return;
    const newEmail = emailValue.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setEmailError('Ingresá un email válido.'); return; }
    if (newEmail.toLowerCase() === emailTarget.email.toLowerCase()) {
      setEmailError('El nuevo email es igual al actual.'); return;
    }
    if (!emailPassword) { setEmailError('Ingresá la contraseña del alumno.'); return; }

    setEmailLoading(true); setEmailError(null);
    try {
      await studentsApi.requestEmailChange(emailTarget.id, { password: emailPassword, newEmail });
      setEmailPassword('');
      setEmailSentTo(newEmail);
    } catch (err) {
      if (!handleAttemptError(err, setEmailError)) {
        const ax = err as { response?: { data?: { message?: string | string[] } } };
        const msg = ax?.response?.data?.message;
        setEmailError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Error al solicitar el cambio de email.'));
      }
    } finally { setEmailLoading(false); }
  };

  // Aviso de espera (compartido por los modales de baja y de cambio de email)
  const cooldownAlert = waitSeconds > 0 && rateLimit && (
    <Alert icon={<IconClockPause size={16} />} color="orange" mb="sm" role="alert">
      {rateLimit.kind === 'locked'
        ? 'Se superó el máximo de intentos de contraseña para este alumno. '
        : 'Estás haciendo peticiones demasiado rápido. '}
      Podrás volver a intentarlo en <strong>{formatWait(waitSeconds)}</strong>.
    </Alert>
  );

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={2} mb={4}>Padrón</Title>
          <Text c="dimmed" size="sm">Listado de usuarios registrados en el sistema. Total: {total}</Text>
        </Box>
      </Group>

      {error && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{error}</Alert>}

      {/* Filtros */}
      <Group mb="md" justify="space-between" wrap="wrap" gap="sm">
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Usuario, nombre o DNI..."
            leftSection={<IconSearch size={14} />}
            value={searchText}
            onChange={e => { setSearchText(e.target.value); applySearch(e.target.value); }}
            w={300}
          />
          <Select
            placeholder="Estado"
            clearable
            value={query.status}
            onChange={v => setQuery(q => ({ ...q, status: v, page: 1 }))}
            w={160}
            data={[
              { value: 'active', label: 'Activo' },
              { value: 'suspended', label: 'Suspendido' },
              { value: 'pending_registration', label: 'Pendiente' },
            ]}
          />
          <Select
            placeholder="Cargo"
            clearable
            value={query.role}
            onChange={v => setQuery(q => ({ ...q, role: v, page: 1 }))}
            w={160}
            data={roles.map(r => ({ value: String(r.id), label: r.name }))}
          />
          <Select
            placeholder="Especialidad"
            clearable
            value={query.spec}
            onChange={v => setQuery(q => ({ ...q, spec: v, page: 1 }))}
            w={160}
            data={specs.map(s => ({ value: String(s.id), label: s.name }))}
          />
        </Group>

        <Select
          data={PAGE_SIZE_OPTIONS}
          value={String(pageSize)}
          onChange={v => setQuery(q => ({ ...q, pageSize: Number(v), page: 1 }))}
          w={100}
          allowDeselect={false}
        />
      </Group>

      {loading ? <Center h={200}><Loader /></Center> : (
        <>
          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover withTableBorder style={{ fontSize: 13, minWidth: 700 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Usuario</Table.Th>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>DNI</Table.Th>
                  <Table.Th>Cargo</Table.Th>
                  <Table.Th>Especialidad</Table.Th>
                  <Table.Th miw={115}>Estado</Table.Th>
                  <Table.Th>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {students.map(s => {
                  const st = STATUS_LABELS[s.account_status] ?? { label: s.account_status, color: 'gray' };
                  const isRowLoading = actionLoadingId === s.id;
                  return (
                    <Table.Tr key={s.id}>
                      <Table.Td><Text size="sm" fw={500}>{s.username}</Text></Table.Td>
                      <Table.Td>{s.first_name} {s.last_name}</Table.Td>
                      <Table.Td>{s.dni}</Table.Td>
                      <Table.Td>{s.domainRole.name}</Table.Td>
                      <Table.Td>{s.specialty.name}</Table.Td>
                      <Table.Td miw={115} style={{ whiteSpace: 'nowrap' }}>
                        <Badge
                          color={st.color}
                          size="sm"
                          style={{ whiteSpace: 'nowrap', width: 'max-content', flexShrink: 0 }}
                        >
                          {st.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Flex direction={{ base: 'column', sm: 'row' }} gap={4} align="center">
                          {s.account_status !== 'suspended' ? (
                            <Tooltip label="Suspender">
                              <ActionIcon
                                variant="subtle"
                                color="orange"
                                loading={isRowLoading}
                                onClick={() => void handleSuspend(s.id)}
                              >
                                <IconPlayerPause size={15} />
                              </ActionIcon>
                            </Tooltip>
                          ) : (
                            <Tooltip label="Reactivar">
                              <ActionIcon
                                variant="subtle"
                                color="green"
                                loading={isRowLoading}
                                onClick={() => void handleActivate(s.id)}
                              >
                                <IconPlayerPlay size={15} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          {s.account_status === 'pending_registration' && (
                            <Tooltip label="Reenviar email de bienvenida">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                loading={false}
                                onClick={() => { setResendTarget(s); setResendModal(true); }}
                              >
                                <IconMail size={15} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          <Tooltip label="Dar de baja">
                            <ActionIcon variant="subtle" color="red" onClick={() => openDelete(s)}>
                              <IconTrash size={15} />
                            </ActionIcon>
                          </Tooltip>

                          {s.account_status === 'active' && (
                            <Tooltip label="Cambiar email">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                aria-label="Cambiar email"
                                onClick={() => openEmailChange(s)}
                              >
                                <IconPencil size={15} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Flex>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={p => setQuery(q => ({ ...q, page: p }))} />
          </Group>
        </>
      )}

      {/* ── Modal confirmar reenvío ── */}
      <Modal
        opened={resendModal}
        onClose={() => { setResendModal(false); setResendTarget(null); }}
        title="Reenviar email de bienvenida"
        centered
        size="sm"
      >
        <Text size="sm" mb="xs">
          Se enviará un nuevo link de configuración de contraseña a:
        </Text>
        <Text size="sm" fw={600} mb="lg" c="orange">
          {resendTarget ? maskEmail(resendTarget.email) : ''}
        </Text>
        <Text size="xs" c="dimmed" mb="lg">
          El link anterior quedará invalidado automáticamente cuando se use el nuevo.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={() => { setResendModal(false); setResendTarget(null); }}>
            Cancelar
          </Button>
          <Button
            color="blue"
            loading={resendConfirmLoading}
            onClick={() => void handleResendWelcome()}
          >
            Reenviar
          </Button>
        </Group>
      </Modal>

      <Modal key={deleteModalKey} opened={deleteModal} onClose={() => setDeleteModal(false)} title="Dar de baja usuario" centered>
        <Text size="sm" mb="sm">
          Vas a dar de baja a <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong> ({deleteTarget?.username}).
          Esta acción es irreversible.
        </Text>
        {cooldownAlert}
        {deleteTarget?.hasPassword ? (
          <>
            <Text size="xs" c="dimmed" mb="sm">
              Esta cuenta tiene contraseña configurada. Ingresá la contraseña del usuario para confirmar la baja.
              El alumno debe estar presente.
            </Text>
            {deleteError && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="sm">{deleteError}</Alert>}
            <PasswordInput
              label="Contraseña del alumno"
              placeholder="••••••••"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleDelete(); }}
              mb="lg"
              autoFocus
            />
          </>
        ) : (
          <>
            <Text size="xs" c="dimmed" mb="sm">
              Esta cuenta no tiene contraseña configurada. Podés eliminarla directamente.
            </Text>
            {deleteError && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="sm">{deleteError}</Alert>}
            <Box mb="lg" />
          </>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={() => setDeleteModal(false)}>Cancelar</Button>
          <Button
            color="red"
            loading={deleteLoading}
            disabled={waitSeconds > 0 || lockChecking}
            onClick={() => void handleDelete()}
          >
            Dar de baja
          </Button>
        </Group>
      </Modal>
      {/* ── Modal cambiar email ── */}
      <Modal
        key={`email-${emailModalKey}`}
        opened={emailModal}
        onClose={() => setEmailModal(false)}
        title="Cambiar email"
        centered
      >
        {emailSentTo ? (
          <>
            <Alert icon={<IconCheck size={16} />} color="green" mb="md">
              Enviamos un link de confirmación a <strong>{maskEmail(emailSentTo)}</strong>.
            </Alert>
            <Text size="sm" mb="xs">
              El cambio se aplica cuando el alumno abra ese link y lo confirme. El link vence a la hora.
            </Text>
            <Text size="xs" c="dimmed" mb="lg">
              Al confirmar se cierran todas sus sesiones y tendrá que volver a iniciar sesión. Las apps pueden
              seguir mostrando el email anterior hasta 15 minutos. También avisamos al email actual.
            </Text>
            <Button fullWidth variant="default" onClick={() => setEmailModal(false)}>Cerrar</Button>
          </>
        ) : (
          <>
            <Text size="sm" mb="sm">
              Vas a cambiar el email de <strong>{emailTarget?.first_name} {emailTarget?.last_name}</strong> ({emailTarget?.username}).
              Email actual: <strong>{emailTarget ? maskEmail(emailTarget.email) : ''}</strong>.
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              Enviaremos un link de confirmación al email nuevo y un aviso al actual. El alumno debe estar presente
              para ingresar su contraseña.
            </Text>
            {cooldownAlert}
            {emailError && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="sm">{emailError}</Alert>}
            <TextInput
              label="Nuevo email"
              placeholder="nuevo@email.com"
              value={emailValue}
              onChange={e => setEmailValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleEmailChange(); }}
              mb="sm"
              autoFocus
            />
            <PasswordInput
              label="Contraseña del alumno"
              placeholder="••••••••"
              value={emailPassword}
              onChange={e => setEmailPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleEmailChange(); }}
              mb="lg"
            />
            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" onClick={() => setEmailModal(false)}>Cancelar</Button>
              <Button
                color="blue"
                loading={emailLoading}
                disabled={waitSeconds > 0 || lockChecking}
                onClick={() => void handleEmailChange()}
              >
                Enviar link de confirmación
              </Button>
            </Group>
          </>
        )}
      </Modal>

      {/* ── Modal conflicto: usuario responsable de apps ── */}
      <Modal
        opened={conflictModal}
        onClose={() => setConflictModal(false)}
        title="No se puede eliminar este usuario"
        centered
        size="sm"
      >
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          No es posible eliminar a <strong>{conflictStudentName}</strong> porque es responsable de las siguientes apps:
        </Alert>
        <Box
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: 'var(--mantine-radius-sm)',
            padding: 8,
          }}
          mb="md"
        >
          {conflictApps.map(app => (
            <Group key={app.id} gap="xs" mb={4}>
              <Badge variant="light" color="orange" size="sm">{app.id}</Badge>
              <Text size="sm">{app.clientName}</Text>
            </Group>
          ))}
        </Box>
        <Text size="xs" c="dimmed" mb="md">
          Para poder eliminar este usuario, primero debés cambiar el responsable de estas apps o eliminarlas.
        </Text>
        <Button fullWidth variant="default" onClick={() => setConflictModal(false)}>
          Entendido
        </Button>
      </Modal>
    </Box>
  );
}