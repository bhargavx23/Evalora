import { api } from '../api/client';

export const walletService = {
  async createQrAuthSession() {
    const res = await api.post('/wallet/qr-session');
    return res.data;
  },

  async pollQrAuthSession(sessionId: string) {
    const res = await api.get(`/wallet/qr-session/${sessionId}`);
    return res.data;
  },

  async approveQrAuthSession(sessionId: string, payload: {
    walletAddress: string;
    signature: string;
    walletProvider?: string;
  }) {
    const res = await api.post(`/wallet/qr-session/${sessionId}/approve`, payload);
    return res.data;
  },

  async linkWallet(payload: {
    walletAddress: string;
    signature: string;
    challenge: string;
    walletProvider?: string;
  }) {
    const res = await api.post('/wallet/link', payload);
    return res.data;
  },

  async unlinkWallet(walletAddress: string) {
    const res = await api.delete(`/wallet/${walletAddress}`);
    return res.data;
  },
};
