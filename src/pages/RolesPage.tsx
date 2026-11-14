import { useEffect, useState } from 'react';
import {
  Box, Title, Text, Button, Table, ActionIcon, Group,
  Modal, TextInput, Alert, Loader, Center, Pagination,
  Select,
} from '@mantine/core';
import { IconPlus, IconTrash, IconAlertCircle, IconSearch } from '@tabler/icons-react';
import { rolesApi } from '@/api/rolesApi';
import { DomainRoleResponse } from '@/types/api.types';

export function RolesPage() {
  const [roles, setRoles] = useState<DomainRoleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DomainRoleResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const PAGE_SIZE_OPTIONS = ['5', '10', '20', '50'];

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setRoles(await rolesApi.findAll());
    }
    catch { setError('Error al cargar los roles.'); }
    finally { if (!silent) setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); setFormLoading(true);
    try {
      await rolesApi.create({ name: formName });
      setModalOpen(false); setFormName('');
      await load(true);
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } } };
      setFormError(ax?.response?.data?.message ?? 'Error al crear el rol.');
    } finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await rolesApi.remove(deleteTarget.id);
      setDeleteModal(false); setDeleteTarget(null);
      await load(true);
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax?.response?.data?.message ?? 'Error al eliminar el rol.');
      setDeleteModal(false);
    } finally { setDeleteLoading(false); }
  };

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={2} mb={4}>Roles institucionales</Title>
          <Text c="dimmed" size="sm">Tipos de rol que se pueden asignar a los usuarios. No se puede eliminar un rol con usuarios asignados.</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />} onClick={() => { setFormName(''); setFormError(null); setModalOpen(true); }} style={{ background: '#f5a705', color: '#1a1200' }}>
          Nuevo rol
        </Button>
      </Group>

      {error && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{error}</Alert>}

      <Group mb="md" justify="space-between">
        <TextInput
          placeholder="Buscar por nombre..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          w={240}
        />
        <Select
          data={PAGE_SIZE_OPTIONS}
          value={String(pageSize)}
          onChange={v => { setPageSize(Number(v)); setPage(1); }}
          w={100}
        />
      </Group>

      {loading ? <Center h={200}><Loader /></Center> : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Creado</Table.Th>
              <Table.Th>Acciones</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paginated.map(r => (
              <Table.Tr key={r.id}>
                <Table.Td>{r.name}</Table.Td>
                <Table.Td>{new Date(r.createdAt).toLocaleDateString('es-AR')}</Table.Td>
                <Table.Td>
                  <ActionIcon variant="subtle" color="red" onClick={() => { setDeleteTarget(r); setDeleteModal(true); }}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Group justify="center" mt="md">
        <Pagination total={totalPages} value={page} onChange={setPage} />
      </Group>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo rol institucional" centered>
        {formError && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{formError}</Alert>}
        <form onSubmit={e => void handleCreate(e)}>
          <TextInput label="Nombre" placeholder="Alumno" value={formName} onChange={e => setFormName(e.target.value)} mb="lg" required minLength={2} maxLength={64} />
          <Button type="submit" fullWidth loading={formLoading} style={{ background: '#f5a705', color: '#1a1200' }}>Crear rol</Button>
        </form>
      </Modal>

      <Modal opened={deleteModal} onClose={() => setDeleteModal(false)} title="Eliminar rol" centered size="sm">
        <Text size="sm" mb="lg">¿Eliminar el rol <strong>{deleteTarget?.name}</strong>? Esta acción es irreversible y fallará si hay usuarios asignados a él.</Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={() => setDeleteModal(false)}>Cancelar</Button>
          <Button color="red" loading={deleteLoading} onClick={() => void handleDelete()}>Eliminar</Button>
        </Group>
      </Modal>
    </Box>
  );
}