import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401 if:
    // 1. User was previously authenticated (has token)
    // 2. It's not a login/register request
    const isAuthRequest = error.config?.url?.includes('/auth/login') || 
                          error.config?.url?.includes('/auth/register');
    
    if (error.response?.status === 401 && !isAuthRequest) {
      const hadToken = localStorage.getItem('token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Only redirect if user was logged in before (token expired/invalid)
      if (hadToken) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
