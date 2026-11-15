import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { LoginPage } from './LoginPage';
import { useAuthStore } from '@/store/authStore';

const mockLoginStep1 = vi.fn();
const mockSetup2fa = vi.fn();
const mockConfirm2fa = vi.fn();
const mockValidate2fa = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    loginStep1: mockLoginStep1,
    setup2fa: mockSetup2fa,
    confirm2fa: mockConfirm2fa,
    validate2fa: mockValidate2fa,
  }),
}));

function renderLogin() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard Mock</div>} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: false,
      pendingToken: null,
      accessToken: null,
      refreshToken: null,
    });
  });

  it('debería redirigir a /dashboard si ya está autenticado', () => {
    useAuthStore.setState({ isAuthenticated: true });
    renderLogin();
    expect(screen.getByText('Dashboard Mock')).toBeInTheDocument();
  });

  it('debería validar longitud mínima de usuario y contraseña en paso 1', async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText(/Usuario/i), { target: { value: 'ab' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    expect(await screen.findByText(/El usuario debe tener al menos 3 caracteres\./i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Usuario/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    expect(await screen.findByText(/La contraseña debe tener al menos 8 caracteres\./i)).toBeInTheDocument();
    expect(mockLoginStep1).not.toHaveBeenCalled();
  });

  it('debería mostrar error si fallan las credenciales en paso 1', async () => {
    mockLoginStep1.mockRejectedValueOnce(new Error('Unauthorized'));
    renderLogin();

    fireEvent.change(screen.getByLabelText(/Usuario/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    expect(await screen.findByText(/Credenciales inválidas\. Verificá tu usuario y contraseña\./i)).toBeInTheDocument();
  });

  it('debería avanzar a setup_2fa cuando requires_2fa_setup es true y permitir confirmar', async () => {
    mockLoginStep1.mockResolvedValueOnce({ pending_token: 'pt-1', requires_2fa_setup: true });
    mockSetup2fa.mockResolvedValueOnce({
      qrCodeDataUrl: 'data:image/png;base64,fake',
      manualEntrySecret: 'JBSWY3DPEHPK3PXP',
      confirm_pending_token: 'cpt-1',
    });
    mockConfirm2fa.mockResolvedValueOnce(undefined);

    const { container } = renderLogin();

    fireEvent.change(screen.getByLabelText(/Usuario/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    expect(await screen.findByText(/Configurar autenticador/i)).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();

    const pinInputs = container.querySelectorAll('input');
    '123456'.split('').forEach((digit, idx) => {
      fireEvent.change(pinInputs[idx], { target: { value: digit } });
    });

    const submitBtn = screen.getByRole('button', { name: /Activar autenticador e ingresar/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockConfirm2fa).toHaveBeenCalledWith('cpt-1', '123456');
    });
  });

  it('debería avanzar a validate_2fa cuando requires_2fa_setup es false y volver atrás en error fatal', async () => {
    mockLoginStep1.mockImplementationOnce(async () => {
      useAuthStore.setState({ pendingToken: 'pt-validate' });
      return { pending_token: 'pt-validate', requires_2fa_setup: false };
    });
    mockValidate2fa
      .mockRejectedValueOnce({ response: { data: { message: 'Código inválido' } } })
      .mockRejectedValueOnce({ response: { data: { message: 'Demasiados intentos fallidos' } } });

    const { container } = renderLogin();

    fireEvent.change(screen.getByLabelText(/Usuario/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    expect(await screen.findByText(/Verificación en dos pasos/i)).toBeInTheDocument();

    // Primer intento fallido (recuperable)
    let pinInputs = container.querySelectorAll('input');
    '111111'.split('').forEach((digit, idx) => {
      fireEvent.change(pinInputs[idx], { target: { value: digit } });
    });
    fireEvent.click(screen.getByRole('button', { name: /Verificar e ingresar/i }));

    await waitFor(() => {
      expect(mockValidate2fa).toHaveBeenCalledWith('pt-validate', '111111');
    });

    // Segundo intento fallido (error fatal -> regresa a credenciales)
    pinInputs = container.querySelectorAll('input');
    '222222'.split('').forEach((digit, idx) => {
      fireEvent.change(pinInputs[idx], { target: { value: digit } });
    });
    fireEvent.click(screen.getByRole('button', { name: /Verificar e ingresar/i }));

    expect(await screen.findByText(/Iniciar sesión/i)).toBeInTheDocument();
    expect(await screen.findByText(/Demasiados intentos fallidos/i)).toBeInTheDocument();
  });
});