import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { apiClient } from './client';
import { useAuthStore } from '@/store/authStore';

describe('apiClient interceptors', () => {
  const originalAdapter = apiClient.defaults.adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: 'initial-access-token',
      refreshToken: 'initial-refresh-token',
      isAuthenticated: true,
      logout: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockImplementation(async () => {
        useAuthStore.setState({ accessToken: 'refreshed-access-token' });
      }),
    });
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('debería inyectar el header Authorization si existe accessToken', async () => {
    const adapterMock = vi.fn<AxiosAdapter>(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
    apiClient.defaults.adapter = adapterMock;

    await apiClient.get('/admin/stats');

    expect(adapterMock).toHaveBeenCalledTimes(1);
    const passedConfig = adapterMock.mock.calls[0][0];
    expect(passedConfig.headers.Authorization).toBe('Bearer initial-access-token');
  });

  it('no debería agregar header Authorization si no hay accessToken', async () => {
    useAuthStore.setState({ accessToken: null });
    const adapterMock = vi.fn<AxiosAdapter>(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
    apiClient.defaults.adapter = adapterMock;

    await apiClient.get('/public/health');

    const passedConfig = adapterMock.mock.calls[0][0];
    expect(passedConfig.headers.Authorization).toBeUndefined();
  });

  it('debería refrescar el token ante un 401 y reintentar el request original', async () => {
    let attempts = 0;
    const adapterMock = vi.fn<AxiosAdapter>(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      attempts += 1;
      if (attempts === 1) {
        const err = Object.assign(new Error('Unauthorized'), {
          isAxiosError: true,
          config,
          response: { status: 401, data: {} },
        });
        return Promise.reject(err);
      }
      return {
        data: { recovered: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    });
    apiClient.defaults.adapter = adapterMock;

    const response = await apiClient.get('/admin/students');

    expect(response.data).toEqual({ recovered: true });
    expect(useAuthStore.getState().refresh).toHaveBeenCalledTimes(1);
    expect(adapterMock).toHaveBeenCalledTimes(2);
    expect(adapterMock.mock.calls[1][0].headers.Authorization).toBe('Bearer refreshed-access-token');
  });

  it('debería serializar múltiples 401 concurrentes con una única llamada a refresh', async () => {
    let callCount = 0;
    const adapterMock = vi.fn<AxiosAdapter>(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      callCount += 1;
      if (callCount <= 2) {
        const err = Object.assign(new Error('Unauthorized'), {
          isAxiosError: true,
          config,
          response: { status: 401, data: {} },
        });
        return Promise.reject(err);
      }
      return {
        data: { url: config.url },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    });
    apiClient.defaults.adapter = adapterMock;

    const [res1, res2] = await Promise.all([
      apiClient.get('/admin/stats'),
      apiClient.get('/admin/clients'),
    ]);

    expect(res1.data).toEqual({ url: '/admin/stats' });
    expect(res2.data).toEqual({ url: '/admin/clients' });
    expect(useAuthStore.getState().refresh).toHaveBeenCalledTimes(1);
  });

  it('no debería intentar refresh si el 401 proviene de un endpoint de auth', async () => {
    const adapterMock = vi.fn<AxiosAdapter>(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      const err = Object.assign(new Error('Invalid credentials'), {
        isAxiosError: true,
        config,
        response: { status: 401, data: {} },
      });
      return Promise.reject(err);
    });
    apiClient.defaults.adapter = adapterMock;

    await expect(apiClient.post('/admin/auth/login', {})).rejects.toThrow('Invalid credentials');
    expect(useAuthStore.getState().refresh).not.toHaveBeenCalled();
  });

  it('debería cerrar sesión y redirigir a /login si el refresh falla', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });

    useAuthStore.setState({
      refresh: vi.fn().mockRejectedValue(new Error('Refresh expired')),
    });

    const adapterMock = vi.fn<AxiosAdapter>(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      const err = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        config,
        response: { status: 401, data: {} },
      });
      return Promise.reject(err);
    });
    apiClient.defaults.adapter = adapterMock;

    await expect(apiClient.get('/admin/admins')).rejects.toThrow('Unauthorized');
    expect(useAuthStore.getState().logout).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/login');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('debería propagar errores que no sean de Axios sin intentar refresh', async () => {
    const adapterMock = vi.fn<AxiosAdapter>(async () => Promise.reject(new TypeError('Network failure')));
    apiClient.defaults.adapter = adapterMock;

    await expect(apiClient.get('/admin/stats')).rejects.toThrow('Network failure');
    expect(useAuthStore.getState().refresh).not.toHaveBeenCalled();
  });
});