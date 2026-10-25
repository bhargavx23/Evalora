import { api } from '../api/client';

export interface OtpRequestPayload {
  email: string;
  intent?: 'login' | 'register' | 'account_access';
}

export interface OtpLoginPayload {
  email: string;
  otp: string;
  role?: string;
  collegeName?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password?: string;
  collegeId?: string;
  role?: string;
  graduationYear?: number;
  degree?: string;
  branch?: string;
}

export const authService = {
  async requestOtp(payload: OtpRequestPayload) {
    const res = await api.post('/auth/otp/request', payload);
    return res.data;
  },

  async loginWithOtp(payload: OtpLoginPayload) {
    const res = await api.post('/auth/otp/login', payload);
    return res.data;
  },

  async loginWithPassword(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },

  async register(payload: RegisterPayload) {
    const res = await api.post('/auth/register', payload);
    return res.data;
  },

  async requestPeraChallenge(walletAddress: string) {
    const res = await api.post('/auth/pera/challenge', { walletAddress });
    return res.data;
  },

  async verifyPeraLogin(walletAddress: string, signature: string, challenge: string) {
    const res = await api.post('/auth/pera/verify', {
      walletAddress,
      signature,
      challenge,
    });
    return res.data;
  },

  async getCurrentUser() {
    const res = await api.get('/auth/me');
    return res.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('evalora_token');
    }
  },
};
