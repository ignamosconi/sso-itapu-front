import { apiClient } from './client';
import { DomainRoleResponse, CreateDomainRolePayload } from '@/types/api.types';

export const rolesApi = {
  findAll: async (): Promise<DomainRoleResponse[]> => {
    const { data } = await apiClient.get<DomainRoleResponse[]>('/admin/domain-roles');
    return data;
  },
  create: async (payload: CreateDomainRolePayload): Promise<DomainRoleResponse> => {
    const { data } = await apiClient.post<DomainRoleResponse>('/admin/domain-roles', payload);
    return data;
  },
  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/domain-roles/${id}`);
  },
};