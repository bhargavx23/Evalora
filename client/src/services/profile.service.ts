import { api } from '../api/client';

export const profileService = {
  async getProfile() {
    const res = await api.get('/profile');
    return res.data;
  },

  async updateProfile(payload: any) {
    const res = await api.put('/profile', payload);
    return res.data;
  },

  async uploadResume(formData: FormData) {
    const res = await api.post('/profile/resume', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async getResumeAnalysis() {
    const res = await api.get('/profile/resume/analysis');
    return res.data;
  },
};
