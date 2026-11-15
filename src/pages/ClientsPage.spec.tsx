import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ClientsPage } from './ClientsPage';
import { oauthClientsApi } from '@/api/adminApi';
import { OAuthClientResponse } from '@/types/api.types';

vi.mock('@/api/adminApi', () => ({
  oauthClientsApi: {
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    regenerateSecret: vi.fn(),
    suspend: vi.fn(),
    activate: vi.fn(),
    sendCredentialsByEmail: vi.fn(),
  },
}));

const mockClients: OAuthClientResponse[] = [
  {
    id: 1,
    clientName: 'Torneito App',
    redirectUris: ['http://localhost:4000/callback'],
    isActive: true,
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 2,
    clientName: 'Autogestión FRVM',
    redirectUris: ['https://autogestion.frvm.utn.edu.ar/cb'],
    isActive: false,
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
  },
];

function renderClients() {
  return render(
    <MantineProvider>
      <ClientsPage />
    </MantineProvider>,
  );
}

describe('ClientsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('debería listar clientes OAuth, filtrar por nombre/ID/URI y expandir detalles', async () => {
    vi.mocked(oauthClientsApi.findAll).mockResolvedValueOnce(mockClients);

    const { container } = renderClients();

    expect(await screen.findByText('Torneito App')).toBeInTheDocument();
    expect(screen.getByText('Autogestión FRVM')).toBeInTheDocument();
    expect(screen.getByText('Suspendido')).toBeInTheDocument();

    // Expandir primera tarjeta (último ActionIcon de la fila)
    const firstCardButtons = container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button');
    fireEvent.click(firstCardButtons[firstCardButtons.length - 1]);
    expect(await screen.findByText('http://localhost:4000/callback')).toBeInTheDocument();

    // Filtrar por nombre
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/i), { target: { value: 'Autogestión' } });
    expect(screen.queryByText('Torneito App')).not.toBeInTheDocument();
    expect(screen.getByText('Autogestión FRVM')).toBeInTheDocument();

    // Limpiar nombre y filtrar por URI
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/i), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText(/Buscar por URI/i), { target: { value: 'localhost:4000' } });
    expect(screen.getByText('Torneito App')).toBeInTheDocument();
    expect(screen.queryByText('Autogestión FRVM')).not.toBeInTheDocument();
  });

  it('debería crear un cliente nuevo y enviar las credenciales por email', async () => {
    vi.mocked(oauthClientsApi.findAll)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockClients[0]]);
    vi.mocked(oauthClientsApi.create).mockResolvedValueOnce({
      id: 1,
      clientName: 'Torneito App',
      redirectUris: ['http://localhost:4000/callback'],
      plainSecret: 'secret_once_123',
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
    });
    vi.mocked(oauthClientsApi.sendCredentialsByEmail).mockResolvedValueOnce(undefined);

    renderClients();

    fireEvent.click(await screen.findByRole('button', { name: /Nuevo cliente/i }));

    const appNameInput = await screen.findByLabelText(/Nombre de la app/i);
    const uriInput = screen.getByPlaceholderText('http://localhost:4000/callback');

    fireEvent.change(appNameInput, { target: { value: 'Torneito App' } });
    fireEvent.change(uriInput, { target: { value: 'http://localhost:4000/callback' } });
    fireEvent.submit(appNameInput.closest('form')!);

    // Se abre modal de secret obligando a enviar email
    const emailInput = await screen.findByLabelText(/Email del desarrollador/i);
    expect(oauthClientsApi.create).toHaveBeenCalledWith({
      clientName: 'Torneito App',
      redirectUris: ['http://localhost:4000/callback'],
    });

    fireEvent.change(emailInput, { target: { value: 'dev@frvm.utn.edu.ar' } });
    fireEvent.submit(emailInput.closest('form')!);

    expect(await screen.findByText(/Credenciales enviadas correctamente a/i)).toBeInTheDocument();
    expect(oauthClientsApi.sendCredentialsByEmail).toHaveBeenCalledWith(1, { to: 'dev@frvm.utn.edu.ar' });

    fireEvent.click(screen.getByRole('button', { name: /^Cerrar$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Credenciales enviadas correctamente/i)).not.toBeInTheDocument();
    });
  });

  it('debería editar un cliente existente', async () => {
    vi.mocked(oauthClientsApi.findAll)
      .mockResolvedValueOnce([mockClients[0]])
      .mockResolvedValueOnce([{ ...mockClients[0], clientName: 'Torneito v2' }]);
    vi.mocked(oauthClientsApi.update).mockResolvedValueOnce({ ...mockClients[0], clientName: 'Torneito v2' });

    const { container } = renderClients();
    await screen.findByText('Torneito App');

    // Botones de card activa: [0]=email, [1]=editar, [2]=regenerar, [3]=suspender, [4]=eliminar, [5]=expandir
    const cardButtons = container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button');
    fireEvent.click(cardButtons[1]);

    const nameInput = await screen.findByLabelText(/Nombre de la app/i);
    fireEvent.change(nameInput, { target: { value: 'Torneito v2' } });
    fireEvent.submit(nameInput.closest('form')!);

    await waitFor(
      () => {
        expect(oauthClientsApi.update).toHaveBeenCalledWith(1, { clientName: 'Torneito v2' });
        expect(screen.getByText('Torneito v2')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('debería suspender, reactivar, regenerar secret y eliminar un cliente', async () => {
    vi.mocked(oauthClientsApi.findAll)
      .mockResolvedValueOnce([mockClients[0]])
      .mockResolvedValueOnce([mockClients[0]])
      .mockResolvedValueOnce([]);
    vi.mocked(oauthClientsApi.suspend).mockResolvedValueOnce({ ...mockClients[0], isActive: false });
    vi.mocked(oauthClientsApi.activate).mockResolvedValueOnce({ ...mockClients[0], isActive: true });
    vi.mocked(oauthClientsApi.regenerateSecret).mockResolvedValueOnce({
      id: 1,
      clientName: 'Torneito App',
      redirectUris: ['http://localhost:4000/callback'],
      plainSecret: 'new_secret_456',
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
    });
    vi.mocked(oauthClientsApi.sendCredentialsByEmail).mockResolvedValueOnce(undefined);
    vi.mocked(oauthClientsApi.remove).mockResolvedValueOnce(undefined);

    const { container } = renderClients();
    await screen.findByText('Torneito App');

    // 1. Suspender
    let cardButtons = container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button');
    fireEvent.click(cardButtons[3]);
    expect(await screen.findByText('Suspendido')).toBeInTheDocument();

    // 2. Reactivar
    cardButtons = container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button');
    fireEvent.click(cardButtons[3]);
    await waitFor(() => {
      expect(screen.queryByText('Suspendido')).not.toBeInTheDocument();
    });

    // 3. Regenerar secret
    cardButtons = container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button');
    fireEvent.click(cardButtons[2]);
    fireEvent.click(await screen.findByRole('button', { name: /^Regenerar$/i }));

    const emailInput = await screen.findByLabelText(/Email del desarrollador/i);
    expect(oauthClientsApi.regenerateSecret).toHaveBeenCalledWith(1);
    fireEvent.change(emailInput, { target: { value: 'dev@frvm.utn.edu.ar' } });
    fireEvent.submit(emailInput.closest('form')!);
    expect(await screen.findByText(/Credenciales enviadas correctamente a/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Cerrar$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Credenciales enviadas correctamente a/i)).not.toBeInTheDocument();
    });

    // 4. Eliminar
    cardButtons = container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button');
    fireEvent.click(cardButtons[4]);
    fireEvent.click(await screen.findByRole('button', { name: /^Eliminar$/i }));

    await waitFor(
      () => {
        expect(oauthClientsApi.remove).toHaveBeenCalledWith(1);
        expect(screen.queryByText('Torneito App')).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});