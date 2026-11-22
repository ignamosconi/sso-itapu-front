import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { AdminsPage } from './AdminsPage';
import { adminsApi } from '@/api/adminApi';

vi.mock('@/api/adminApi', () => ({
  adminsApi: {
    findAll: vi.fn(),
    create: vi.fn(),
  },
}));

function renderAdmins() {
  return render(
    <MantineProvider>
      <AdminsPage />
    </MantineProvider>,
  );
}

describe('AdminsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('debería listar administradores y permitir filtrar por nombre de usuario', async () => {
    vi.mocked(adminsApi.findAll).mockResolvedValueOnce([
      { id: '1', username: 'admin_principal', createdAt: '2026-01-10T00:00:00Z', updatedAt: '' },
      { id: '2', username: 'soporte_utn', createdAt: '2026-02-15T00:00:00Z', updatedAt: '' },
    ]);

    renderAdmins();

    expect(await screen.findByText('admin_principal')).toBeInTheDocument();
    expect(screen.getByText('soporte_utn')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por usuario/i), {
      target: { value: 'soporte' },
    });

    expect(screen.queryByText('admin_principal')).not.toBeInTheDocument();
    expect(screen.getByText('soporte_utn')).toBeInTheDocument();
  });

  it('debería filtrar por usuario ignorando tildes y mayúsculas', async () => {
    vi.mocked(adminsApi.findAll).mockResolvedValueOnce([
      { id: '1', username: 'josé.perez', createdAt: '2026-01-10T00:00:00Z', updatedAt: '' },
      { id: '2', username: 'soporte_utn', createdAt: '2026-02-15T00:00:00Z', updatedAt: '' },
    ]);

    renderAdmins();
    await screen.findByText('josé.perez');

    fireEvent.change(screen.getByPlaceholderText(/Buscar por usuario/i), { target: { value: 'JOSE' } });

    expect(screen.getByText('josé.perez')).toBeInTheDocument();
    expect(screen.queryByText('soporte_utn')).not.toBeInTheDocument();
  });

  it('debería mostrar alerta si falla la carga inicial', async () => {
    vi.mocked(adminsApi.findAll).mockRejectedValueOnce(new Error('Network error'));
    renderAdmins();

    expect(await screen.findByText(/Error al cargar los administradores\./i)).toBeInTheDocument();
  });

  it('debería validar formato de usuario y crear un nuevo administrador', async () => {
    vi.mocked(adminsApi.findAll)
      .mockResolvedValueOnce([{ id: '1', username: 'admin_principal', createdAt: '2026-01-10T00:00:00Z', updatedAt: '' }])
      .mockResolvedValueOnce([
        { id: '1', username: 'admin_principal', createdAt: '2026-01-10T00:00:00Z', updatedAt: '' },
        { id: '2', username: 'nuevo.admin', createdAt: '2026-03-01T00:00:00Z', updatedAt: '' },
      ]);
    vi.mocked(adminsApi.create).mockResolvedValueOnce({
      id: '2',
      username: 'nuevo.admin',
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '',
    });

    renderAdmins();
    await screen.findByText('admin_principal');

    fireEvent.click(screen.getByRole('button', { name: /Nuevo admin/i }));

    const userInput = await screen.findByLabelText(/Usuario/i);
    const passInput = screen.getByLabelText(/Contraseña/i);

    // Usuario con espacios -> muestra error de validación y bloquea envío
    fireEvent.change(userInput, { target: { value: 'admin con espacio' } });
    expect(await screen.findByText(/El usuario no puede contener espacios\./i)).toBeInTheDocument();

    fireEvent.change(passInput, { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear administrador/i }));
    expect(adminsApi.create).not.toHaveBeenCalled();

    // Usuario válido -> envía y recarga lista
    fireEvent.change(userInput, { target: { value: 'nuevo.admin' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear administrador/i }));

    await waitFor(() => {
      expect(adminsApi.create).toHaveBeenCalledWith({
        username: 'nuevo.admin',
        password: 'password123',
      });
      expect(screen.getByText('nuevo.admin')).toBeInTheDocument();
    });
  });

  it('debería mostrar error del servidor dentro del modal si falla create', async () => {
    vi.mocked(adminsApi.findAll).mockResolvedValueOnce([]);
    vi.mocked(adminsApi.create).mockRejectedValueOnce({
      response: { data: { message: 'El nombre de usuario ya existe' } },
    });

    renderAdmins();
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo admin/i }));

    fireEvent.change(await screen.findByLabelText(/Usuario/i), { target: { value: 'duplicado' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear administrador/i }));

    expect(await screen.findByText(/El nombre de usuario ya existe/i)).toBeInTheDocument();
  });
});