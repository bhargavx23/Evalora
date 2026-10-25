import { api } from '../api/client';

export const adminService = {
  async getStats() {
    const res = await api.get('/admin/stats');
    return res.data;
  },

  async getUsers(params?: { role?: string; search?: string; page?: number; limit?: number }) {
    const res = await api.get('/admin/users', { params });
    return res.data;
  },

  async updateUserRole(userId: string, role: string) {
    const res = await api.put(`/admin/users/${userId}/role`, { role });
    return res.data;
  },

  async getColleges() {
    const res = await api.get('/colleges');
    return res.data;
  },

  async getDepartments() {
    const res = await api.get('/departments');
    return res.data;
  },

  async getAuditLogs(params?: any) {
    const res = await api.get('/admin/audit-logs', { params });
    return res.data;
  },
};
