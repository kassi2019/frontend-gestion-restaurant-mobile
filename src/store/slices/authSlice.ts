import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ModuleInfo { id: number; nom: string; icon: string; route: string; }

interface User {
  id: number;
  nom: string;
  telephone: string;
  role: string;
  photo?: string;
  restaurantId: number;
  devise?: string;
  restaurantNom?: string;
  restaurantTelephone?: string;
  typeAbonnement?: string;
  dateFinAbonnement?: string | null;
  modeGestion?: string;
  modules?: ModuleInfo[];
  abonnementExpire?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  abonnementExpire: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
  abonnementExpire: false,
};

export const login = createAsyncThunk(
  'auth/login',

  async (credentials: { telephone: string; mot_de_passe: string }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(credentials);
      try {
        const userWithFlag = { ...data.utilisateur, abonnementExpire: data.abonnementExpire || false };
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(userWithFlag));
        await AsyncStorage.setItem('abonnementExpire', JSON.stringify(data.abonnementExpire || false));
      } catch (e) {
        // AsyncStorage indisponible
      }
      return data;
    } catch (err: any) {
      if (err.response) {
        const message = err.response.data?.message || `Erreur serveur (${err.response.status})`;
        return rejectWithValue(message);
      }
      if (err.code === 'ECONNABORTED') return rejectWithValue('Délai de connexion dépassé');
      if (err.message) return rejectWithValue(`Réseau: ${err.message}`);
      return rejectWithValue('Erreur de connexion');
    }
  },
);

export const restoreSession = createAsyncThunk('auth/restore', async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    const userStr = await AsyncStorage.getItem('user');
    const abonnementExpireStr = await AsyncStorage.getItem('abonnementExpire');
    if (token && userStr) {
      const user = JSON.parse(userStr);
      return { token, utilisateur: user, abonnementExpire: abonnementExpireStr === 'true' };
    }
  } catch (e) {
    // AsyncStorage indisponible
  }
  throw new Error('Aucune session');
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.abonnementExpire = false;
      try { AsyncStorage.removeItem('token'); AsyncStorage.removeItem('user'); AsyncStorage.removeItem('abonnementExpire'); } catch (e) {}
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
      try { AsyncStorage.setItem('user', JSON.stringify(state.user)); } catch (e) {}
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = { ...action.payload.utilisateur, abonnementExpire: action.payload.abonnementExpire || false };
        state.abonnementExpire = action.payload.abonnementExpire || false;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.utilisateur;
        state.abonnementExpire = action.payload.abonnementExpire || false;
      });
  },
});

export const { logout, updateUser, clearError } = authSlice.actions;

export const selectDevise = (state: { auth: AuthState }) => state.auth.user?.devise || '€';

export function formatPrixDevise(montant: number | string, devise?: string | null, decimals = 2) {
  const d = devise || '€';
  const n = Number(montant);
  if (isNaN(n)) return `0.${'0'.repeat(decimals)} ${d}`;
  return `${n.toFixed(decimals)} ${d}`;
}

export default authSlice.reducer;
