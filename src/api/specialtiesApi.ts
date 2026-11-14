import { apiClient } from './client';
import { SpecialtyResponse, CreateSpecialtyPayload } from '@/types/api.types';

export const specialtiesApi = {
  findAll: async (): Promise<SpecialtyResponse[]> => {
    const { data } = await apiClient.get<SpecialtyResponse[]>('/admin/specialties');
    return data;
  },
  create: async (payload: CreateSpecialtyPayload): Promise<SpecialtyResponse> => {
    const { data } = await apiClient.post<SpecialtyResponse>('/admin/specialties', payload);
    return data;
  },
  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/specialties/${id}`);
  },
};