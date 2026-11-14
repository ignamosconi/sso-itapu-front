import { apiClient } from './client';
import {
  StudentResponse, CreateStudentPayload, UpdateStudentPayload,
  DeleteStudentPayload, StudentFilters, PaginatedStudentsResponse,
  ImportPreviewResult, ImportConfirmPayload, ImportConfirmResult,
} from '@/types/api.types';

export const studentsApi = {
  findAll: async (filters?: StudentFilters): Promise<PaginatedStudentsResponse> => {
    const { data } = await apiClient.get<PaginatedStudentsResponse>('/admin/students', { params: filters });
    return data;
  },
  findOne: async (id: string): Promise<StudentResponse> => {
    const { data } = await apiClient.get<StudentResponse>(`/admin/students/${id}`);
    return data;
  },
  create: async (payload: CreateStudentPayload): Promise<StudentResponse> => {
    const { data } = await apiClient.post<StudentResponse>('/admin/students', payload);
    return data;
  },
  update: async (id: string, payload: UpdateStudentPayload): Promise<StudentResponse> => {
    const { data } = await apiClient.patch<StudentResponse>(`/admin/students/${id}`, payload);
    return data;
  },
  remove: async (id: string, payload: DeleteStudentPayload): Promise<void> => {
    await apiClient.delete(`/admin/students/${id}`, { data: payload });
  },
  suspend: async (id: string): Promise<StudentResponse> => {
    const { data } = await apiClient.patch<StudentResponse>(`/admin/students/${id}/suspend`);
    return data;
  },
  activate: async (id: string): Promise<StudentResponse> => {
    const { data } = await apiClient.patch<StudentResponse>(`/admin/students/${id}/activate`);
    return data;
  },
  importPreview: async (file: File): Promise<ImportPreviewResult> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post<ImportPreviewResult>('/admin/students/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  importConfirm: async (payload: ImportConfirmPayload): Promise<ImportConfirmResult> => {
    const { data } = await apiClient.post<ImportConfirmResult>('/admin/students/import/confirm', payload);
    return data;
  },

  resendWelcome: async (id: string): Promise<void> => {
    await apiClient.post(`/admin/students/${id}/resend-welcome`);
  },

  downloadExampleXlsx: async (): Promise<void> => {
    const response = await apiClient.get('/admin/students/import/example', {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ejemplo-carga-masiva.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};