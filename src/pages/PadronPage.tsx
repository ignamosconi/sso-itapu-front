import { useEffect, useState } from 'react';
import {
  Box, Title, Text, Table, Group, Badge, TextInput, Select,
  ActionIcon, Loader, Center, Alert, Pagination, Modal,
  Button, PasswordInput, Tooltip, Flex,
} from '@mantine/core';
import {
  IconSearch, IconAlertCircle, IconPlayerPause,
  IconPlayerPlay, IconTrash, IconMail,
} from '@tabler/icons-react';
import { studentsApi } from '@/api/studentsApi';
import { rolesApi } from '@/api/rolesApi';
import { specialtiesApi } from '@/api/specialtiesApi';
import { StudentResponse, DomainRoleResponse, SpecialtyResponse } from '@/types/api.types';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activo', color: 'green' },
  suspended: { label: 'Suspendido', color: 'red' },
  pending_registration: { label: 'Pendiente', color: 'yellow' },
};

export function PadronPage() {
  const [students, setStudents] = useState<StudentResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [specFilter, setSpecFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const PAGE_SIZE_OPTIONS = ['5', '10', '20', '50'];

  const [roles, setRoles] = useState<DomainRoleResponse[]>([]);
  const [specs, setSpecs] = useState<SpecialtyResponse[]>([]);

  // Modal eliminar
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentResponse | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendModal, setResendModal] = useState(false);
  const [resendTarget, setResendTarget] = useState<StudentResponse | null>(null);
  const [resendConfirmLoading, setResendConfirmLoading] = useState(false);

  const maskEmail = (email: string): string => {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  };
  const [deleteModalKey, setDeleteModalKey] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await studentsApi.findAll({
        search: search || undefined,
        accountStatus: statusFilter ?? undefined,
        domainRoleId: roleFilter ? parseInt(roleFilter, 10) : undefined,
        specialtyId: specFilter ? parseInt(specFilter, 10) : undefined,
        page,
        limit: pageSize,
      });
      setStudents(res.data);
      setTotal(res.total);
    } catch { setError('Error al cargar el padrón.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [search, statusFilter, roleFilter, specFilter, page, pageSize]);
  useEffect(() => {
    void rolesApi.findAll().then(setRoles);
    void specialtiesApi.findAll().then(setSpecs);
  }, []);

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
    try { await studentsApi.suspend(id); void load(); }
    catch (err) { const ax = err as { response?: { data?: { message?: string } } }; setError(ax?.response?.data?.message ?? 'Error.'); }
  };

  const handleActivate = async (id: string) => {
    try { await studentsApi.activate(id); void load(); }
    catch (err) { const ax = err as { response?: { data?: { message?: string } } }; setError(ax?.response?.data?.message ?? 'Error.'); }
  };

  const openDelete = (s: StudentResponse) => {
    setDeleteTarget(s); setDeletePassword(''); setDeleteError(null);
    setDeleteModalKey(k => k + 1); setDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true); setDeleteError(null);
    try {
      await studentsApi.remove(deleteTarget.id, { password: deletePassword || undefined });
      setDeleteModal(false); void load();
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } } };
      setDeleteError(ax?.response?.data?.message ?? 'Error al eliminar.');
    } finally { setDeleteLoading(false); }
  };

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
            placeholder="Buscar..."
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            w={220}
          />
          <Select
            placeholder="Estado"
            clearable
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(1); }}
            w={160}
            data={[
              { value: 'active', label: 'Activo' },
              { value: 'suspended', label: 'Suspendido' },
              { value: 'pending_registration', label: 'Pendiente' },
            ]}
          />
          <Select
            placeholder="Rol"
            clearable
            value={roleFilter}
            onChange={v => { setRoleFilter(v); setPage(1); }}
            w={160}
            data={roles.map(r => ({ value: String(r.id), label: r.name }))}
          />
          <Select
            placeholder="Especialidad"
            clearable
            value={specFilter}
            onChange={v => { setSpecFilter(v); setPage(1); }}
            w={160}
            data={specs.map(s => ({ value: String(s.id), label: s.name }))}
          />
        </Group>

        <Select
          data={PAGE_SIZE_OPTIONS}
          value={String(pageSize)}
          onChange={v => { setPageSize(Number(v)); setPage(1); }}
          w={100}
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
                  <Table.Th>Rol</Table.Th>
                  <Table.Th>Especialidad</Table.Th>
                  <Table.Th miw={115}>Estado</Table.Th>
                  <Table.Th>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {students.map(s => {
                  const st = STATUS_LABELS[s.account_status] ?? { label: s.account_status, color: 'gray' };
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
                              <ActionIcon variant="subtle" color="orange" onClick={() => void handleSuspend(s.id)}>
                                <IconPlayerPause size={15} />
                              </ActionIcon>
                            </Tooltip>
                          ) : (
                            <Tooltip label="Reactivar">
                              <ActionIcon variant="subtle" color="green" onClick={() => void handleActivate(s.id)}>
                                <IconPlayerPlay size={15} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          {s.account_status === 'pending_registration' && (
                            <Tooltip label="Reenviar email de bienvenida">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                loading={resendingId === s.id}
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
                        </Flex>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
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
        {deleteTarget?.account_status !== 'pending_registration' ? (
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
              Esta cuenta es un registro pendiente (sin contraseña). Podés eliminarla directamente.
            </Text>
            {deleteError && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="sm">{deleteError}</Alert>}
            <Box mb="lg" />
          </>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={() => setDeleteModal(false)}>Cancelar</Button>
          <Button color="red" loading={deleteLoading} onClick={() => void handleDelete()}>Dar de baja</Button>
        </Group>
      </Modal>
    </Box>
  );
}