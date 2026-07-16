import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('af_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('af_token');
      localStorage.removeItem('af_user');
      if (!window.location.pathname.startsWith('/public') && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export function apiErrorMessage(err, fallback = 'Произошла ошибка. Попробуйте снова.') {
  return err?.response?.data?.error || fallback;
}
