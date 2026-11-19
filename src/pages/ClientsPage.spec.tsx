import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ClientsPage } from './ClientsPage';
import { oauthClientsApi } from '@/api/adminApi';
import { studentsApi } from '@/api/studentsApi';
import { OAuthClientResponse } from '@/types/api.types';
// ── Mock: Select searchable ───────────────────────────────────────────
// Mantine v7 Combobox usa Transition + Popover internamente.
// En jsdom `transitionend` nunca se dispara, así que el dropdown del
// Combobox jamás se monta. Reemplazamos SOLO los Select con
// `searchable` por un input + divs[role="option"] nativos.
// Los Select no-searchable (page-size, etc.) siguen usando el real.
vi.mock('@mantine/core', async (importOriginal) => {
  const mod = await importOriginal<Record<string, any>>();
  const R   = await import('react');

  const TestableSelect = (props: any) => {
    const { data = [], value, onChange, placeholder, label, searchable } = props;

    const items = data.map((d: any) =>
      typeof d === 'string' ? { value: d, label: d } : d,
    );
    const [search, setSearch] = R.useState('');
    const [open, setOpen]     = R.useState(false);

    if (!searchable) return R.createElement(mod.Select, props);

    const filtered = search
      ? items.filter((i: any) => i.label.toLowerCase().includes(search.toLowerCase()))
      : items;

    return R.createElement(R.Fragment, null,
      label ? R.createElement('label', null, label) : null,
      R.createElement('input', {
        placeholder,
        value: search,
        onChange: (e: any) => { setSearch(e.target.value); setOpen(true); },
        onFocus:  ()      => setOpen(true),
      }),
      open
        ? filtered.map((i: any) =>
            R.createElement('div', {
              key: i.value,
              role: 'option',
              'aria-selected': value === i.value ? 'true' : 'false',
              onMouseDown: (e: any) => e.preventDefault(),
              onClick: () => { onChange?.(i.value); setSearch(i.label); setOpen(false); },
            }, i.label),
          )
        : null,
    );
  };

  return { ...mod, Select: TestableSelect };
});

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
    changeResponsibleUser: vi.fn(),
  },
}));

vi.mock('@/api/studentsApi', () => ({
  studentsApi: {
    findAll: vi.fn(),
  },
}));

const mockResponsibleUser = {
  id: 'student-uuid',
  username: 'jdoe',
  fullName: 'John Doe',
  censoredEmail: 'jo***@example.com',
};

const mockStudents = [
  {
    id: 'student-uuid',
    username: 'jdoe',
    first_name: 'John',
    last_name: 'Doe',
    email: 'jdoe@example.com',
    account_status: 'active' as const,
    dni: 12345678,
    birth_date: '2000-01-01',
    hasPassword: true,
    domainRole: { id: 1, name: 'Estudiante' },
    specialty: { id: 1, name: 'ISI' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockClients: OAuthClientResponse[] = [
  {
    id: 1,
    clientName: 'Torneito App',
    redirectUris: ['http://localhost:4000/callback'],
    isActive: true,
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
    responsibleUser: null,
  },
  {
    id: 2,
    clientName: 'Autogestión FRVM',
    redirectUris: ['https://autogestion.frvm.utn.edu.ar/cb'],
    isActive: false,
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
    responsibleUser: null,
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
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);

  it('debería listar clientes OAuth, filtrar por nombre/ID/URI y expandir detalles', async () => {
    vi.mocked(oauthClientsApi.findAll).mockResolvedValueOnce(mockClients);

    const { container } = renderClients();

    expect(await screen.findByText('Torneito App')).toBeInTheDocument();
    expect(screen.getByText('Autogestión FRVM')).toBeInTheDocument();
    expect(screen.getByText('Suspendido')).toBeInTheDocument();

    const firstCardButtons = container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button');
    fireEvent.click(firstCardButtons[firstCardButtons.length - 1]);
    expect(await screen.findByText('http://localhost:4000/callback')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/i), { target: { value: 'Autogestión' } });
    expect(screen.queryByText('Torneito App')).not.toBeInTheDocument();
    expect(screen.getByText('Autogestión FRVM')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/i), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText(/Buscar por URI/i), { target: { value: 'localhost:4000' } });
    expect(screen.getByText('Torneito App')).toBeInTheDocument();
    expect(screen.queryByText('Autogestión FRVM')).not.toBeInTheDocument();
  });

  it('debería crear un cliente nuevo y enviar las credenciales por email', async () => {
    vi.mocked(oauthClientsApi.findAll)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockClients[0]]);
    vi.mocked(studentsApi.findAll).mockResolvedValueOnce({ data: mockStudents, total: 1 });
    vi.mocked(oauthClientsApi.create).mockResolvedValueOnce({
      id: 1,
      clientName: 'Torneito App',
      redirectUris: ['http://localhost:4000/callback'],
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
      responsibleUser: mockResponsibleUser,
    });
    vi.mocked(oauthClientsApi.sendCredentialsByEmail).mockResolvedValueOnce(undefined);

    renderClients();

    fireEvent.click(await screen.findByRole('button', { name: /Nuevo cliente/i }));

    const appNameInput = await screen.findByLabelText(/Nombre de la app/i);
    const uriInput = screen.getByPlaceholderText('http://localhost:4000/callback');

    fireEvent.change(appNameInput, { target: { value: 'Torneito App' } });
    fireEvent.change(uriInput, { target: { value: 'http://localhost:4000/callback' } });

    // Seleccionar usuario responsable (usa el mock TestableSelect)
    const responsibleInput = await screen.findByPlaceholderText(/Buscar por username o nombre/i);
    fireEvent.change(responsibleInput, { target: { value: 'jdoe' } });
    const studentOption = await screen.findByRole('option', { name: /jdoe/i });
    fireEvent.click(studentOption);

    fireEvent.submit(appNameInput.closest('form')!);

    await waitFor(() => {
      expect(oauthClientsApi.create).toHaveBeenCalledWith({
        clientName: 'Torneito App',
        redirectUris: ['http://localhost:4000/callback'],
        responsibleUserId: 'student-uuid',
      });
    });

    const sendButton = await screen.findByRole('button', { name: /Enviar credenciales por email/i });
    fireEvent.click(sendButton);

    expect(await screen.findByText(/Credenciales enviadas a/i)).toBeInTheDocument();
    expect(oauthClientsApi.sendCredentialsByEmail).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: /^Cerrar$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Credenciales enviadas a/i)).not.toBeInTheDocument();
    });
  });

  it('debería editar un cliente existente', async () => {
    vi.mocked(oauthClientsApi.findAll)
      .mockResolvedValueOnce([mockClients[0]])
      .mockResolvedValueOnce([{ ...mockClients[0], clientName: 'Torneito v2' }]);
    vi.mocked(oauthClientsApi.update).mockResolvedValueOnce({ ...mockClients[0], clientName: 'Torneito v2' });

    const { container } = renderClients();
    await screen.findByText('Torneito App');

    const cardButtons = container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button');
    fireEvent.click(cardButtons[1]);

    const nameInput = await screen.findByLabelText(/Nombre de la app/i);
    fireEvent.change(nameInput, { target: { value: 'Torneito v2' } });
    fireEvent.submit(nameInput.closest('form')!);

    await waitFor(() => {
      expect(oauthClientsApi.update).toHaveBeenCalledWith(1, { clientName: 'Torneito v2' });
    });

    await screen.findByText('Torneito v2');
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
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
      responsibleUser: mockResponsibleUser,
    });
    vi.mocked(oauthClientsApi.sendCredentialsByEmail).mockResolvedValueOnce(undefined);
    vi.mocked(oauthClientsApi.remove).mockResolvedValueOnce(undefined);

    const { container } = renderClients();
    await screen.findByText('Torneito App');

    const getCardButtons = () =>
      container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button');

    // 1. Suspender
    fireEvent.click(getCardButtons()[3]);
    await screen.findByText('Suspendido');

    // 2. Reactivar
    fireEvent.click(getCardButtons()[3]);
    await waitFor(() => {
      expect(screen.queryByText('Suspendido')).not.toBeInTheDocument();
    });

    // 3. Regenerar secret
    fireEvent.click(getCardButtons()[2]);
    fireEvent.click(await screen.findByRole('button', { name: /^Regenerar$/i }));

    const sendButton = await screen.findByRole('button', { name: /Enviar credenciales por email/i });
    expect(oauthClientsApi.regenerateSecret).toHaveBeenCalledWith(1);
    fireEvent.click(sendButton);

    expect(await screen.findByText(/Credenciales enviadas a/i)).toBeInTheDocument();
    expect(oauthClientsApi.sendCredentialsByEmail).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: /^Cerrar$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Credenciales enviadas a/i)).not.toBeInTheDocument();
    });

    // 4. Eliminar
    fireEvent.click(getCardButtons()[4]);
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