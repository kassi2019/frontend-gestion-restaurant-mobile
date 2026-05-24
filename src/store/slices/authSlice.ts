import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: number;
  nom: string;
  telephone: string;
  role: string;
  photo?: string;
  restaurantId: number;
  devise?: string;
  restaurantNom?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  
  async (credentials: { telephone: string; mot_de_passe: string }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(credentials);
      try {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.utilisateur));
      } catch (e) {
        // AsyncStorage indisponible
      }
      return data;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Erreur de connexion';
      return rejectWithValue(message);
    }
  },
);

export const restoreSession = createAsyncThunk('auth/restore', async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    const userStr = await AsyncStorage.getItem('user');
    if (token && userStr) {
      return { token, utilisateur: JSON.parse(userStr) };
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
      try { AsyncStorage.removeItem('token'); AsyncStorage.removeItem('user'); } catch (e) {}
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
        state.user = action.payload.utilisateur;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.utilisateur;
      });
  },
});

export const { logout, clearError } = authSlice.actions;

export const selectDevise = (state: { auth: AuthState }) => state.auth.user?.devise || '€';

export function formatPrixDevise(montant: number | string, devise?: string | null, decimals = 2) {
  const d = devise || '€';
  return `${Number(montant).toFixed(decimals)} ${d}`;
}

export default authSlice.reducer;
