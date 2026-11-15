import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminsApi, oauthClientsApi } from './adminApi';
import { apiClient } from './client';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('adminsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('findAll debería consultar GET /admin/admins', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: '1', username: 'admin' }] });
    const res = await adminsApi.findAll();
    expect(apiClient.get).toHaveBeenCalledWith('/admin/admins');
    expect(res).toHaveLength(1);
  });

  it('findOne debería consultar GET /admin/admins/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: '1', username: 'admin' } });
    const res = await adminsApi.findOne('1');
    expect(apiClient.get).toHaveBeenCalledWith('/admin/admins/1');
    expect(res.id).toBe('1');
  });

  it('create debería enviar POST /admin/admins', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: '2', username: 'nuevo' } });
    const res = await adminsApi.create({ username: 'nuevo', password: 'password123' });
    expect(apiClient.post).toHaveBeenCalledWith('/admin/admins', { username: 'nuevo', password: 'password123' });
    expect(res.username).toBe('nuevo');
  });

  it('updateSelf debería enviar PATCH /admin/admins/me', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: '1', username: 'editado' } });
    const res = await adminsApi.updateSelf({ username: 'editado', currentPassword: 'password123' });
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/admins/me', {
      username: 'editado',
      currentPassword: 'password123',
    });
    expect(res.username).toBe('editado');
  });

  it('removeSelf debería enviar DELETE /admin/admins/me con data', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});
    const payload = { password: 'password123', confirmationPhrase: 'borrar-mi-cuenta-no-es-reversible' };
    await adminsApi.removeSelf(payload);
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/admins/me', { data: payload });
  });
});

describe('oauthClientsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('findAll y findOne deberían consultar los endpoints de clientes', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: { id: 1 } });

    expect(await oauthClientsApi.findAll()).toEqual([]);
    expect(apiClient.get).toHaveBeenCalledWith('/admin/clients');

    expect(await oauthClientsApi.findOne(1)).toEqual({ id: 1 });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/clients/1');
  });

  it('create, update y remove deberían operar sobre /admin/clients', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1, plainSecret: 'sec' } });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 1, clientName: 'App2' } });
    vi.mocked(apiClient.delete).mockResolvedValue({});

    const created = await oauthClientsApi.create({ clientName: 'App', redirectUris: ['https://a.com'] });
    expect(created.plainSecret).toBe('sec');

    const updated = await oauthClientsApi.update(1, { clientName: 'App2' });
    expect(updated.clientName).toBe('App2');

    await oauthClientsApi.remove(1);
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/clients/1');
  });

  it('regenerateSecret, sendCredentialsByEmail, suspend y activate deberían llamar a sus rutas', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1, plainSecret: 'new-sec' } });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 1, isActive: false } });

    const regen = await oauthClientsApi.regenerateSecret(1);
    expect(apiClient.post).toHaveBeenCalledWith('/admin/clients/1/regenerate-secret');
    expect(regen.plainSecret).toBe('new-sec');

    await oauthClientsApi.sendCredentialsByEmail(1, { to: 'dev@utn.edu.ar' });
    expect(apiClient.post).toHaveBeenCalledWith('/admin/clients/1/send-credentials', { to: 'dev@utn.edu.ar' });

    await oauthClientsApi.suspend(1);
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/clients/1/suspend');

    await oauthClientsApi.activate(1);
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/clients/1/activate');
  });
});