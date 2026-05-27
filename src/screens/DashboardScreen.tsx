import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import StatCard from '../components/StatCard';
import { commandesApi } from '../services/api';
import { getSocket } from '../services/socket';

const STATUT_MAP: Record<string, string> = {
  'En attente': 'EN_ATTENTE',
  'Validées': 'VALIDEE',
  'En prépa.': 'EN_PREPARATION',
  'Prêtes': 'PRETE',
  'Servies': 'SERVIE',
};

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

  // Détail modal
  const [showDetail, setShowDetail] = useState(false);
  const [detailTitre, setDetailTitre] = useState('');
  const [detailCommandes, setDetailCommandes] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());

  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const loadStats = async () => {
    try {
      const { data } = await commandesApi.getStats();
      setStats(data);
    } catch (err) {}
  };

  useEffect(() => {
    loadStats();
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

  const openDetail = async (titre: string) => {
    const statut = STATUT_MAP[titre];
    if (!statut) return;
    setDetailTitre(titre);
    setShowDetail(true);
    setLoadingDetails(true);
    setExpandedTables(new Set());
    try {
      const { data } = isAdminOrManager
        ? await commandesApi.getAll()
        : await commandesApi.getByServeur();
      const list = Array.isArray(data) ? data : [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDetailCommandes(
        list.filter((c: any) => {
          if (c.statut !== statut) return false;
          const dateCmd = new Date(c.dateCommande);
          return dateCmd >= today && dateCmd < tomorrow;
        }),
      );
    } catch (err) {
      setDetailCommandes([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const toggleTable = (tableId: number) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  // Grouper les commandes par table
  const commandesParTable = useMemo(() => {
    const grouped: Record<number, { table: any; commandes: any[] }> = {};
    for (const cmd of detailCommandes) {
      const tId = cmd.tableId || cmd.table?.id;
      if (!tId) continue;
      if (!grouped[tId]) {
        grouped[tId] = { table: cmd.table || { id: tId, numero: `Table ${tId}` }, commandes: [] };
      }
      grouped[tId].commandes.push(cmd);
    }
    return Object.values(grouped);
  }, [detailCommandes]);

  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrateur', MANAGER: 'Manager', SERVEUR: 'Serveur',
    CUISINE: 'Cuisine', BAR: 'Bar', CAISSIER: 'Caissier',
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
          <Text style={styles.avatarText}>{(user?.nom || 'U').charAt(0).toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      {/* Commandes Cards */}
      <Text style={styles.sectionTitle}>Commandes du jour</Text>
      <View style={styles.statsGrid}>
        {commandeCards.map((card, i) => (
          <TouchableOpacity
            key={i}
            style={styles.statCardWrapper}
            onPress={() => openDetail(card.title)}
            activeOpacity={0.7}
          >
            <StatCard title={card.title} value={card.value} icon={card.icon} color={card.color} />
          </TouchableOpacity>
        ))}
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

      {/* Modal Détail par statut */}
      <Modal visible={showDetail} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{detailTitre} ({detailCommandes.length})</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingDetails ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
            ) : commandesParTable.length === 0 ? (
              <View style={styles.emptyDetail}>
                <Text style={styles.emptyDetailIcon}>📭</Text>
                <Text style={styles.emptyDetailText}>Aucune commande</Text>
              </View>
            ) : (
              <FlatList
                data={commandesParTable}
                keyExtractor={(item) => String(item.table.id)}
                renderItem={({ item }) => {
                  const isExpanded = expandedTables.has(item.table.id);
                  return (
                    <View style={styles.tableGroup}>
                      <TouchableOpacity
                        style={styles.tableHeader}
                        onPress={() => toggleTable(item.table.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.tableHeaderLeft}>
                          <Text style={styles.tableIcon}>🪑</Text>
                          <View>
                            <Text style={styles.tableNumero}>
                              Table {item.table.numero || item.table.id}
                            </Text>
                            <Text style={styles.tableCount}>
                              {item.commandes.length} commande{item.commandes.length > 1 ? 's' : ''}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.tableDetails}>
                          {item.commandes.map((cmd: any) => (
                            <View key={cmd.id} style={styles.commandeItem}>
                              <View style={styles.commandeHeader}>
                                <Text style={styles.commandeId}>#{cmd.id}</Text>
                                <Text style={styles.commandeMontant}>
                                  {Number(cmd.montantTotal).toFixed(2)} €
                                </Text>
                              </View>
                              {cmd.details?.map((d: any, di: number) => (
                                <View key={di} style={styles.detailRow}>
                                  <Text style={styles.detailQte}>{d.quantite}x</Text>
                                  <Text style={styles.detailNom}>{d.menu?.nom || 'Article'}</Text>
                                </View>
                              ))}
                              {cmd.serveur && (
                                <Text style={styles.serveurInfo}>
                                  👤 {cmd.serveur.nom}
                                  {cmd.serveur.role ? ` (${roleLabels[cmd.serveur.role] || cmd.serveur.role})` : ''}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                }}
                style={styles.detailList}
              />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6,
  },
  greeting: { fontSize: 17, fontWeight: '700', color: Colors.text },
  role: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: Colors.textWhite, fontSize: 18, fontWeight: '700' },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: Colors.text,
    paddingHorizontal: 16, marginTop: 12, marginBottom: 6,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14 },
  statCardWrapper: { width: '30%', margin: '1.5%' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, marginBottom: 30 },
  menuItem: {
    width: '30%', backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    margin: '1.5%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  menuIconBox: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.primary + '10',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  menuIcon: { fontSize: 20 },
  menuLabel: { fontSize: 11, fontWeight: '600', color: Colors.text, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalClose: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.inputBg,
    justifyContent: 'center', alignItems: 'center',
  },
  modalCloseText: { fontSize: 16, color: Colors.textLight, fontWeight: '600' },
  detailList: { maxHeight: '90%' },

  // Table group
  tableGroup: {
    backgroundColor: Colors.inputBg, borderRadius: 14, marginBottom: 8, overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
  },
  tableHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  tableIcon: { fontSize: 20, marginRight: 10 },
  tableNumero: { fontSize: 15, fontWeight: '700', color: Colors.text },
  tableCount: { fontSize: 12, color: Colors.textLight, marginTop: 1 },
  expandArrow: { fontSize: 12, color: Colors.textLight },

  // Table details
  tableDetails: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  commandeItem: {
    backgroundColor: Colors.surface, borderRadius: 10, padding: 12, marginTop: 8,
  },
  commandeHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  commandeId: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  commandeMontant: { fontSize: 14, fontWeight: '700', color: Colors.text },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  detailQte: { fontSize: 13, fontWeight: '600', color: Colors.secondary, width: 30 },
  detailNom: { fontSize: 13, color: Colors.text, flex: 1 },
  serveurInfo: {
    fontSize: 11, color: Colors.textLight, marginTop: 6, paddingTop: 6,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },

  // Empty
  emptyDetail: { alignItems: 'center', paddingVertical: 40 },
  emptyDetailIcon: { fontSize: 40, marginBottom: 8 },
  emptyDetailText: { fontSize: 15, color: Colors.textLight },
});
