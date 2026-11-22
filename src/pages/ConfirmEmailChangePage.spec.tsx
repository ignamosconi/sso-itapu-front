import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ConfirmEmailChangePage } from './ConfirmEmailChangePage';
import { apiClient } from '@/api/client';

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn() },
}));

function Search() {
  return <span data-testid="search">{useLocation().search}</span>;
}

function renderPage(url = '/confirm-email?token=abc123') {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/confirm-email" element={<><ConfirmEmailChangePage /><Search /></>} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

const apiError = (status: number, message?: string | string[]) => ({
  response: { status, data: message === undefined ? {} : { message } },
});

describe('ConfirmEmailChangePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no debería confirmar nada al abrir la página (solo con el clic del alumno)', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /Confirmar cambio de email/i })).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('debería sacar el token de la URL pero seguir pudiendo confirmar con él', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});
    renderPage();

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));

    fireEvent.click(screen.getByRole('button', { name: /Confirmar cambio de email/i }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/sso/confirm-email-change', { token: 'abc123' }),
    );
  });

  it('debería avisar que el email se actualizó y que se cerraron las sesiones', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Confirmar cambio de email/i }));

    expect(await screen.findByText(/tu email fue actualizado/i)).toBeInTheDocument();
    expect(screen.getByText(/cerramos todas tus sesiones/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar cambio de email/i })).not.toBeInTheDocument();
  });

  it('debería mostrar que el link no es válido si no hay token', () => {
    renderPage('/confirm-email');

    expect(screen.getByText(/El link no es válido/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar cambio de email/i })).not.toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it.each([
    [410, 'Este link ya fue utilizado.'],
    [410, 'Este link ha expirado.'],
    [404, 'El link no es válido.'],
    [409, 'Ese email ya fue registrado por otro usuario.'],
    [400, 'La cuenta no está activa. Contactá a un administrador.'],
  ])('debería mostrar el mensaje del servidor y sacar el botón si el link no sirve más (%i: %s)', async (status, message) => {
    vi.mocked(apiClient.post).mockRejectedValue(apiError(status, message));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Confirmar cambio de email/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('button', { name: /Confirmar cambio de email/i })).not.toBeInTheDocument();
  });

  it('debería permitir reintentar si hay demasiados intentos (429)', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(apiError(429)).mockResolvedValueOnce({});
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Confirmar cambio de email/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/demasiados intentos/i);

    fireEvent.click(screen.getByRole('button', { name: /Confirmar cambio de email/i }));
    expect(await screen.findByText(/tu email fue actualizado/i)).toBeInTheDocument();
  });

  it('debería permitir reintentar ante un error inesperado', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('red'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Confirmar cambio de email/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo confirmar/i);
    expect(screen.getByRole('button', { name: /Confirmar cambio de email/i })).toBeInTheDocument();
  });

  it('no debería enviar dos veces la confirmación si se hace clic mientras la primera sigue en curso', async () => {
    let finish!: () => void;
    vi.mocked(apiClient.post).mockReturnValue(new Promise<void>(r => { finish = r; }) as never);
    renderPage();

    const button = await screen.findByRole('button', { name: /Confirmar cambio de email/i });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
  });
});