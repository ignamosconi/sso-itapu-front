import { apiClient } from './client';

export interface SpecialtyCount {
  specialty: string;
  count: number;
}

export interface DashboardStats {
  oauthClientCount: number;
  studentCount: number;
  studentsBySpecialty: SpecialtyCount[];
}

const CACHE_KEY = 'itapu_dashboard_stats';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

interface CachedStats {
  data: DashboardStats;
  timestamp: number;
}

export const statsApi = {
  getDashboard: async (forceRefresh = false): Promise<DashboardStats> => {
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as CachedStats;
          if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
            return parsed.data;
          }
        }
      } catch { /* localStorage no disponible */ }
    }

    const { data } = await apiClient.get<DashboardStats>('/admin/stats/dashboard');

    try {
      const toCache: CachedStats = { data, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
    } catch { /* ignorado */ }

    return data;
  },

  clearCache: () => {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignorado */ }
  },
};