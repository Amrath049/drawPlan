import api from './client';
import type { Board, DrawElement } from '../types';

export const boardsApi = {
  list: (): Promise<Board[]> => api.get('/boards').then((r) => r.data),

  create: (name: string): Promise<Board> =>
    api.post('/boards', { name }).then((r) => r.data),

  get: (id: string): Promise<Board> =>
    api.get(`/boards/${id}`).then((r) => r.data),

  update: (id: string, data: { name?: string; elements?: DrawElement[] }): Promise<Board> =>
    api.put(`/boards/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/boards/${id}`).then((r) => r.data),
};

export const authApi = {
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }).then((r) => r.data),

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
};
