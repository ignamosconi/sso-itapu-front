import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { statsApi } from './statsApi';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from './client';

const mockStats = {
  oauthClientCount: 3,
  studentCount: 150,
  pendingRegistrationCount: 10,
  studentsBySpecialty: [{ specialty: 'Mecánica', count: 80 }],
};

describe('statsApi', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getDashboard', () => {
    it('debería hacer fetch y guardar en caché si no hay datos en localStorage', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockStats });

      const result = await statsApi.getDashboard();

      expect(apiClient.get).toHaveBeenCalledWith('/admin/stats/dashboard');
      expect(result).toEqual(mockStats);
      // Verificar que guardó en caché
      expect(localStorage.getItem('itapu_dashboard_stats')).not.toBeNull();
    });

    it('debería retornar datos en caché si no expiraron', async () => {
      // Precargar caché con timestamp actual
      const cached = { data: mockStats, timestamp: Date.now() };
      localStorage.setItem('itapu_dashboard_stats', JSON.stringify(cached));

      const result = await statsApi.getDashboard();

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it('debería hacer fetch si la caché expiró (más de 15 minutos)', async () => {
      const expired = { data: mockStats, timestamp: Date.now() - 16 * 60 * 1000 };
      localStorage.setItem('itapu_dashboard_stats', JSON.stringify(expired));
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockStats });

      await statsApi.getDashboard();

      expect(apiClient.get).toHaveBeenCalledWith('/admin/stats/dashboard');
    });

    it('debería ignorar la caché y hacer fetch si forceRefresh es true', async () => {
      const cached = { data: mockStats, timestamp: Date.now() };
      localStorage.setItem('itapu_dashboard_stats', JSON.stringify(cached));
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockStats });

      await statsApi.getDashboard(true);

      expect(apiClient.get).toHaveBeenCalledWith('/admin/stats/dashboard');
    });
  });

  describe('clearCache', () => {
    it('debería eliminar la entrada de caché de localStorage', () => {
      localStorage.setItem('itapu_dashboard_stats', JSON.stringify({ data: mockStats, timestamp: Date.now() }));

      statsApi.clearCache();

      expect(localStorage.getItem('itapu_dashboard_stats')).toBeNull();
    });
  });
});