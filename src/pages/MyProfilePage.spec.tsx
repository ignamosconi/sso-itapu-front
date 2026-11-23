import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { MyProfilePage } from './MyProfilePage';
import { adminsApi } from '@/api/adminApi';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/api/adminApi', () => ({
  adminsApi: {
    updateSelf: vi.fn(),
    removeSelf: vi.fn(),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

function renderMyProfile() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <MyProfilePage />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('MyProfilePage', () => {
  const mockReset2fa = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      adminUsername: 'admin.itapu',
      accessToken: 'token-123',
      isAuthenticated: true,
    });
    vi.mocked(useAuth).mockReturnValue({
      reset2fa: mockReset2fa,
      logout: mockLogout,
      loginStep1: vi.fn(),
      loginStep2: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('debería validar que el nuevo nombre de usuario sea distinto al actual', async () => {
    renderMyProfile();

    const usernameInput = screen.getByLabelText(/Nuevo nombre de usuario/i);
    const form = usernameInput.closest('form')!;
    const passInput = within(form).getByLabelText(/^Contraseña actual/i);

    fireEvent.change(usernameInput, { target: { value: 'admin.itapu' } });
    fireEvent.change(passInput, { target: { value: 'Password123!' } });
    fireEvent.submit(form);

    expect(await screen.findByText(/El nuevo nombre de usuario es igual al actual/i)).toBeInTheDocument();
    expect(adminsApi.updateSelf).not.toHaveBeenCalled();
  });

  it('debería actualizar el nombre de usuario y reflejarlo en el store', async () => {
    vi.mocked(adminsApi.updateSelf).mockResolvedValueOnce({
      id: 'adm-1',
      username: 'admin.nuevo',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    });

    renderMyProfile();

    const usernameInput = screen.getByLabelText(/Nuevo nombre de usuario/i);
    const form = usernameInput.closest('form')!;
    const passInput = within(form).getByLabelText(/^Contraseña actual/i);

    fireEvent.change(usernameInput, { target: { value: 'admin.nuevo' } });
    fireEvent.change(passInput, { target: { value: 'Password123!' } });
    fireEvent.submit(form);

    expect(await screen.findByText(/Nombre de usuario actualizado correctamente/i)).toBeInTheDocument();
    expect(adminsApi.updateSelf).toHaveBeenCalledWith({
      username: 'admin.nuevo',
      currentPassword: 'Password123!',
    });
    expect(useAuthStore.getState().adminUsername).toBe('admin.nuevo');
  });

  it('debería cambiar de modo a Contraseña, validar coincidencia y enviar el cambio', async () => {
    vi.mocked(adminsApi.updateSelf).mockResolvedValueOnce({
      id: 'adm-1',
      username: 'admin.itapu',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    });

    renderMyProfile();

    fireEvent.click(screen.getByText('Contraseña'));

    const newPassInput = await screen.findByLabelText(/^Nueva contraseña/i);
    const form = newPassInput.closest('form')!;
    const currentPassInput = within(form).getByLabelText(/^Contraseña actual/i);
    const confirmPassInput = within(form).getByLabelText(/^Confirmar nueva contraseña/i);

    // Error por falta de coincidencia
    fireEvent.change(currentPassInput, { target: { value: 'OldPass123!' } });
    fireEvent.change(newPassInput, { target: { value: 'NewPass123!' } });
    fireEvent.change(confirmPassInput, { target: { value: 'OtraPass123!' } });
    fireEvent.submit(form);

    expect(await screen.findByText(/La nueva contraseña y su confirmación no coinciden/i)).toBeInTheDocument();

    // Error por contraseña igual a la actual
    fireEvent.change(newPassInput, { target: { value: 'OldPass123!' } });
    fireEvent.change(confirmPassInput, { target: { value: 'OldPass123!' } });
    fireEvent.submit(form);

    expect(await screen.findByText(/La nueva contraseña debe ser distinta a la actual/i)).toBeInTheDocument();

    // Envío válido
    fireEvent.change(newPassInput, { target: { value: 'NewPass123!' } });
    fireEvent.change(confirmPassInput, { target: { value: 'NewPass123!' } });
    fireEvent.submit(form);

    expect(await screen.findByText(/Contraseña actualizada correctamente/i)).toBeInTheDocument();
    expect(adminsApi.updateSelf).toHaveBeenCalledWith({
      password: 'NewPass123!',
      currentPassword: 'OldPass123!',
    });
  });

  it('debería resetear el autenticador 2FA y manejar errores de contraseña incorrecta', async () => {
    mockReset2fa
      .mockRejectedValueOnce({ response: { data: { message: 'Contraseña incorrecta.' } } })
      .mockResolvedValueOnce(undefined);

    renderMyProfile();

    fireEvent.click(screen.getByRole('tab', { name: /2FA/i }));

    const passInput = await screen.findByLabelText(/Confirmá tu contraseña actual/i);
    const form = passInput.closest('form')!;

    fireEvent.change(passInput, { target: { value: 'ClaveErronea' } });
    fireEvent.submit(form);

    expect(await screen.findByText('Contraseña incorrecta.')).toBeInTheDocument();

    fireEvent.change(passInput, { target: { value: 'Password123!' } });
    fireEvent.submit(form);

    expect(
      await screen.findByText(/Autenticador reseteado\. El próximo login te pedirá configurarlo de nuevo/i),
    ).toBeInTheDocument();
    expect(mockReset2fa).toHaveBeenCalledWith('Password123!');
  });

  it('debería eliminar la cuenta propia, cerrar sesión y redirigir a /login', async () => {
    vi.mocked(adminsApi.removeSelf)
      .mockRejectedValueOnce({ response: { data: { message: ['No podés eliminar el único administrador.'] } } })
      .mockResolvedValueOnce(undefined);
    mockLogout.mockResolvedValueOnce(undefined);

    renderMyProfile();

    fireEvent.click(screen.getByRole('tab', { name: /Eliminar cuenta/i }));

    const phraseInput = await screen.findByLabelText(/Frase de confirmación/i);
    const form = phraseInput.closest('form')!;
    const passInput = within(form).getByLabelText(/^Contraseña actual/i);

    fireEvent.change(phraseInput, { target: { value: 'borrar-mi-cuenta-no-es-reversible' } });
    fireEvent.change(passInput, { target: { value: 'Password123!' } });
    fireEvent.submit(form);

    expect(await screen.findByText('No podés eliminar el único administrador.')).toBeInTheDocument();

    // Segundo intento exitoso
    fireEvent.submit(form);

    await waitFor(() => {
      expect(adminsApi.removeSelf).toHaveBeenCalledWith({
        password: 'Password123!',
        confirmationPhrase: 'borrar-mi-cuenta-no-es-reversible',
      });
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});