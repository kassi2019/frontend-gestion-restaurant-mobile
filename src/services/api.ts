import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../store';

const API_URL = 'http://192.168.1.7:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  // Priorité au store Redux (ne dépend pas des modules natifs)
  let token = store.getState().auth.token;
  // Fallback sur AsyncStorage si le store est vide (après kill de l'app)
  if (!token) {
    try {
      token = await AsyncStorage.getItem('token');
    } catch (e) {
      // AsyncStorage indisponible
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      AsyncStorage.removeItem('token');
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: (data: { telephone: string; mot_de_passe: string }) =>
    api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
  forgotPassword: (data: { telephone: string; newPassword: string }) =>
    api.post('/auth/forgot-password', data),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    api.patch('/auth/password', data),
  updateProfile: (data: { nom?: string; photo?: string }) =>
    api.patch('/auth/profile', data),
  uploadPhoto: (formData: FormData) =>
    api.post('/auth/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const menuApi = {
  getPublic: (restaurantId: number) =>
    api.get(`/menu/public/${restaurantId}`),
  getCategories: () => api.get('/menu/categories'),
  createCategorie: (data: any) => api.post('/menu/categories', data),
  getMenus: () => api.get('/menu'),
  createMenu: (data: any) => api.post('/menu', data),
  updateMenu: (id: number, data: any) => api.patch(`/menu/${id}`, data),
  deleteMenu: (id: number) => api.delete(`/menu/${id}`),
  toggleDisponibilite: (id: number) => api.patch(`/menu/${id}/toggle`),
  uploadImage: (id: number, formData: FormData) =>
    api.post(`/menu/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const tablesApi = {
  getAll: () => api.get('/tables'),
  getByServeur: () => api.get('/tables/serveur'),
  create: (data: any) => api.post('/tables', data),
  update: (id: number, data: { numero?: string; zone?: string }) =>
    api.patch(`/tables/${id}`, data),
  delete: (id: number) => api.delete(`/tables/${id}`),
  assignServeur: (id: number, serveurId: number) =>
    api.patch(`/tables/${id}/assign`, { serveurId }),
  updateStatut: (id: number, statut: string) =>
    api.patch(`/tables/${id}/statut`, { statut }),
  getQrCode: (id: number) => api.get(`/tables/${id}/qrcode`),
};

export const serveurTablesApi = {
  getAll: () => api.get('/serveur-tables'),
  findByServeur: () => api.get('/serveur-tables/serveur'),
  findByTable: (tableId: number) => api.get(`/serveur-tables/table/${tableId}`),
  assign: (data: { utilisateurId: number; tableId: number }) =>
    api.post('/serveur-tables', data),
  assignBulk: (data: { utilisateurId: number; tableIds: number[] }) =>
    api.post('/serveur-tables/bulk', data),
  unassign: (tableId: number) => api.delete(`/serveur-tables/${tableId}`),
  reassign: (data: { fromServeurId: number; toServeurId: number; tableId?: number }) =>
    api.patch('/serveur-tables/reassign', data),
  runDailyCheck: () => api.post('/serveur-tables/run-check'),
};

export const commandesApi = {
  getAll: () => api.get('/commandes'),
  getByServeur: () => api.get('/commandes/serveur'),
  getByTable: (tableId: number) => api.get(`/commandes/table/${tableId}`),
  getByCuisine: () => api.get('/commandes/cuisine'),
  getByBar: () => api.get('/commandes/bar'),
  getStats: () => api.get('/commandes/stats'),
  updateStatut: (id: number, statut: string) =>
    api.patch(`/commandes/${id}/statut`, { statut }),
  updateDetailStatut: (id: number, statut: string) =>
    api.patch(`/commandes/details/${id}/statut`, { statut }),
  getBySession: (sessionId: number) => api.get(`/commandes/session/${sessionId}`),
  createFromClient: (data: any) => api.post('/commandes/client', data),
};

export const planningApi = {
  getAll: () => api.get('/planning'),
  getMine: () => api.get('/planning/mine'),
  create: (data: any) => api.post('/planning', data),
  update: (id: number, data: any) => api.patch(`/planning/${id}`, data),
  findByDate: (date: string) => api.get(`/planning/date/${date}`),
  delete: (id: number) => api.delete(`/planning/${id}`),
};

export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  markAsRead: (id: number) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
};

export const paiementApi = {
  getAPayer: () => api.get('/paiements/a-payer'),
  payer: (commandeId: number, mode: string) => api.post(`/paiements/payer/${commandeId}`, { mode }),
  getFactures: (date?: string) => api.get('/paiements/factures', { params: date ? { date } : {} }),
  getFacture: (id: number) => api.get(`/paiements/factures/${id}`),
  imprimerFacture: (id: number) => `${API_URL}/paiements/factures/${id}/imprimer`,
  getCaisseJour: () => api.get('/paiements/caisse/jour'),
  cloturerCaisse: () => api.post('/paiements/caisse/cloture'),
};

export const statistiquesApi = {
  getDashboard: () => api.get('/statistiques/dashboard'),
  getVentes: (debut?: string, fin?: string) => api.get('/statistiques/ventes', { params: { debut, fin } }),
  getPlatsPopulaires: (limit?: number) => api.get('/statistiques/plats-populaires', { params: { limit } }),
  getPerformanceServeurs: () => api.get('/statistiques/performance-serveurs'),
  getAffluence: () => api.get('/statistiques/affluence'),
};

export const restaurantApi = {
  getInfo: (id: number) => api.get(`/restaurants/${id}`),
  update: (id: number, data: { nom?: string; adresse?: string; devise?: string; telephone?: string }) =>
    api.patch(`/restaurants/${id}`, data),
};

export const usersApi = {
  getAll: () => api.get('/users'),
  findByRole: (role: string) => api.get(`/users/role/${role}`),
  update: (id: number, data: any) => api.patch(`/users/${id}`, data),
  updateStatut: (id: number, statut: string) =>
    api.patch(`/users/${id}/statut?statut=${statut}`),
};

export default api;
