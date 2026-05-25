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
import { commandesApi } from '../services/api';
import { getSocket } from '../services/socket';

export default function DashboardScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState({
    totalTables: 0,
    totalCommandes: 0,
    enAttente: 0,
    validees: 0,
    enPreparation: 0,
    pretes: 0,
    servies: 0,
    payees: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const loadStats = async () => {
    try {
      const { data } = await commandesApi.getStats();
      setStats(data);
    } catch (err) {}
  };

  useEffect(() => {
    loadStats();

    // Actualisation automatique via socket
    const socket = getSocket();
    if (socket) {
      const refresh = () => loadStats();
      socket.on('nouvelle_commande', refresh);
      socket.on('commande_status_change', refresh);
      return () => {
        socket.off('nouvelle_commande', refresh);
        socket.off('commande_status_change', refresh);
      };
    }
  }, []);

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

  const commandeCards = [
    { title: 'En attente', value: stats.enAttente, icon: '⏳', color: Colors.warning },
    { title: 'Validées', value: stats.validees, icon: '✅', color: Colors.success },
    { title: 'En prépa.', value: stats.enPreparation, icon: '👨‍🍳', color: Colors.accent },
    { title: 'Prêtes', value: stats.pretes, icon: '🍽', color: Colors.primary },
    { title: 'Servies', value: stats.servies, icon: '📋', color: Colors.secondary },
  ];

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

      {/* Commandes Cards */}
      <Text style={styles.sectionTitle}>Commandes du jour</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={styles.statsScrollContent}
      >
        {commandeCards.map((card, i) => (
          <StatCard key={i} title={card.title} value={card.value} icon={card.icon} color={card.color} />
        ))}
      </ScrollView>

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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  tableCardRow: {
    paddingHorizontal: 14,
  },
  statsScroll: {
    flexGrow: 0,
  },
  statsScrollContent: {
    paddingHorizontal: 14,
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
