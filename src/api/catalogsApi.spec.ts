import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { healthApi } from './healthApi';
import { rolesApi } from './rolesApi';
import { specialtiesApi } from './specialtiesApi';
import { apiClient } from './client';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('healthApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checkSso debería retornar true si /health responde OK', async () => {
    vi.mocked(axios.get).mockResolvedValue({ status: 200 });
    expect(await healthApi.checkSso()).toBe(true);
  });

  it('checkSso debería retornar false si /health falla', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));
    expect(await healthApi.checkSso()).toBe(false);
  });
});

describe('rolesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('debería ejecutar findAll, create y remove sobre /admin/domain-roles', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 1, name: 'Alumno' }] });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 2, name: 'Docente' } });
    vi.mocked(apiClient.delete).mockResolvedValue({});

    expect(await rolesApi.findAll()).toEqual([{ id: 1, name: 'Alumno' }]);
    expect(await rolesApi.create({ name: 'Docente' })).toEqual({ id: 2, name: 'Docente' });
    await rolesApi.remove(2);
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/domain-roles/2');
  });
});

describe('specialtiesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('debería ejecutar findAll, create y remove sobre /admin/specialties', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 1, name: 'Sistemas' }] });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 2, name: 'Mecánica' } });
    vi.mocked(apiClient.delete).mockResolvedValue({});

    expect(await specialtiesApi.findAll()).toEqual([{ id: 1, name: 'Sistemas' }]);
    expect(await specialtiesApi.create({ name: 'Mecánica' })).toEqual({ id: 2, name: 'Mecánica' });
    await specialtiesApi.remove(2);
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/specialties/2');
  });
});