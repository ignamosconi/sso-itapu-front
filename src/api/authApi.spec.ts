import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi } from './authApi';
import { apiClient } from './client';

vi.mock('./client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login debería enviar credenciales a /admin/auth/login', async () => {
    const mockRes = { pending_token: 'pt', requires_2fa_setup: false };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockRes });

    const res = await authApi.login('admin', 'secret123');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/auth/login', {
      username: 'admin',
      password: 'secret123',
    });
    expect(res).toEqual(mockRes);
  });

  it('setup2fa debería solicitar QR a /admin/auth/2fa/setup', async () => {
    const mockRes = { qrCodeDataUrl: 'data:...', manualEntrySecret: 'ABC', confirm_pending_token: 'cpt' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockRes });

    const res = await authApi.setup2fa('pt');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/auth/2fa/setup', { pending_token: 'pt' });
    expect(res).toEqual(mockRes);
  });

  it('confirm2fa debería confirmar el primer código TOTP', async () => {
    const mockRes = { access_token: 'at', refresh_token: 'rt', token_type: 'Bearer', expires_in: 900 };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockRes });

    const res = await authApi.confirm2fa('cpt', '123456');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/auth/2fa/confirm', {
      pending_token: 'cpt',
      totp_code: '123456',
    });
    expect(res).toEqual(mockRes);
  });

  it('validate2fa debería validar código TOTP en logins posteriores', async () => {
    const mockRes = { access_token: 'at', refresh_token: 'rt', token_type: 'Bearer', expires_in: 900 };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockRes });

    const res = await authApi.validate2fa('pt', '654321');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/auth/2fa/validate', {
      pending_token: 'pt',
      totp_code: '654321',
    });
    expect(res).toEqual(mockRes);
  });

  it('refresh debería renovar tokens en /admin/auth/refresh', async () => {
    const mockRes = { access_token: 'at2', refresh_token: 'rt2', token_type: 'Bearer', expires_in: 900 };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockRes });

    const res = await authApi.refresh('rt');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/auth/refresh', { refresh_token: 'rt' });
    expect(res).toEqual(mockRes);
  });

  it('logout debería revocar el refresh token', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});

    await authApi.logout('rt');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/auth/logout', { refresh_token: 'rt' });
  });

  it('reset2fa debería enviar password actual a /admin/auth/2fa/reset', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});

    await authApi.reset2fa('pass1234');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/auth/2fa/reset', { password: 'pass1234' });
  });
});