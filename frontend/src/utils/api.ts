import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const getPortfolio = async () => {
  const response = await api.get('/portfolio');
  return response.data;
};

export const getCV = async () => {
  const response = await api.get('/cv');
  return response.data;
};

export const submitContact = async (data: { name: string; email: string; message: string }) => {
  const response = await api.post('/contact', data);
  return response.data;
};

export default api;
