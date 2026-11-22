import { useDebouncedCallback } from '@mantine/hooks';
import { includesNormalized } from '@/utils/normalizeText';
import { useEffect, useState } from 'react';
import {
  Box, Title, Text, Button, ActionIcon, Group, Modal,
  TextInput, Alert, Loader, Center, CopyButton,
  Tooltip, Code, Card, Stack, Divider,
  Select, Pagination, Badge,
} from '@mantine/core';
import {
  IconPlus, IconTrash, IconEdit, IconAlertCircle,
  IconRefresh, IconCopy, IconCheck, IconChevronDown,
  IconChevronUp, IconMail, IconSearch, IconX,
  IconPlayerPause, IconPlayerPlay,
} from '@tabler/icons-react';
import { oauthClientsApi } from '@/api/adminApi';
import { studentsApi } from '@/api/studentsApi';
import {
  OAuthClientResponse,
  OAuthClientCreatedResponse,
  CreateOAuthClientPayload,
  UpdateOAuthClientPayload,
  StudentResponse,
} from '@/types/api.types';

const PAGE_SIZE_OPTIONS = ['5', '10', '20', '50'];

// ── Componente de copia truncada ─────────────────────────────────────────────

function TruncatedCopy({ value, maxWidth = 200 }: { value: string; maxWidth?: number }) {
  return (
    <Group gap={4} wrap="nowrap">
      <Code
        style={{
          maxWidth,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
        }}
      >
        {value}
      </Code>
      <CopyButton value={value} timeout={2000}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? 'Copiado' : 'Copiar'}>
            <ActionIcon variant="subtle" size="sm" onClick={copy}>
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}

// ── Card de cliente ──────────────────────────────────────────────────────────

interface ClientCardProps {
  client: OAuthClientResponse;
  isOpen: boolean;
  onToggle: (id: number) => void;
  onEdit: (client: OAuthClientResponse) => void;
  onDelete: (id: number) => void;
  onRegenerate: (id: number) => void;
  onEmail: (client: OAuthClientResponse) => void;
  onSuspend: (id: number) => void;
  onActivate: (id: number) => void;
}

function ClientCard({
  client, isOpen, onToggle, onEdit, onDelete,
  onRegenerate, onEmail, onSuspend, onActivate,
}: ClientCardProps) {
  return (
    <Card
      withBorder
      radius="md"
      p="md"
      mb="sm"
      style={
        !client.isActive
          ? { borderColor: 'var(--mantine-color-red-6)', opacity: 0.7 }
          : undefined
      }
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <Badge variant="light" color={client.isActive ? 'orange' : 'red'} size="sm">
            {client.id}
          </Badge>
          <Text
            fw={600}
            size="sm"
            style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {client.clientName}
          </Text>
          {!client.isActive && (
            <Badge color="red" variant="filled" size="xs">Suspendido</Badge>
          )}
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Tooltip label="Enviar credenciales por email">
            <ActionIcon variant="subtle" color="blue" onClick={() => onEmail(client)}>
              <IconMail size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Editar">
            <ActionIcon variant="subtle" onClick={() => onEdit(client)}>
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Regenerar secret">
            <ActionIcon variant="subtle" color="orange" onClick={() => onRegenerate(client.id)}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          {client.isActive ? (
            <Tooltip label="Suspender app">
              <ActionIcon variant="subtle" color="yellow" onClick={() => onSuspend(client.id)}>
                <IconPlayerPause size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="Activar app">
              <ActionIcon variant="subtle" color="green" onClick={() => onActivate(client.id)}>
                <IconPlayerPlay size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Eliminar">
            <ActionIcon variant="subtle" color="red" onClick={() => onDelete(client.id)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon variant="subtle" onClick={() => onToggle(client.id)}>
            {isOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </ActionIcon>
        </Group>
      </Group>

      {isOpen && (
        <>
          <Divider my="sm" />
          <Stack gap="xs">
            <Box>
              <Text size="xs" c="dimmed" mb={4}>Redirect URIs</Text>
              {client.redirectUris.map(uri => (
                <TruncatedCopy key={uri} value={uri} maxWidth={320} />
              ))}
            </Box>
            <Text size="xs" c="dimmed">
              Creado: {new Date(client.createdAt).toLocaleDateString('es-AR')}
            </Text>
            <Text size="xs" c="dimmed">
              Estado: {client.isActive ? 'Activo' : 'Suspendido'}
            </Text>

            {client.responsibleUser && (
              <Box>
                <Text size="xs" c="dimmed" mb={2}>Responsable</Text>
                <Text size="xs">{client.responsibleUser.fullName} (@{client.responsibleUser.username})</Text>
                <Text size="xs" c="dimmed">{client.responsibleUser.censoredEmail}</Text>
              </Box>
            )}
          </Stack>
        </>
      )}
    </Card>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export function ClientsPage() {
  const [clients, setClients] = useState<OAuthClientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  // Modal crear/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OAuthClientResponse | null>(null);
  const [formName, setFormName] = useState('');
  const [formUris, setFormUris] = useState<string[]>(['']);
  const [formResponsibleUserId, setFormResponsibleUserId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Modal secret (crear o regenerar) — muestra el plainSecret una sola vez
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [secretModalData, setSecretModalData] = useState<OAuthClientCreatedResponse | null>(null);
  const [secretModalMode, setSecretModalMode] = useState<'created' | 'regenerated'>('created');

  // Envío desde modal de secret (create/regenerate)
  const [sendCredLoading, setSendCredLoading] = useState(false);
  const [sendCredError, setSendCredError] = useState<string | null>(null);
  const [sendCredSuccess, setSendCredSuccess] = useState(false);

  // Modal de envío de credenciales desde la card
  const [emailFromCardModalOpen, setEmailFromCardModalOpen] = useState(false);
  const [emailFromCardClient, setEmailFromCardClient] = useState<OAuthClientResponse | null>(null);
  const [emailFromCardLoading, setEmailFromCardLoading] = useState(false);
  const [emailFromCardError, setEmailFromCardError] = useState<string | null>(null);
  const [emailFromCardSuccess, setEmailFromCardSuccess] = useState(false);

  // Estudiantes activos para el selector
  const [activeStudents, setActiveStudents] = useState<StudentResponse[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentOption, setSelectedStudentOption] = useState<{ value: string; label: string } | null>(null);
  const searchStudents = useDebouncedCallback((text: string) => setStudentSearch(text), 300);
  // Mantine solo resalta la primera opción al escribir, y lo hace sobre la lista que ya estaba en pantalla
  // (la vieja, porque la búsqueda es en el servidor). Este "pulso" se enciende un instante cuando llegan
  // los resultados para que resalte la primera opción de la lista nueva.
  const [highlightFirstStudent, setHighlightFirstStudent] = useState(false);

  // Modal eliminar
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Modal regenerar (confirmación)
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [regenerateTargetId, setRegenerateTargetId] = useState<number | null>(null);
  const [regenerateLoading, setRegenerateLoading] = useState(false);

  // Filtros y paginación
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setClients(await oauthClientsApi.findAll());
    } catch {
      setError('Error al cargar los clientes OAuth.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // Al elegir una opción, Mantine reescribe su etiqueta en el input: eso no es una búsqueda.
  const studentQuery = studentSearch === selectedStudentOption?.label ? '' : studentSearch.trim();

  useEffect(() => {
    if (!modalOpen) return;
    let ignore = false;
    const run = async () => {
      setStudentsLoading(true);
      try {
        const result = await studentsApi.findAll({
          accountStatus: 'active',
          search: studentQuery || undefined,
          limit: 20,
        });
        if (!ignore) {
          setActiveStudents(result.data);
          setHighlightFirstStudent(true);
        }
      } catch {
        // el selector conserva la lista anterior
      } finally {
        if (!ignore) setStudentsLoading(false);
      }
    };
    void run();
    return () => { ignore = true; };
  }, [modalOpen, studentQuery]);

  useEffect(() => {
    if (highlightFirstStudent) setHighlightFirstStudent(false);
  }, [highlightFirstStudent]);

  const toggleOpen = (id: number) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetStudentSearch = () => {
    searchStudents.cancel();
    setStudentSearch('');
  };

  const studentOptions = activeStudents.map(s => ({
    value: s.id,
    label: `${s.username} — ${s.first_name} ${s.last_name}`,
  }));
  // La opción elegida debe seguir en `data` aunque la búsqueda no la devuelva.
  if (selectedStudentOption && !studentOptions.some(o => o.value === selectedStudentOption.value)) {
    studentOptions.unshift(selectedStudentOption);
  }

  const handleResponsibleChange = (value: string | null) => {
    setFormResponsibleUserId(value);
    setSelectedStudentOption(studentOptions.find(o => o.value === value) ?? null);
  };

  // ── Crear cliente ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormUris(['']);
    setFormResponsibleUserId(null);
    setSelectedStudentOption(null);
    resetStudentSearch();
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (client: OAuthClientResponse) => {
    setEditing(client);
    setFormName(client.clientName);
    setFormUris(client.redirectUris.length ? client.redirectUris : ['']);
    setFormResponsibleUserId(client.responsibleUser?.id ?? null);
    setSelectedStudentOption(
      client.responsibleUser
        ? { value: client.responsibleUser.id,
            label: `${client.responsibleUser.username} — ${client.responsibleUser.fullName}` }
        : null,
    );
    resetStudentSearch();
    setFormError(null);
    setModalOpen(true);
  };

  const handleUriChange = (index: number, value: string) => {
    setFormUris(uris => uris.map((u, i) => i === index ? value : u));
  };

  const addUri = () => {
    if (formUris.length < 5) setFormUris(u => [...u, '']);
  };

  const removeUri = (index: number) => {
    if (formUris.length > 1) setFormUris(u => u.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    const cleanUris = formUris.map(u => u.trim()).filter(Boolean);
    if (cleanUris.length === 0) {
      setFormError('Agregá al menos una redirect URI.');
      setFormLoading(false);
      return;
    }
    try {
      if (editing) {
        const payload: UpdateOAuthClientPayload = {};
        if (formName !== editing.clientName) payload.clientName = formName;
        if (JSON.stringify(cleanUris) !== JSON.stringify(editing.redirectUris)) {
          payload.redirectUris = cleanUris;
        }
        if (formResponsibleUserId !== (editing.responsibleUser?.id ?? null)) {
          payload.responsibleUserId = formResponsibleUserId ?? undefined;
        }
        await oauthClientsApi.update(editing.id, payload);
        setModalOpen(false);
        await load(true);
      } else {
        if (!formResponsibleUserId) {
          setFormError('Seleccioná un usuario responsable.');
          setFormLoading(false);
          return;
        }
        const payload: CreateOAuthClientPayload = {
          clientName: formName,
          redirectUris: cleanUris,
          responsibleUserId: formResponsibleUserId,
        };
        const created = await oauthClientsApi.create(payload);
        setModalOpen(false);
        await load(true);
        // Mostrar el secret una sola vez
        setSecretModalData(created);
        setSecretModalMode('created');
        setSendCredError(null);
        setSendCredSuccess(false);
        setSecretModalOpen(true);
      }
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setFormError(axiosError?.response?.data?.message ?? 'Error al guardar.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Eliminar cliente ───────────────────────────────────────────────────────

  const openDelete = (id: number) => {
    setDeleteTargetId(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (deleteTargetId === null) return;
    setDeleteLoading(true);
    try {
      await oauthClientsApi.remove(deleteTargetId);
      setOpenIds(prev => { const next = new Set(prev); next.delete(deleteTargetId); return next; });
      setDeleteModalOpen(false);
      await load(true);
    } catch {
      setError('Error al eliminar el cliente.');
      setDeleteModalOpen(false);
    } finally {
      setDeleteLoading(false);
      setDeleteTargetId(null);
    }
  };

  // ── Regenerar secret ───────────────────────────────────────────────────────

  const openRegenerate = (id: number) => {
    setRegenerateTargetId(id);
    setRegenerateModalOpen(true);
  };

  const handleRegenerate = async () => {
    if (regenerateTargetId === null) return;
    setRegenerateLoading(true);
    try {
      const result = await oauthClientsApi.regenerateSecret(regenerateTargetId);
      setRegenerateModalOpen(false);
      await load(true);
      // Mostrar el nuevo secret una sola vez
      setSecretModalData(result);
      setSecretModalMode('regenerated');
      setSendCredError(null);
      setSendCredSuccess(false);
      setSecretModalOpen(true);
    } catch {
      setError('Error al regenerar el secret.');
      setRegenerateModalOpen(false);
    } finally {
      setRegenerateLoading(false);
      setRegenerateTargetId(null);
    }
  };

  // ── Suspend / Activate ─────────────────────────────────────────────────────

  const handleSuspend = async (id: number) => {
    try {
      const updated = await oauthClientsApi.suspend(id);
      setClients(prev => prev.map(c => c.id === id ? updated : c));
    } catch {
      setError('Error al suspender el cliente.');
    }
  };

  const handleActivate = async (id: number) => {
    try {
      const updated = await oauthClientsApi.activate(id);
      setClients(prev => prev.map(c => c.id === id ? updated : c));
    } catch {
      setError('Error al activar el cliente.');
    }
  };

  // ── Enviar credenciales desde modal de secret ─────────────────────────────
  const handleSendCredentials = async () => {
    if (!secretModalData) return;
    setSendCredError(null);
    setSendCredLoading(true);
    try {
      await oauthClientsApi.sendCredentialsByEmail(secretModalData.id);
      setSendCredSuccess(true);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setSendCredError(axiosError?.response?.data?.message ?? 'Error al enviar el email.');
    } finally {
      setSendCredLoading(false);
    }
  };

  // ── Enviar credenciales desde card (reenvío) ──────────────────────────────
  const handleSendCredentialsFromCard = async () => {
    if (!emailFromCardClient) return;
    setEmailFromCardError(null);
    setEmailFromCardLoading(true);
    try {
      await oauthClientsApi.sendCredentialsByEmail(emailFromCardClient.id);
      setEmailFromCardSuccess(true);
      await load(true);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setEmailFromCardError(axiosError?.response?.data?.message ?? 'Error al enviar el email.');
    } finally {
      setEmailFromCardLoading(false);
    }
  };

  // ── Filtros y paginación ───────────────────────────────────────────────────

  const filtered = clients.filter(c =>
    includesNormalized(c.clientName, search) ||
    String(c.id).includes(search.trim()) ||
    c.redirectUris.some(u => includesNormalized(u, search)),
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={2} mb={4}>Clientes OAuth</Title>
          <Text c="dimmed" size="sm">Apps registradas que pueden usar el SSO.</Text>
        </Box>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={openCreate}
          style={{ background: '#f5a705', color: '#1a1200' }}
        >
          Nuevo cliente
        </Button>
      </Group>

      {error && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{error}</Alert>}

      <Group mb="md" align="flex-end" wrap="wrap" gap="sm">
        <TextInput
          placeholder="Buscar por nombre, ID o URI..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          w={320}
        />
        <Select
          data={PAGE_SIZE_OPTIONS}
          value={String(pageSize)}
          onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
          allowDeselect={false}
          w={100}
        />
      </Group>

      {loading ? (
        <Center h={200}><Loader /></Center>
      ) : (
        <>
          {paginated.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              isOpen={openIds.has(client.id)}
              onToggle={toggleOpen}
              onEdit={openEdit}
              onDelete={openDelete}
              onRegenerate={openRegenerate}
              onEmail={(c) => {
                setEmailFromCardClient(c);
                setEmailFromCardError(null);
                setEmailFromCardSuccess(false);
                setEmailFromCardModalOpen(true);
              }}
              onSuspend={handleSuspend}
              onActivate={handleActivate}
            />
          ))}
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        </>
      )}

      {/* ── Modal crear/editar ── */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar cliente OAuth' : 'Nuevo cliente OAuth'}
        centered
      >
        {formError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{formError}</Alert>
        )}
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Nombre de la app"
            placeholder="Torneito"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            mb="sm"
            required
            minLength={2}
          />
          <Text size="sm" fw={500} mb={4}>
            Redirect URIs <Text span c="dimmed" size="xs">(máximo 5)</Text>
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            Debén empezar con <Code>http://</Code> o <Code>https://</Code>. Podés incluir localhost para desarrollo.
          </Text>
          <Stack gap="xs" mb="sm">
            {formUris.map((uri, i) => (
              <Group key={i} gap="xs" wrap="nowrap">
                <TextInput
                  placeholder={i === 0 ? 'http://localhost:4000/callback' : 'https://miapp.com/callback'}
                  value={uri}
                  onChange={(e) => handleUriChange(i, e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
                {formUris.length > 1 && (
                  <ActionIcon variant="subtle" color="red" onClick={() => removeUri(i)}>
                    <IconX size={14} />
                  </ActionIcon>
                )}
              </Group>
            ))}
          </Stack>
          {formUris.length < 5 && (
            <Button
              variant="subtle"
              size="xs"
              onClick={addUri}
              mb="lg"
              leftSection={<IconPlus size={12} />}
            >
              Agregar URI
            </Button>
          )}

          <Select
            label="Usuario responsable"
            placeholder="Buscar por username o nombre..."
            data={studentOptions}
            value={formResponsibleUserId}
            onChange={handleResponsibleChange}
            onSearchChange={searchStudents}
            filter={({ options }) => options}
            selectFirstOptionOnChange={highlightFirstStudent}
            selectFirstOptionOnDropdownOpen={!formResponsibleUserId}
            nothingFoundMessage={studentsLoading ? 'Buscando...' : 'Sin resultados'}
            searchable
            clearable
            required
            mb="md"
            maxDropdownHeight={200}
            description="Debe ser un usuario activo. Recibirá las credenciales por email."
          />

          <Button
            type="submit"
            fullWidth
            loading={formLoading}
            style={{ background: '#f5a705', color: '#1a1200' }}
          >
            {editing ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </form>
      </Modal>

      {/* ── Modal eliminar ── */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Eliminar cliente OAuth"
        centered
        size="sm"
      >
        <Text size="sm" mb="lg">
          ¿Estás seguro de que querés eliminar este cliente? Esta acción es irreversible y dejará de funcionar inmediatamente.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={() => setDeleteModalOpen(false)}>
            Cancelar
          </Button>
          <Button color="red" loading={deleteLoading} onClick={() => void handleDelete()}>
            Eliminar
          </Button>
        </Group>
      </Modal>

      {/* ── Modal regenerar secret (confirmación) ── */}
      <Modal
        opened={regenerateModalOpen}
        onClose={() => setRegenerateModalOpen(false)}
        title="Regenerar client secret"
        centered
        size="sm"
      >
        <Text size="sm" mb="lg">
          El secret actual quedará <strong>invalidado inmediatamente</strong>. Todas las integraciones que lo usen van a dejar de funcionar hasta que se actualice con el nuevo secret.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={() => setRegenerateModalOpen(false)}>
            Cancelar
          </Button>
          <Button
            color="orange"
            loading={regenerateLoading}
            onClick={() => void handleRegenerate()}
          >
            Regenerar
          </Button>
        </Group>
      </Modal>

      {/* ── Modal secret (después de crear o regenerar) ── */}
      <Modal
        opened={secretModalOpen}
        onClose={() => { /* bloqueado hasta enviar */ }}
        title={secretModalMode === 'created' ? 'Cliente creado' : 'Secret regenerado'}
        centered
        size="md"
        closeOnClickOutside={false}
        closeOnEscape={false}
        withCloseButton={false}
      >
        <Alert color="orange" mb="md" radius="md">
          <Text size="sm" fw={500}>
            El Client Secret fue generado. Por seguridad, el admin no lo ve directamente, sino que
            debe enviarlo al desarrollador por email, que recibirá un link de un solo
            uso (válido por 24 horas) con sus credenciales y un instructivo de cómo usarlas.
          </Text>
        </Alert>

        {!sendCredSuccess ? (
          <>
            {sendCredError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" mb="sm" radius="md">
                {sendCredError}
              </Alert>
            )}
            {secretModalData?.responsibleUser ? (
              <Card withBorder radius="sm" p="sm" mb="md">
                <Text size="xs" c="dimmed" mb={2}>Destinatario</Text>
                <Text size="sm" fw={600}>{secretModalData.responsibleUser.fullName}</Text>
                <Text size="xs" c="dimmed">@{secretModalData.responsibleUser.username}</Text>
                <Text size="xs" c="dimmed">{secretModalData.responsibleUser.censoredEmail}</Text>
              </Card>
            ) : (
              <Alert color="yellow" mb="md" radius="md">
                Este cliente no tiene usuario responsable asignado. Asigná uno desde la lista de clientes.
              </Alert>
            )}
            <Button
              fullWidth
              leftSection={<IconMail size={14} />}
              loading={sendCredLoading}
              disabled={!secretModalData?.responsibleUser}
              onClick={() => void handleSendCredentials()}
              style={{ background: '#f5a705', color: '#1a1200' }}
            >
              Enviar credenciales por email
            </Button>
          </>
        ) : (
          <>
            <Alert icon={<IconCheck size={16} />} color="green" mb="md" radius="md">
              Credenciales enviadas a <strong>{secretModalData?.responsibleUser?.censoredEmail}</strong>.
              El destinatario recibirá un link de un solo uso válido por 24 horas.
            </Alert>
            <Button fullWidth variant="default" onClick={() => setSecretModalOpen(false)}>
              Cerrar
            </Button>
          </>
        )}
      </Modal>

      {/* ── Modal enviar credenciales desde card ── */}
      <Modal
        opened={emailFromCardModalOpen}
        onClose={() => {
          setEmailFromCardModalOpen(false);
          setEmailFromCardError(null);
          setEmailFromCardSuccess(false);
        }}
        title="Enviar credenciales"
        centered
        size="sm"
      >
        {!emailFromCardSuccess ? (
          <>
            {emailFromCardError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" mb="sm" radius="md">
                {emailFromCardError}
              </Alert>
            )}
            {emailFromCardClient?.responsibleUser ? (
              <Card withBorder radius="sm" p="sm" mb="md">
                <Text size="xs" c="dimmed" mb={2}>Usuario responsable actual</Text>
                <Text size="sm" fw={600}>{emailFromCardClient.responsibleUser.fullName}</Text>
                <Text size="xs" c="dimmed">@{emailFromCardClient.responsibleUser.username}</Text>
                <Text size="xs" c="dimmed">{emailFromCardClient.responsibleUser.censoredEmail}</Text>
              </Card>
            ) : (
              <Alert color="yellow" mb="md" radius="md">
                Este cliente no tiene usuario responsable asignado. Asigná uno desde el botón de editar.
              </Alert>
            )}
            <Button
              fullWidth
              leftSection={<IconMail size={14} />}
              loading={emailFromCardLoading}
              disabled={!emailFromCardClient?.responsibleUser}
              onClick={() => void handleSendCredentialsFromCard()}
              style={{ background: '#f5a705', color: '#1a1200' }}
            >
              Enviar credenciales al responsable
            </Button>
          </>
        ) : (
          <>
            <Alert icon={<IconCheck size={16} />} color="green" mb="md" radius="md">
              Credenciales enviadas a <strong>{emailFromCardClient?.responsibleUser?.censoredEmail}</strong>.
              El destinatario recibirá un link de un solo uso válido por 24 horas.
            </Alert>
            <Button fullWidth variant="default" onClick={() => {
              setEmailFromCardModalOpen(false);
              setEmailFromCardSuccess(false);
            }}>
              Cerrar
            </Button>
          </>
        )}
      </Modal>
    </Box>
  );
}