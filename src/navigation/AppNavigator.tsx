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

const API_URL = 'http://192.168.1.7:3000';

function MainTabs() {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const user = useSelector((state: RootState) => state.auth.user);
  const photoUri = user?.photo
    ? (user.photo.startsWith('http') ? user.photo : API_URL + user.photo)
    : null;

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
      <Tab.Screen name="Accueil" component={DashboardScreen} />
      <Tab.Screen name="Tables" component={TablesScreen} />
      <Tab.Screen name="Commandes" component={CommandesScreen} />
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Planning" component={PlanningScreen} />
      <Tab.Screen name="Users" component={UsersScreen} options={{ tabBarLabel: 'Users' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
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
