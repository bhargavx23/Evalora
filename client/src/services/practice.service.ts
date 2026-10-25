import { api } from '../api/client';

export interface PracticeConfigPayload {
  mode: 'custom' | 'adaptive';
  topics: string[];
  difficulties: string[];
  questionCount: number;
  timeLimitMinutes?: number;
  forceAIGeneration?: boolean;
}

export const practiceService = {
  async createSession(config: PracticeConfigPayload) {
    const res = await api.post('/practice/session', config);
    return res.data;
  },

  async getSession(sessionId: string) {
    const res = await api.get(`/practice/${sessionId}`);
    return res.data;
  },

  async saveResponse(sessionId: string, payload: {
    questionId: string;
    selectedOptions?: string[];
    codeSubmission?: {
      code: string;
      language: string;
      passedCount?: number;
      totalCount?: number;
    };
    timeSpentSeconds?: number;
  }) {
    const res = await api.post(`/practice/${sessionId}/save`, payload);
    return res.data;
  },

  async submitSession(sessionId: string, payload?: any) {
    const res = await api.post(`/practice/${sessionId}/submit`, payload || {});
    return res.data;
  },

  async getHistory() {
    const res = await api.get('/practice/history');
    return res.data;
  },

  async getSkillProfile() {
    const res = await api.get('/practice/skills');
    return res.data;
  },
};
