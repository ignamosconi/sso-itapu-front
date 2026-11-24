import { describe, it, expect, vi, beforeEach } from 'vitest';
import { studentsApi } from './studentsApi';
import { apiClient } from './client';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('studentsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAll debería consultar /admin/students con filtros', async () => {
    const mockRes = { data: [], total: 0 };
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockRes });

    const res = await studentsApi.findAll({ search: 'Juan', page: 1, limit: 10 });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/students', {
      params: { search: 'Juan', page: 1, limit: 10 },
    });
    expect(res).toEqual(mockRes);
  });

  it('requestEmailChange debería hacer POST a /admin/students/:id/email-change', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});

    await studentsApi.requestEmailChange('u1', { password: 'x', newEmail: 'nuevo@gmail.com' });

    expect(apiClient.post).toHaveBeenCalledWith('/admin/students/u1/email-change', {
      password: 'x',
      newEmail: 'nuevo@gmail.com',
    });
  });

  it('findOne debería consultar /admin/students/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 'u1' } });
    const res = await studentsApi.findOne('u1');
    expect(apiClient.get).toHaveBeenCalledWith('/admin/students/u1');
    expect(res).toEqual({ id: 'u1' });
  });

  it('create debería hacer POST a /admin/students', async () => {
    const payload = {
      first_name: 'Ana',
      last_name: 'Gómez',
      email: 'ana@test.com',
      dni: 12345678,
      birth_date: '2000-01-01',
      domain_role_id: 1,
      specialty_id: 2,
    };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 'u2', ...payload } });

    const res = await studentsApi.create(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/admin/students', payload);
    expect(res.id).toBe('u2');
  });

  it('getPasswordLock debería consultar /admin/students/:id/password-lock', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { locked: true, retryAfterSeconds: 300 } });

    const res = await studentsApi.getPasswordLock('u1');

    expect(apiClient.get).toHaveBeenCalledWith('/admin/students/u1/password-lock');
    expect(res).toEqual({ locked: true, retryAfterSeconds: 300 });
  });

  it('update debería hacer PATCH a /admin/students/:id', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 'u1', first_name: 'Editado' } });
    const res = await studentsApi.update('u1', { first_name: 'Editado' });
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/students/u1', { first_name: 'Editado' });
    expect(res.first_name).toBe('Editado');
  });

  it('remove debería hacer DELETE con body data', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});
    await studentsApi.remove('u1', { password: 'adminPassword' });
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/students/u1', {
      data: { password: 'adminPassword' },
    });
  });

  it('suspend y activate deberían hacer PATCH a las rutas correspondientes', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 'u1' } });

    await studentsApi.suspend('u1');
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/students/u1/suspend');

    await studentsApi.activate('u1');
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/students/u1/activate');
  });

  it('importPreview debería enviar el archivo como FormData', async () => {
    const file = new File(['contenido'], 'alumnos.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { total: 1, valid: 1, invalid: 0, rows: [] } });

    const res = await studentsApi.importPreview(file);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/admin/students/import/preview',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    expect(res.total).toBe(1);
  });

  it('importConfirm debería hacer POST a /admin/students/import/confirm', async () => {
    const payload = { rows: [] };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { imported: 0, usernameCollisions: 0 } });

    const res = await studentsApi.importConfirm(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/admin/students/import/confirm', payload);
    expect(res.imported).toBe(0);
  });

  it('resendWelcome debería hacer POST a /admin/students/:id/resend-welcome', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});
    await studentsApi.resendWelcome('u1');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/students/u1/resend-welcome');
  });

  it('downloadExampleXlsx debería descargar el blob y limpiar el link', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: new ArrayBuffer(8) });
    const createObjectURL = vi.fn().mockReturnValue('blob:test-url');
    const revokeObjectURL = vi.fn();
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await studentsApi.downloadExampleXlsx();

    expect(apiClient.get).toHaveBeenCalledWith('/admin/students/import/example', {
      responseType: 'blob',
    });
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    clickSpy.mockRestore();
  });
});