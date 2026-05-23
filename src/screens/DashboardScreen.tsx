import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import StatCard from '../components/StatCard';
import { tablesApi, commandesApi } from '../services/api';

export default function DashboardScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState({ tables: 0, commandes: 0, serveurs: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const [tablesRes, commandesRes] = await Promise.all([
        tablesApi.getAll(),
        commandesApi.getByServeur(),
      ]);
      setStats({
        tables: tablesRes.data.length,
        commandes: commandesRes.data.length,
        serveurs: 0,
      });
    } catch (err) {}
  };

  useEffect(() => { loadStats(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrateur',
    MANAGER: 'Manager',
    SERVEUR: 'Serveur',
    CUISINE: 'Cuisine',
    BAR: 'Bar',
    CAISSIER: 'Caissier',
  };

  const menuItems = [
    { icon: '🪑', label: 'Mes Tables', screen: 'Tables', roles: ['SERVEUR', 'ADMIN', 'MANAGER'] },
    { icon: '📋', label: 'Commandes', screen: 'Commandes', roles: ['SERVEUR', 'ADMIN', 'MANAGER'] },
    { icon: '🍳', label: 'Cuisine', screen: 'Commandes', roles: ['CUISINE'] },
    { icon: '🍹', label: 'Bar', screen: 'Commandes', roles: ['BAR'] },
    { icon: '🍽', label: 'Menu', screen: 'Menu', roles: ['ADMIN', 'MANAGER'] },
    { icon: '📅', label: 'Planning', screen: 'Planning', roles: ['ADMIN', 'MANAGER', 'SERVEUR'] },
    { icon: '👥', label: 'Utilisateurs', screen: 'Users', roles: ['ADMIN', 'MANAGER'] },
    { icon: '💳', label: 'Caisse', screen: 'Cashier', roles: ['ADMIN', 'MANAGER', 'CAISSIER'] },
    { icon: '📊', label: 'Statistiques', screen: 'Stats', roles: ['ADMIN', 'MANAGER'] },
    { icon: '🔔', label: 'Notifications', screen: 'Notifications', roles: ['ADMIN', 'MANAGER', 'SERVEUR', 'CUISINE', 'BAR', 'CAISSIER'] },
  ];

  const filteredMenu = menuItems.filter((item) => item.roles.includes(user?.role || ''));

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour, {user?.nom || 'Employé'} 👋</Text>
          <Text style={styles.role}>{roleLabels[user?.role || ''] || user?.role}</Text>
        </View>
        <TouchableOpacity style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.nom || 'U').charAt(0).toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <StatCard title="Tables" value={stats.tables} icon="🪑" color={Colors.primary} />
        <StatCard title="Commandes" value={stats.commandes} icon="📋" color={Colors.accent} />
        <StatCard title="Serveurs" value={stats.serveurs} icon="👤" color={Colors.success} />
      </View>

      {/* Menu Grid */}
      <Text style={styles.sectionTitle}>Accès Rapide</Text>
      <View style={styles.menuGrid}>
        {filteredMenu.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconBox}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  role: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.textWhite,
    fontSize: 22,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    marginBottom: 30,
  },
  menuItem: {
    width: '30%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    margin: '1.5%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  menuIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  menuIcon: {
    fontSize: 24,
  },
  menuLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
});
