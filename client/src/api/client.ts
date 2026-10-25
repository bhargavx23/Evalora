import axios from 'axios';

const baseURL = (import.meta as any).env?.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach token from localStorage if present
api.interceptors.request.use(config => {
  const token = localStorage.getItem('evalora_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 unauthorized globally
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      window.dispatchEvent(new Event('evalora:unauthorized'));
    }
    return Promise.reject(error);
  }
);
