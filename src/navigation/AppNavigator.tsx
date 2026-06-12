import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector, useDispatch } from 'react-redux';
import Toast from 'react-native-toast-message';
import { RootState, AppDispatch } from '../store';
import { restoreSession, logout } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TablesScreen from '../screens/TablesScreen';
import CommandesScreen from '../screens/CommandesScreen';
import MenuScreen from '../screens/MenuScreen';
import PlanningScreen from '../screens/PlanningScreen';
import UsersScreen from '../screens/UsersScreen';
import CashierScreen from '../screens/CashierScreen';
import StatsScreen from '../screens/StatsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RestaurantSettingsScreen from '../screens/RestaurantSettingsScreen';
import AssignTablesScreen from '../screens/AssignTablesScreen';
import StockScreen from '../screens/StockScreen';
import ReceptionnisteScreen from '../screens/ReceptionnisteScreen';
import ReservationsScreen from '../screens/ReservationsScreen';
import LivraisonsScreen from '../screens/LivraisonsScreen';
import EvaluationsScreen from '../screens/EvaluationsScreen';
import GenerateCodesScreen from '../screens/GenerateCodesScreen';
import DashboardAdminScreen from '../screens/DashboardAdminScreen';
import HistoriqueAbonnementScreen from '../screens/HistoriqueAbonnementScreen';
import RestaurantModulesScreen from '../screens/RestaurantModulesScreen';
import { SERVER_URL } from '../config';
import { connectSocket, disconnectSocket } from '../services/socket';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Accueil: '🏠',
  Tables: '🪑',
  Commandes: '📋',
  Menu: '🍽',
  Planning: '📅',
  Users: '👥',
  Notifications: '🔔',
};

const SERVER = SERVER_URL;

const TAB_MODULE_NAMES: Record<string, string> = {
  Tables: 'Tables',
  Commandes: 'Commandes',
  Menu: 'Menu',
  Planning: 'Planning',
  Users: 'Users',
  Notifications: 'Notifications',
};

function MainTabs() {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const user = useSelector((state: RootState) => state.auth.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const photoUri = user?.photo
    ? (user.photo.startsWith('http') ? user.photo : SERVER + user.photo)
    : null;

  // Modules auxquels l'utilisateur a accès (nom des modules)
  const userModuleNames = new Set(user?.modules?.map(m => m.nom) || []);

  // Un onglet est visible si l'utilisateur a le module correspondant, ou si c'est l'Accueil
  const isTabVisible = (tabName: string) => {
    if (tabName === 'Accueil') return true;
    if (isSuperAdmin) return true;
    const moduleName = TAB_MODULE_NAMES[tabName];
    return moduleName ? userModuleNames.has(moduleName) : true;
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: Colors.surface },
        headerTitleStyle: { color: Colors.text, fontWeight: '700' },
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.headerAvatar}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.headerAvatarImg} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarText}>
                  {user?.nom?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => dispatch(logout())}
            style={{
              marginRight: 12,
              paddingHorizontal: 14,
              paddingVertical: 8,
              backgroundColor: Colors.danger,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              shadowColor: Colors.danger,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <Text style={{ fontSize: 14, color: '#fff' }}>🚪</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>Quitter</Text>
          </TouchableOpacity>
        ),
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>
            {TAB_ICONS[route.name] || '📌'}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Accueil" component={isSuperAdmin ? DashboardAdminScreen : DashboardScreen} />
      {isTabVisible('Tables') && <Tab.Screen name="Tables" component={TablesScreen} />}
      {isTabVisible('Commandes') && <Tab.Screen name="Commandes" component={CommandesScreen} />}
      {isTabVisible('Menu') && <Tab.Screen name="Menu" component={MenuScreen} />}
      {isTabVisible('Planning') && <Tab.Screen name="Planning" component={PlanningScreen} />}
      {isTabVisible('Users') && <Tab.Screen name="Users" component={UsersScreen} options={{ tabBarLabel: 'Users' }} />}
      {isTabVisible('Notifications') && <Tab.Screen name="Notifications" component={NotificationsScreen} />}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useSelector((state: RootState) => state.auth);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    dispatch(restoreSession()).finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (token) {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, [token]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <Text style={{ fontSize: 36 }}>🍽</Text>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Cashier" component={CashierScreen} options={{ headerShown: true, headerTitle: 'Caisse', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="Stats" component={StatsScreen} options={{ headerShown: true, headerTitle: 'Statistiques', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, headerTitle: 'Mon Profil', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="RestaurantSettings" component={RestaurantSettingsScreen} options={{ headerShown: true, headerTitle: 'Paramètres Restaurant', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="AssignTables" component={AssignTablesScreen} options={{ headerShown: true, headerTitle: 'Affecter les tables', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="Stock" component={StockScreen} options={{ headerShown: true, headerTitle: '📦 Gestion de Stock', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="Reception" component={ReceptionnisteScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Reservations" component={ReservationsScreen} options={{ headerShown: true, headerTitle: '🪑 Réservations', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="Livraisons" component={LivraisonsScreen} options={{ headerShown: true, headerTitle: '🚚 Livraisons', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="Evaluations" component={EvaluationsScreen} options={{ headerShown: true, headerTitle: '⭐ Avis clients', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="GenerateCodes" component={GenerateCodesScreen} options={{ headerShown: true, headerTitle: 'Générer des codes', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="DashboardAdmin" component={DashboardAdminScreen} options={{ headerShown: true, headerTitle: 'Tableau de bord', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="HistoriqueAbonnement" component={HistoriqueAbonnementScreen} options={{ headerShown: true, headerTitle: 'Historique abonnement', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
            <Stack.Screen name="RestaurantModules" component={RestaurantModulesScreen} options={{ headerShown: true, headerTitle: '🧩 Modules Restaurant', headerStyle: { backgroundColor: Colors.surface }, headerTitleStyle: { color: Colors.text, fontWeight: '700' }, headerTintColor: Colors.primary }} />
          </>
        )}
      </Stack.Navigator>
      <Toast />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerAvatar: { marginLeft: 12 },
  headerAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarPlaceholder: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.primary + '40',
  },
  headerAvatarText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
});
