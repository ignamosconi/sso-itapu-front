import { useEffect, useState } from 'react';
import {
  Box, Title, Text, Button, Table, Group, 
  TextInput, PasswordInput, Alert, Loader, 
  Center, Select, Pagination, Modal
} from '@mantine/core';
import {
  IconPlus, IconAlertCircle, IconSearch,
} from '@tabler/icons-react';
import { adminsApi } from '@/api/adminApi';
import { AdminResponse, CreateAdminPayload } from '@/types/api.types';
import { useAuthStore } from '@/store/authStore';

const PAGE_SIZE_OPTIONS = ['5', '10', '20', '50'];

export function AdminsPage() {
  useAuthStore();
  const [admins, setAdmins] = useState<AdminResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal crear
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formUsernameError, setFormUsernameError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Filtros y paginación
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    try {
      setLoading(true);
      setAdmins(await adminsApi.findAll());
    } catch {
      setError('Error al cargar los administradores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // ── Crear admin ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setFormUsername('');
    setFormPassword('');
    setFormError(null);
    setFormUsernameError(null);
    setCreateModalOpen(true);
  };

  const USERNAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ0-9._-]*$/;

  const validateUsername = (value: string): string | null => {
    if (value.includes(' ')) return 'El usuario no puede contener espacios.';
    if (!USERNAME_REGEX.test(value))
      return 'Solo se permiten letras (con tildes), números, puntos (.), guiones bajos (_) y guiones medios (-).';
    if (value.length > 0 && value.length < 3) return 'El usuario debe tener al menos 3 caracteres.';
    if (value.length > 32) return 'El usuario no puede superar los 32 caracteres.';
    return null;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const usernameValidationError = validateUsername(formUsername);
    if (usernameValidationError) {
      setFormUsernameError(usernameValidationError);
      setFormLoading(false);
      return;
    }
    setFormLoading(true);
    try {
      const payload: CreateAdminPayload = { username: formUsername, password: formPassword };
      await adminsApi.create(payload);
      setCreateModalOpen(false);
      void load();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setFormError(axiosError?.response?.data?.message ?? 'Error al crear el administrador.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Filtros y paginación ───────────────────────────────────────────────────

  const filtered = admins.filter(a =>
    a.username.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={2} mb={4}>Administradores</Title>
          <Text c="dimmed" size="sm">
            Gestioná los usuarios con acceso al panel. Solo podés eliminar admins que no seas vos.
          </Text>
        </Box>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={openCreate}
          style={{ background: '#f5a705', color: '#1a1200' }}
        >
          Nuevo admin
        </Button>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{error}</Alert>
      )}

      <Group mb="md" justify="space-between">
        <TextInput
          placeholder="Buscar por usuario..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          w={260}
        />
        <Select
          data={PAGE_SIZE_OPTIONS}
          value={String(pageSize)}
          onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
          w={100}
        />
      </Group>

      {loading ? (
        <Center h={200}><Loader /></Center>
      ) : (
        <>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Usuario</Table.Th>
                <Table.Th>Creado</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginated.map((admin) => (
                <Table.Tr key={admin.id}>
                  <Table.Td>{admin.username}</Table.Td>
                  <Table.Td>{new Date(admin.createdAt).toLocaleDateString('es-AR')}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        </>
      )}

      {/* ── Modal crear admin ── */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Nuevo administrador"
        centered
      >
        {formError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{formError}</Alert>
        )}
        <form onSubmit={(e) => void handleCreate(e)}>
        <TextInput
          label="Usuario"
          placeholder="nuevo_admin"
          value={formUsername}
          onChange={(e) => {
            const val = e.target.value;
            setFormUsername(val);
            setFormUsernameError(val.length > 0 ? validateUsername(val) : null);
          }}
          error={formUsernameError}
          mb="sm"
          required
          minLength={3}
          maxLength={32}
        />
          <PasswordInput
            label="Contraseña"
            placeholder="••••••••"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            mb="lg"
            required
            minLength={8}
          />
          <Button
            type="submit"
            fullWidth
            loading={formLoading}
            style={{ background: '#f5a705', color: '#1a1200' }}
          >
            Crear administrador
          </Button>
        </form>
      </Modal>

    </Box>
  );
}