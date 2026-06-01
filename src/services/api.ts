import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../store';

import { SERVER_URL } from '../config';

const API_URL = `${SERVER_URL}/api`;

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
  getModules: () => api.get('/auth/modules'),
  updateUserModules: (userId: number, moduleIds: number[]) => api.post(`/auth/users/${userId}/modules`, { moduleIds }),
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
  // Abonnement
  getAbonnement: () => api.get('/auth/abonnement'),
  activerCode: (data: { telephone: string; code: string }) => api.post('/auth/activer', data),
  genererCodes: (data: { dureeJours: number; nombre: number }) =>
    api.post('/auth/generer-codes', data),
  listeCodes: () => api.get('/auth/codes'),
  supprimerCode: (id: number) => api.delete(`/auth/codes/${id}`),
  // Dashboard Super Admin
  getDashboard: () => api.get('/auth/super-dashboard'),
  getHistorique: (restaurantId: number) => api.get(`/auth/historique/${restaurantId}`),
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
  toggleDisponibleDemain: (id: number) => api.patch(`/menu/${id}/toggle-demain`),
  uploadImage: (id: number, formData: FormData) =>
    api.post(`/menu/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  importCsv: (formData: FormData) => api.post('/menu/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  // Variants
  getStocks: () => api.get('/menu/stocks'),
  updateStock: (id: number, stock: number) => api.patch(`/menu/${id}/stock`, { stock }),
  getVariants: (menuId: number) => api.get(`/menu/${menuId}/variants`),
  addVariant: (menuId: number, data: { nom: string; prix: number }) => api.post(`/menu/${menuId}/variants`, data),
  updateVariant: (variantId: number, data: { nom?: string; prix?: number }) => api.patch(`/menu/variants/${variantId}`, data),
  deleteVariant: (variantId: number) => api.delete(`/menu/variants/${variantId}`),
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
  toutPret: (tableId: number, destination: string) =>
    api.post('/commandes/tout-pret', { tableId, destination }),
  rechercher: (term: string) => api.get(`/commandes/recherche/${term}`),
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
  getAll: (date?: string) => api.get('/notifications', { params: date ? { date } : {} }),
  markAsRead: (id: number) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
};

export const paiementApi = {
  getAPayer: () => api.get('/paiements/a-payer'),
  payer: (commandeId: number, mode: string) => api.post(`/paiements/payer/${commandeId}`, { mode }),
  getFactures: (date?: string) => api.get('/paiements/factures', { params: date ? { date } : {} }),
  getFacture: (id: number) => api.get(`/paiements/factures/${id}`),
  imprimerFacture: (id: number) => {
    const token = store.getState().auth.token || '';
    return `${API_URL}/paiements/factures/${id}/imprimer?token=${token}`;
  },
  getCaisseJour: () => api.get('/paiements/caisse/jour'),
  cloturerCaisse: () => api.post('/paiements/caisse/cloture'),
  cloturerCaisseGlobale: (dateReouverture: string) =>
    api.post('/paiements/caisse/cloture-globale', { dateReouverture }),
  getHistoriqueClotures: (date?: string) =>
    api.get('/paiements/caisse/clotures', { params: date ? { date } : {} }),
  getStatutRestaurant: (id: number) => api.get(`/paiements/caisse/statut-restaurant/${id}`),
};

export const statistiquesApi = {
  getDashboard: (debut?: string, fin?: string) =>
    api.get('/statistiques/dashboard', { params: { debut, fin } }),
  getVentes: (debut?: string, fin?: string) =>
    api.get('/statistiques/ventes', { params: { debut, fin } }),
  getPlatsPopulaires: (limit?: number, debut?: string, fin?: string) =>
    api.get('/statistiques/plats-populaires', { params: { limit, debut, fin } }),
  getPerformanceServeurs: (debut?: string, fin?: string) =>
    api.get('/statistiques/performance-serveurs', { params: { debut, fin } }),
  getAffluence: (debut?: string, fin?: string) =>
    api.get('/statistiques/affluence', { params: { debut, fin } }),
  getPerformanceCaissiers: (debut?: string, fin?: string) =>
    api.get('/statistiques/performance-caissiers', { params: { debut, fin } }),
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
