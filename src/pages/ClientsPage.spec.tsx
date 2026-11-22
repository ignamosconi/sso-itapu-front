import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ClientsPage } from './ClientsPage';
import { oauthClientsApi } from '@/api/adminApi';
import { studentsApi } from '@/api/studentsApi';
import { OAuthClientResponse } from '@/types/api.types';
const { firstOnChangeSpy } = vi.hoisted(() => ({ firstOnChangeSpy: vi.fn() }));
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
    R.useEffect(() => {
      if (searchable) firstOnChangeSpy(!!props.selectFirstOptionOnChange);
    }, [searchable, props.selectFirstOptionOnChange]);

    if (!searchable) return R.createElement(mod.Select, props);

    const filtered = search
      ? items.filter((i: any) => i.label.toLowerCase().includes(search.toLowerCase()))
      : items;

    return R.createElement(R.Fragment, null,
      label ? R.createElement('label', null, label) : null,
      R.createElement('input', {
        placeholder,
        value: search,
        'data-first-on-open': String(!!props.selectFirstOptionOnDropdownOpen),
        onChange: (e: any) => { setSearch(e.target.value); setOpen(true); props.onSearchChange?.(e.target.value); },
        onFocus:  ()      => setOpen(true),
      }),
      open
        ? filtered.map((i: any) =>
            R.createElement('div', {
              key: i.value,
              role: 'option',
              'aria-selected': value === i.value ? 'true' : 'false',
              onMouseDown: (e: any) => e.preventDefault(),
              onClick: () => { onChange?.(i.value); setSearch(i.label); setOpen(false); props.onSearchChange?.(i.label); },
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

const mockStudentAlice = {
  ...mockStudents[0],
  id: 'student-uuid-2',
  username: 'asmith',
  first_name: 'Alice',
  last_name: 'Smith',
  email: 'asmith@example.com',
  dni: 99887766,
};

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

// Abre la edición del cliente 1 (que ya tiene responsable), opcionalmente le cambia el nombre,
// elige a "asmith" como nuevo responsable y envía el formulario.
async function editResponsibleToAlice(newName?: string) {
  const clientWithResponsible: OAuthClientResponse = {
    ...mockClients[0],
    responsibleUser: mockResponsibleUser,
  };
  vi.mocked(oauthClientsApi.findAll).mockResolvedValue([clientWithResponsible]);
  vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [...mockStudents, mockStudentAlice], total: 2 });

  const { container } = renderClients();
  await screen.findByText('Torneito App');
  fireEvent.click(container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button')[1]);

  if (newName) {
    fireEvent.change(await screen.findByLabelText(/Nombre de la app/i), { target: { value: newName } });
  }
  fireEvent.change(await screen.findByPlaceholderText(/Buscar por username o nombre/i), {
    target: { value: 'asmith' },
  });
  fireEvent.click(await screen.findByRole('option', { name: /asmith/i }));
  fireEvent.submit(screen.getByLabelText(/Nombre de la app/i).closest('form')!);
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

    // Un solo buscador para nombre, ID y URI
    const searchInput = screen.getByPlaceholderText(/Buscar por nombre, ID o URI/i);

    fireEvent.change(searchInput, { target: { value: 'Autogestión' } });
    expect(screen.queryByText('Torneito App')).not.toBeInTheDocument();
    expect(screen.getByText('Autogestión FRVM')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });
    fireEvent.change(searchInput, { target: { value: 'localhost:4000' } });
    expect(screen.getByText('Torneito App')).toBeInTheDocument();
    expect(screen.queryByText('Autogestión FRVM')).not.toBeInTheDocument();
  });

  it('debería buscar sin importar tildes ni mayúsculas, y también por ID', async () => {
    vi.mocked(oauthClientsApi.findAll).mockResolvedValueOnce(mockClients);

    renderClients();
    await screen.findByText('Torneito App');
    const searchInput = screen.getByPlaceholderText(/Buscar por nombre, ID o URI/i);

    // sin tilde encuentra "Autogestión"
    fireEvent.change(searchInput, { target: { value: 'AUTOGESTION' } });
    expect(screen.queryByText('Torneito App')).not.toBeInTheDocument();
    expect(screen.getByText('Autogestión FRVM')).toBeInTheDocument();

    // por ID (el 2 es de Autogestión)
    fireEvent.change(searchInput, { target: { value: '2' } });
    expect(screen.queryByText('Torneito App')).not.toBeInTheDocument();
    expect(screen.getByText('Autogestión FRVM')).toBeInTheDocument();
  });

  it('debería buscar al usuario responsable en el servidor (con debounce) y no solo entre los primeros resultados', async () => {
    vi.mocked(oauthClientsApi.findAll).mockResolvedValueOnce([]);
    vi.mocked(studentsApi.findAll)
      .mockResolvedValueOnce({ data: mockStudents, total: 150 })
      .mockResolvedValueOnce({ data: [mockStudentAlice], total: 1 });

    renderClients();
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo cliente/i }));

    // Al abrir el modal: primeros 20 usuarios activos, sin texto de búsqueda
    await waitFor(() => {
      expect(studentsApi.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ accountStatus: 'active', limit: 20 }),
      );
    });

    fireEvent.change(await screen.findByPlaceholderText(/Buscar por username o nombre/i), {
      target: { value: 'asmith' },
    });

    await waitFor(() => {
      expect(studentsApi.findAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ accountStatus: 'active', search: 'asmith', limit: 20 }),
      );
    });
    expect(await screen.findByRole('option', { name: /asmith/i })).toBeInTheDocument();
  });

  it('no debería buscar en el servidor la etiqueta que Mantine escribe al elegir una opción', async () => {
    vi.mocked(oauthClientsApi.findAll).mockResolvedValueOnce([]);
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: mockStudents, total: 1 });

    renderClients();
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo cliente/i }));

    fireEvent.change(await screen.findByPlaceholderText(/Buscar por username o nombre/i), {
      target: { value: 'jdoe' },
    });
    await waitFor(() => {
      expect(studentsApi.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'jdoe' }));
    });

    fireEvent.click(await screen.findByRole('option', { name: /jdoe/i }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 450)); });

    expect(studentsApi.findAll).not.toHaveBeenCalledWith(
      expect.objectContaining({ search: 'jdoe — John Doe' }),
    );
  });

  it('debería resaltar la primera opción del selector al abrir y recién cuando llegan los resultados de una búsqueda', async () => {
    type StudentsPage = Awaited<ReturnType<typeof studentsApi.findAll>>;
    let resolveSearch!: (page: StudentsPage) => void;
    vi.mocked(oauthClientsApi.findAll).mockResolvedValueOnce([]);
    vi.mocked(studentsApi.findAll)
      .mockResolvedValueOnce({ data: mockStudents, total: 1 })
      .mockReturnValueOnce(new Promise<StudentsPage>(resolve => { resolveSearch = resolve; }));

    renderClients();
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo cliente/i }));
    const input = await screen.findByPlaceholderText(/Buscar por username o nombre/i);

    // Sin responsable elegido, el cursor aparece apenas se abre el listado
    expect(input).toHaveAttribute('data-first-on-open', 'true');

    // Esperar a que termine la carga inicial (si el selector ya estaba montado, también dispara el pulso)
    await waitFor(() => expect(studentsApi.findAll).toHaveBeenCalledTimes(1));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    firstOnChangeSpy.mockClear();

    // Mientras la búsqueda está en curso la lista en pantalla es la vieja: no se resalta nada
    fireEvent.change(input, { target: { value: 'asmith' } });
    await waitFor(() => expect(studentsApi.findAll).toHaveBeenCalledTimes(2));
    expect(firstOnChangeSpy).not.toHaveBeenCalledWith(true);

    // Al llegar los resultados el pulso se enciende y se apaga de nuevo
    await act(async () => { resolveSearch({ data: [mockStudentAlice], total: 1 }); });
    await waitFor(() => expect(firstOnChangeSpy).toHaveBeenCalledWith(true));
    await waitFor(() => expect(firstOnChangeSpy).toHaveBeenLastCalledWith(false));
  });

  it('no debería mover el cursor a la primera opción al abrir si ya hay un responsable elegido', async () => {
    const clientWithResponsible: OAuthClientResponse = {
      ...mockClients[0],
      responsibleUser: mockResponsibleUser,
    };
    vi.mocked(oauthClientsApi.findAll).mockResolvedValueOnce([clientWithResponsible]);
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: mockStudents, total: 1 });

    const { container } = renderClients();
    await screen.findByText('Torneito App');
    fireEvent.click(container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button')[1]);

    const input = await screen.findByPlaceholderText(/Buscar por username o nombre/i);
    expect(input).toHaveAttribute('data-first-on-open', 'false');
  });

  it('debería conservar al responsable actual en el selector aunque la búsqueda no lo devuelva', async () => {
    const clientWithResponsible: OAuthClientResponse = {
      ...mockClients[0],
      responsibleUser: mockResponsibleUser,
    };
    vi.mocked(oauthClientsApi.findAll).mockResolvedValueOnce([clientWithResponsible]);
    // La lista del servidor trae a otra persona: el responsable actual (jdoe) no está en ella
    vi.mocked(studentsApi.findAll).mockResolvedValueOnce({ data: [mockStudentAlice], total: 1 });

    const { container } = renderClients();
    await screen.findByText('Torneito App');
    fireEvent.click(container.querySelectorAll('.mantine-Card-root')[0].querySelectorAll('button')[1]);

    fireEvent.focus(await screen.findByPlaceholderText(/Buscar por username o nombre/i));

    expect(await screen.findByRole('option', { name: /asmith/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /jdoe/i })).toBeInTheDocument();
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

  it('debería editar un cliente existente (nombre)', async () => {
    vi.mocked(oauthClientsApi.findAll)
      .mockResolvedValueOnce([mockClients[0]])
      .mockResolvedValueOnce([{ ...mockClients[0], clientName: 'Torneito v2' }]);
    vi.mocked(oauthClientsApi.update).mockResolvedValueOnce({ ...mockClients[0], clientName: 'Torneito v2' });
    vi.mocked(studentsApi.findAll).mockResolvedValueOnce({ data: mockStudents, total: 1 });

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

    // Editar solo el nombre no ofrece regenerar el secret
    expect(screen.queryByText(/^Cambiar responsable$/i)).not.toBeInTheDocument();
  });

  it('debería pedir confirmación al cambiar el responsable y no guardar nada si se cancela', async () => {
    await editResponsibleToAlice('Torneito v2');

    expect(await screen.findByText(/^Cambiar responsable$/i)).toBeInTheDocument();
    expect(oauthClientsApi.update).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/^Cambiar responsable$/i)).not.toBeInTheDocument();
    });

    // Vuelve al formulario con lo que el admin había escrito, sin haber guardado nada
    expect(screen.getByLabelText(/Nombre de la app/i)).toHaveValue('Torneito v2');
    expect(oauthClientsApi.update).not.toHaveBeenCalled();
    expect(oauthClientsApi.regenerateSecret).not.toHaveBeenCalled();
  });

  it('debería guardar todos los cambios y regenerar el secret al confirmar el cambio de responsable', async () => {
    vi.mocked(oauthClientsApi.update).mockResolvedValueOnce({
      ...mockClients[0],
      responsibleUser: mockResponsibleUser,
    });
    vi.mocked(oauthClientsApi.regenerateSecret).mockResolvedValueOnce({
      id: 1,
      clientName: 'Torneito v2',
      redirectUris: ['http://localhost:4000/callback'],
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
      responsibleUser: mockResponsibleUser,
    });

    await editResponsibleToAlice('Torneito v2');
    fireEvent.click(await screen.findByRole('button', { name: /Guardar y regenerar secret/i }));

    await waitFor(() => {
      expect(oauthClientsApi.update).toHaveBeenCalledWith(1, {
        clientName: 'Torneito v2',
        responsibleUserId: 'student-uuid-2',
      });
      expect(oauthClientsApi.regenerateSecret).toHaveBeenCalledWith(1);
    });
    expect(vi.mocked(oauthClientsApi.update).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(oauthClientsApi.regenerateSecret).mock.invocationCallOrder[0]);

    // Termina en el modal que permite enviar las credenciales nuevas
    expect(await screen.findByRole('button', { name: /Enviar credenciales por email/i })).toBeInTheDocument();
  });

  it('debería volver al formulario con el error y no regenerar nada si falla el guardado', async () => {
    vi.mocked(oauthClientsApi.update).mockRejectedValueOnce({
      response: { data: { message: 'Ya existe una aplicación con ese nombre.' } },
    });

    await editResponsibleToAlice('Torneito v2');
    fireEvent.click(await screen.findByRole('button', { name: /Guardar y regenerar secret/i }));

    expect(await screen.findByText('Ya existe una aplicación con ese nombre.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/^Cambiar responsable$/i)).not.toBeInTheDocument();
    });
    expect(oauthClientsApi.regenerateSecret).not.toHaveBeenCalled();
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