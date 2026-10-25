import { api } from '../api/client';

export interface PaymentIntentPayload {
  planId: string;
  senderWalletAddress?: string;
  currency?: string;
}

export interface PaymentVerifyPayload {
  intentId: string;
  transactionId: string;
}

export const paymentService = {
  async createIntent(payload: PaymentIntentPayload) {
    const res = await api.post('/payment/intent', payload);
    return res.data;
  },

  async verifyPayment(payload: PaymentVerifyPayload) {
    const res = await api.post('/payment/verify', payload);
    return res.data;
  },

  async getIntentStatus(intentId: string) {
    const res = await api.get(`/payment/intent/${intentId}`);
    return res.data;
  },

  async getHistory() {
    const res = await api.get('/payment/history');
    return res.data;
  },
};
