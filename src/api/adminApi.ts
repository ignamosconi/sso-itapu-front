import { apiClient } from './client';
import {
  AdminResponse,
  OAuthClientResponse,
  OAuthClientCreatedResponse,
  CreateAdminPayload,
  UpdateAdminPayload,
  CreateOAuthClientPayload,
  UpdateOAuthClientPayload,
  SendCredentialsEmailPayload,
} from '@/types/api.types';

export const adminsApi = {
  findAll: async (): Promise<AdminResponse[]> => {
    const { data } = await apiClient.get<AdminResponse[]>('/admin/admins');
    return data;
  },

  findOne: async (id: string): Promise<AdminResponse> => {
    const { data } = await apiClient.get<AdminResponse>(`/admin/admins/${id}`);
    return data;
  },

  create: async (payload: CreateAdminPayload): Promise<AdminResponse> => {
    const { data } = await apiClient.post<AdminResponse>('/admin/admins', payload);
    return data;
  },

  updateSelf: async (payload: UpdateAdminPayload): Promise<AdminResponse> => {
    const { data } = await apiClient.patch<AdminResponse>('/admin/admins/me', payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/admins/${id}`);
  },
};

export const oauthClientsApi = {
  findAll: async (): Promise<OAuthClientResponse[]> => {
    const { data } = await apiClient.get<OAuthClientResponse[]>('/admin/clients');
    return data;
  },

  findOne: async (id: number): Promise<OAuthClientResponse> => {
    const { data } = await apiClient.get<OAuthClientResponse>(`/admin/clients/${id}`);
    return data;
  },

  // Devuelve OAuthClientCreatedResponse — incluye plainSecret una sola vez
  create: async (payload: CreateOAuthClientPayload): Promise<OAuthClientCreatedResponse> => {
    const { data } = await apiClient.post<OAuthClientCreatedResponse>('/admin/clients', payload);
    return data;
  },

  update: async (id: number, payload: UpdateOAuthClientPayload): Promise<OAuthClientResponse> => {
    const { data } = await apiClient.patch<OAuthClientResponse>(`/admin/clients/${id}`, payload);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/clients/${id}`);
  },

  // Devuelve OAuthClientCreatedResponse — incluye plainSecret una sola vez
  regenerateSecret: async (id: number): Promise<OAuthClientCreatedResponse> => {
    const { data } = await apiClient.post<OAuthClientCreatedResponse>(
      `/admin/clients/${id}/regenerate-secret`,
    );
    return data;
  },

  // plainSecret debe pasarse desde la respuesta de create o regenerateSecret
  sendCredentialsByEmail: async (id: number, payload: SendCredentialsEmailPayload): Promise<void> => {
    await apiClient.post(`/admin/clients/${id}/send-credentials`, payload);
  },

  suspend: async (id: number): Promise<OAuthClientResponse> => {
    const { data } = await apiClient.patch<OAuthClientResponse>(`/admin/clients/${id}/suspend`);
    return data;
  },

  activate: async (id: number): Promise<OAuthClientResponse> => {
    const { data } = await apiClient.patch<OAuthClientResponse>(`/admin/clients/${id}/activate`);
    return data;
  },
};