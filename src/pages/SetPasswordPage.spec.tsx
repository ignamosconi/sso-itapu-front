import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { SetPasswordPage } from './SetPasswordPage';
import { apiClient } from '@/api/client';
import { AxiosError, AxiosHeaders } from 'axios';

function httpError(status: number, data?: unknown, headers: Record<string, string> = {}) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fail', 'ERR_BAD_REQUEST', config, {}, { status, statusText: '', data, headers, config });
}

async function openFormAndSubmit(password: string, confirm = password) {
  await waitFor(() => {
    expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument();
  });
  fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: /Guardar contraseña/i }));
}

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

    fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), { target: { value: 'Password#123' } });
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i), { target: { value: 'Otra#12345' } });
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

    fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), { target: { value: 'Nueva#Pass123' } });
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i), { target: { value: 'Nueva#Pass123' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar contraseña/i }));

    await waitFor(() => {
      expect(screen.getByText(/¡Contraseña establecida! Ya podés cerrar esta página\./i)).toBeInTheDocument();
    });

    expect(apiClient.post).toHaveBeenLastCalledWith('/sso/set-password', {
      token: 'tok123',
      password: 'Nueva#Pass123',
      confirmPassword: 'Nueva#Pass123',
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

    fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), { target: { value: 'Nueva#Pass123' } });
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i), { target: { value: 'Nueva#Pass123' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar contraseña/i }));

    await waitFor(() => {
      expect(screen.getByText(/Token expirado/i)).toBeInTheDocument();
    });
  });

  describe('política de contraseñas', () => {
    it('al enviar una contraseña débil dice de una TODO lo que le falta y no llama al servidor', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({});
      renderWithToken('?token=tok123');
      await openFormAndSubmit('abc');

      expect(screen.getByRole('alert')).toHaveTextContent(
        'La contraseña no es segura. Le falta: al menos 8 caracteres, una letra mayúscula, un número, un caracter especial (por ejemplo ! # $ % _ -).',
      );
      expect(apiClient.post).toHaveBeenCalledTimes(1); // solo la validación del token
    });

    it('la política se informa antes que la falta de coincidencia', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({});
      renderWithToken('?token=tok123');
      await openFormAndSubmit('password123', 'otra');

      expect(screen.getByRole('alert')).toHaveTextContent('Le falta: una letra mayúscula, un caracter especial');
    });

    it('muestra en vivo qué requisitos se cumplen y cuáles faltan', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({});
      renderWithToken('?token=tok123');
      await waitFor(() => expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument());

      const list = screen.getByTestId('password-requirements');
      const state = () => Object.fromEntries(
        within(list).getAllByRole('listitem').map(li => [li.textContent?.replace(/ \((cumplido|falta)\)$/, ''), li.getAttribute('data-ok')]),
      );
      expect(Object.values(state())).toEqual(['false', 'false', 'false', 'false', 'false']);

      fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), { target: { value: 'itapu2026' } });
      expect(state()).toEqual({
        'Al menos 8 caracteres': 'true',
        'Una letra mayúscula': 'false',
        'Una letra minúscula': 'true',
        'Un número': 'true',
        'Un caracter especial (por ejemplo ! # $ % _ -)': 'false',
      });

      fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), { target: { value: 'Itapu#2026' } });
      expect(Object.values(state())).toEqual(['true', 'true', 'true', 'true', 'true']);
    });
  });

  describe('errores que no deben perder el formulario', () => {
    it('rechaza en el navegador una contraseña de más de 72 bytes sin llamar al servidor', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({});
      renderWithToken('?token=tok123');
      await openFormAndSubmit('Aa1#' + 'ñ'.repeat(35)); // 74 bytes pero solo 39 caracteres

      expect(screen.getByRole('alert')).toHaveTextContent(/no puede superar los 72 bytes/i);
      expect(apiClient.post).toHaveBeenCalledTimes(1); // solo la validación del token
    });

    it('acepta 72 bytes justos', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({}).mockResolvedValueOnce({});
      renderWithToken('?token=tok123');
      await openFormAndSubmit('Aa1#' + 'a'.repeat(68));

      await waitFor(() => expect(screen.getByText(/¡Contraseña establecida!/i)).toBeInTheDocument());
    });

    it('un 400 del servidor deja el formulario con el mensaje, y se puede corregir y reenviar', async () => {
      vi.mocked(apiClient.post)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(httpError(400, { message: ['La contraseña es demasiado débil.'] }))
        .mockResolvedValueOnce({});
      renderWithToken('?token=tok123');
      await openFormAndSubmit('Clave#Debil1');

      await waitFor(() => expect(screen.getByText(/La contraseña es demasiado débil\./i)).toBeInTheDocument());
      expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument(); // el formulario sigue ahí

      fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), { target: { value: 'Otra#Clave123' } });
      fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i), { target: { value: 'Otra#Clave123' } });
      fireEvent.click(screen.getByRole('button', { name: /Guardar contraseña/i }));
      await waitFor(() => expect(screen.getByText(/¡Contraseña establecida!/i)).toBeInTheDocument());
    });

    it('un 429 deja el formulario y dice cuánto esperar', async () => {
      vi.mocked(apiClient.post)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(httpError(429, { message: 'ThrottlerException: Too Many Requests' }, { 'retry-after': '30' }));
      renderWithToken('?token=tok123');
      await openFormAndSubmit('Nueva#Pass123');

      await waitFor(() => expect(screen.getByText(/Probá de nuevo en 30 segundos/i)).toBeInTheDocument());
      expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument();
    });

    it('un corte de red deja el formulario', async () => {
      vi.mocked(apiClient.post)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'));
      renderWithToken('?token=tok123');
      await openFormAndSubmit('Nueva#Pass123');

      await waitFor(() => expect(screen.getByText(/No se pudo conectar con el servidor/i)).toBeInTheDocument());
      expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument();
    });

    it('un 5xx deja el formulario con un mensaje propio, sin el texto técnico', async () => {
      vi.mocked(apiClient.post)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(httpError(500, { message: 'Internal server error' }));
      renderWithToken('?token=tok123');
      await openFormAndSubmit('Nueva#Pass123');

      await waitFor(() => expect(screen.getByText(/No se pudo guardar la contraseña/i)).toBeInTheDocument());
      expect(screen.queryByText(/Internal server error/i)).not.toBeInTheDocument();
    });
  });

  describe('errores que sí significan que el link ya no sirve', () => {
    it.each([
      [410, 'Este link ya fue utilizado.'],
      [404, 'El link no es válido.'],
    ])('un %i al guardar muestra el error y quita el formulario', async (status, message) => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({}).mockRejectedValueOnce(httpError(status, { message }));
      renderWithToken('?token=tok123');
      await openFormAndSubmit('Nueva#Pass123');

      await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
      expect(screen.queryByLabelText(/Nueva contraseña/i)).not.toBeInTheDocument();
    });

    it('un corte de red al validar el link no dice que el link es inválido', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'));
      renderWithToken('?token=tok123');

      await waitFor(() => expect(screen.getByText(/Recargá la página para volver a intentarlo/i)).toBeInTheDocument());
      expect(screen.queryByText(/El link no es válido/i)).not.toBeInTheDocument();
    });
  });
});