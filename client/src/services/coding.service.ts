import { api } from '../api/client';

export interface CodeExecutionPayload {
  code: string;
  language: string;
  stdin?: string;
  timeLimit?: number;
}

export interface CodeTestPayload {
  code: string;
  language: string;
  questionId: string;
}

export const codingService = {
  async runCustomCode(payload: CodeExecutionPayload) {
    const res = await api.post('/practice/execute', payload);
    return res.data;
  },

  async testCodeAgainstQuestion(payload: CodeTestPayload) {
    const res = await api.post('/practice/test-code', payload);
    return res.data;
  },
};
