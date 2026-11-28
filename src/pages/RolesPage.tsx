import { useEffect, useState } from 'react';
import { getErrorMessage } from '@/utils/apiError';
import { includesNormalized } from '@/utils/normalizeText';
import {
  Box, Title, Text, Button, Table, ActionIcon, Group,
  Modal, TextInput, Alert, Loader, Center, Pagination,
  Select, Checkbox, Stack, Badge,
} from '@mantine/core';
import { IconPlus, IconTrash, IconAlertCircle, IconSearch, IconLock } from '@tabler/icons-react';
import { rolesApi } from '@/api/rolesApi';
import { DomainRoleResponse } from '@/types/api.types';

export function RolesPage() {
  const [roles, setRoles] = useState<DomainRoleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formExclusive, setFormExclusive] = useState(false);
  const [formSingleSpecialty, setFormSingleSpecialty] = useState(false);
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
    catch { setError('Error al cargar los cargos.'); }
    finally { if (!silent) setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = roles.filter(r => includesNormalized(r.name, search));
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); setFormLoading(true);
    try {
      await rolesApi.create({ name: formName, exclusive: formExclusive, single_specialty: formSingleSpecialty });
      setModalOpen(false); setFormName(''); setFormExclusive(false); setFormSingleSpecialty(false);
      await load(true);
    } catch (err) {
      setFormError(getErrorMessage(err, 'Error al crear el cargo.'));
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
      setError(getErrorMessage(err, 'Error al eliminar el cargo.'));
      setDeleteModal(false);
    } finally { setDeleteLoading(false); }
  };

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={2} mb={4}>Cargos institucionales</Title>
          <Text c="dimmed" size="sm">
            Cargos que se pueden asignar a los usuarios. Un usuario puede tener varios cargos, salvo que alguno no se combine.
            Las reglas de cada cargo se definen al crearlo y no se pueden cambiar. No se puede eliminar un cargo con usuarios asignados.
          </Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />} onClick={() => { setFormName(''); setFormExclusive(false); setFormSingleSpecialty(false); setFormError(null); setModalOpen(true); }}>
          Nuevo cargo inst.
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
          allowDeselect={false}
          w={100}
        />
      </Group>

      {loading ? <Center h={200}><Loader /></Center> : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>¿Se combina con otros cargos?</Table.Th>
              <Table.Th>Especialidades</Table.Th>
              <Table.Th>Creado</Table.Th>
              <Table.Th>Acciones</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paginated.map(r => (
              <Table.Tr key={r.id}>
                <Table.Td>{r.name}</Table.Td>
                <Table.Td>
                  {r.exclusive
                    ? <Badge color="red" variant="light" size="sm">No: debe ser el único cargo</Badge>
                    : <Badge color="green" variant="light" size="sm">Sí</Badge>}
                </Table.Td>
                <Table.Td>
                  {r.singleSpecialty
                    ? <Badge color="orange" variant="light" size="sm">Exactamente una</Badge>
                    : <Badge color="gray" variant="light" size="sm">Una o más</Badge>}
                </Table.Td>
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

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo cargo institucional" centered>
        {formError && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{formError}</Alert>}
        <form onSubmit={e => void handleCreate(e)}>
          <TextInput label="Nombre" placeholder="Alumno" value={formName} onChange={e => setFormName(e.target.value)} mb="md" required minLength={2} maxLength={64} />
          <Stack gap="sm" mb="md">
            <Checkbox
              label="No se combina con otros cargos"
              description="Quien tenga este cargo no puede tener ningún otro (por ejemplo, Alumno)."
              checked={formExclusive}
              onChange={e => setFormExclusive(e.currentTarget.checked)}
            />
            <Checkbox
              label="Exactamente una especialidad"
              description="Quien tenga este cargo, aunque tenga otros, debe tener una sola especialidad."
              checked={formSingleSpecialty}
              onChange={e => setFormSingleSpecialty(e.currentTarget.checked)}
            />
          </Stack>
          <Alert icon={<IconLock size={16} />} color="yellow" variant="light" mb="lg">
            Estas reglas <strong>no se pueden cambiar después</strong>. Para cambiarlas habría que eliminar el cargo,
            y eso solo es posible si ningún usuario lo tiene asignado.
          </Alert>
          <Button type="submit" fullWidth loading={formLoading}>Crear cargo</Button>
        </form>
      </Modal>

      <Modal opened={deleteModal} onClose={() => setDeleteModal(false)} title="Eliminar cargo" centered size="sm">
        <Text size="sm" mb="lg">¿Eliminar el cargo <strong>{deleteTarget?.name}</strong>? Esta acción es irreversible y fallará si hay usuarios asignados a él.</Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={() => setDeleteModal(false)}>Cancelar</Button>
          <Button color="red" loading={deleteLoading} onClick={() => void handleDelete()}>Eliminar</Button>
        </Group>
      </Modal>
    </Box>
  );
}