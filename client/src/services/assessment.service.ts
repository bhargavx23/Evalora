import { api } from '../api/client';

export const assessmentService = {
  async getAssessments() {
    const res = await api.get('/assessments');
    return res.data;
  },

  async getAssessmentById(id: string) {
    const res = await api.get(`/assessments/${id}`);
    return res.data;
  },

  async startAttempt(id: string) {
    const res = await api.post(`/assessments/${id}/start`);
    return res.data;
  },

  async submitAttempt(id: string, payload: any) {
    const res = await api.post(`/assessments/${id}/submit`, payload);
    return res.data;
  },

  async getAttemptResults(attemptId: string) {
    const res = await api.get(`/assessments/attempts/${attemptId}`);
    return res.data;
  },
};
