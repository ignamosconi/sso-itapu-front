import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { SetPasswordPage } from './SetPasswordPage';
import { apiClient } from '@/api/client';

vi.mock('@/api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

function renderWithToken(query = '') {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[`/set-password${query}`]}>
        <Routes>
          <Route path="/set-password" element={<SetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('SetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería mostrar alerta si no viene token en la URL', () => {
    renderWithToken('');
    expect(screen.getByText(/El link no es válido\. Verificá que lo hayas copiado correctamente\./i)).toBeInTheDocument();
  });

  it('debería mostrar error específico si la cuenta está suspendida al validar token', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      response: { data: { message: 'La cuenta se encuentra suspendida' } },
    });

    renderWithToken('?token=tok123');

    await waitFor(() => {
      expect(screen.getByText(/No podés registrar una contraseña: la cuenta está suspendida/i)).toBeInTheDocument();
    });
  });

  it('debería mostrar error específico si el usuario no fue encontrado', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      response: { data: { message: ['Usuario no encontrado'] } },
    });

    renderWithToken('?token=tok123');

    await waitFor(() => {
      expect(screen.getByText(/Tu cuenta ya no está registrada/i)).toBeInTheDocument();
    });
  });

  it('debería validar que las contraseñas coincidan antes de enviar', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({});
    renderWithToken('?token=tok123');

    await waitFor(() => {
      expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i), { target: { value: 'otra12345' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar contraseña/i }));

    expect(screen.getByText(/Las contraseñas no coinciden\./i)).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('debería establecer la contraseña correctamente cuando los datos son válidos', async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({}) // validate-reset-token
      .mockResolvedValueOnce({}); // set-password

    renderWithToken('?token=tok123');

    await waitFor(() => {
      expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), { target: { value: 'nuevaPass123' } });
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i), { target: { value: 'nuevaPass123' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar contraseña/i }));

    await waitFor(() => {
      expect(screen.getByText(/¡Contraseña establecida! Ya podés cerrar esta página\./i)).toBeInTheDocument();
    });

    expect(apiClient.post).toHaveBeenLastCalledWith('/sso/set-password', {
      token: 'tok123',
      password: 'nuevaPass123',
      confirmPassword: 'nuevaPass123',
    });
  });

  it('debería mostrar fatalError si falla el envío en /sso/set-password', async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ response: { data: { message: 'Token expirado' } } });

    renderWithToken('?token=tok123');

    await waitFor(() => {
      expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), { target: { value: 'nuevaPass123' } });
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i), { target: { value: 'nuevaPass123' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar contraseña/i }));

    await waitFor(() => {
      expect(screen.getByText(/Token expirado/i)).toBeInTheDocument();
    });
  });
});