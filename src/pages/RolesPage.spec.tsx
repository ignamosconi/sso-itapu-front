import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { RolesPage } from './RolesPage';
import { rolesApi } from '@/api/rolesApi';

vi.mock('@/api/rolesApi', () => ({
  rolesApi: {
    findAll: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

function renderRoles() {
  return render(
    <MantineProvider>
      <RolesPage />
    </MantineProvider>,
  );
}

describe('RolesPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('debería listar roles institucionales y filtrar por nombre', async () => {
    vi.mocked(rolesApi.findAll).mockResolvedValueOnce([
      { id: 1, name: 'Alumno', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'Docente', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
    ]);

    renderRoles();

    expect(await screen.findByText('Alumno')).toBeInTheDocument();
    expect(screen.getByText('Docente')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/i), {
      target: { value: 'Doc' },
    });

    expect(screen.queryByText('Alumno')).not.toBeInTheDocument();
    expect(screen.getByText('Docente')).toBeInTheDocument();
  });

  it('debería filtrar ignorando tildes y mayúsculas, en ambos sentidos', async () => {
    vi.mocked(rolesApi.findAll).mockResolvedValueOnce([
      { id: 1, name: 'Jefe de Área', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'Docente', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
    ]);

    renderRoles();
    await screen.findByText('Jefe de Área');
    const input = screen.getByPlaceholderText(/Buscar por nombre/i);

    // Sin tilde encuentra el nombre que la tiene
    fireEvent.change(input, { target: { value: 'area' } });
    expect(screen.getByText('Jefe de Área')).toBeInTheDocument();
    expect(screen.queryByText('Docente')).not.toBeInTheDocument();

    // Con tilde encuentra el nombre que no la tiene
    fireEvent.change(input, { target: { value: 'DÓCENTE' } });
    expect(screen.getByText('Docente')).toBeInTheDocument();
    expect(screen.queryByText('Jefe de Área')).not.toBeInTheDocument();
  });

  it('debería crear un nuevo cargo desde el modal', async () => {
    vi.mocked(rolesApi.findAll)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 3, name: 'Nodocente', createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' },
      ]);
    vi.mocked(rolesApi.create).mockResolvedValueOnce({
      id: 3,
      name: 'Nodocente',
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    });

    renderRoles();

    fireEvent.click(await screen.findByRole('button', { name: /Nuevo cargo/i }));
    const nameInput = await screen.findByLabelText(/Nombre/i);
    fireEvent.change(nameInput, { target: { value: 'Nodocente' } });
    fireEvent.submit(nameInput.closest('form')!);

    await waitFor(
      () => {
        expect(rolesApi.create).toHaveBeenCalledWith({ name: 'Nodocente' });
        expect(screen.getByText('Nodocente')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('debería eliminar un cargo y manejar error si tiene usuarios asignados', async () => {
    vi.mocked(rolesApi.findAll)
      .mockResolvedValueOnce([
        { id: 1, name: 'Temporal', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
        { id: 2, name: 'Alumno', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      ])
      .mockResolvedValueOnce([
        { id: 2, name: 'Alumno', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      ]);
    vi.mocked(rolesApi.remove)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ response: { data: { message: 'No se puede eliminar: hay usuarios asociados' } } });

    const { container } = renderRoles();
    await screen.findByText('Temporal');

    // Eliminar primer cargo exitosamente
    const trashButtons = container.querySelectorAll('tbody button');
    fireEvent.click(trashButtons[0]);

    const confirmDelete = await screen.findByRole('button', { name: /^Eliminar$/i });
    fireEvent.click(confirmDelete);

    await waitFor(
      () => {
        expect(rolesApi.remove).toHaveBeenCalledWith(1);
        expect(screen.queryByText('Temporal')).not.toBeInTheDocument();
        expect(screen.queryByText(/¿Eliminar el cargo/i)).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Intentar eliminar segundo cargo con error del backend
    const remainingTrash = container.querySelectorAll('tbody button');
    fireEvent.click(remainingTrash[0]);
    fireEvent.click(await screen.findByRole('button', { name: /^Eliminar$/i }));

    expect(await screen.findByText(/No se puede eliminar: hay usuarios asociados/i)).toBeInTheDocument();
  });
});