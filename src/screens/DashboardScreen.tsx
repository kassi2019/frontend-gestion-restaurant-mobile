import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootState } from '../store';
import { formatPrixDevise, selectDevise } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import StatCard from '../components/StatCard';
import { commandesApi, notificationsApi, paiementApi } from '../services/api';
import { getSocket } from '../services/socket';

const STATUT_MAP: Record<string, string> = {
  'En attente': 'EN_ATTENTE',
  'Validees': 'VALIDEE',
  'En prepa.': 'EN_PREPARATION',
  'Pretes': 'PRETE',
  'Servies': 'SERVIE',
};

export default function DashboardScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const devise = useSelector(selectDevise);
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
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // Detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [detailTitre, setDetailTitre] = useState('');
  const [detailCommandes, setDetailCommandes] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());

  // Cashier data
  const [caisse, setCaisse] = useState<any>(null);
  const [nbAPayer, setNbAPayer] = useState(0);
  const [aPayerCommandes, setAPayerCommandes] = useState<any[]>([]);
  const [facturesList, setFacturesList] = useState<any[]>([]);
  const [cashierDetail, setCashierDetail] = useState<'apayer' | 'factures' | null>(null);
  const [showCashierModal, setShowCashierModal] = useState(false);

  // Bar data
  const [barOrders, setBarOrders] = useState<any[]>([]);
  const [loadingBar, setLoadingBar] = useState(false);

  const MODE_LABELS_CASHIER: Record<string, string> = {
    ESPECES: 'Especes', MOBILE_MONEY: 'Mobile Money', CARTE_BANCAIRE: 'Carte Bancaire',
  };

  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isCuisine = user?.role === 'CUISINE';
  const isBar = user?.role === 'BAR';
  const isCaissier = user?.role === 'CAISSIER';

  const loadStats = useCallback(async () => {
    if (isCaissier) return;
    try {
      const { data } = await commandesApi.getStats();
      setStats(data);
    } catch (err) {}
  }, [isCaissier]);

  const loadUnreadNotifs = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await notificationsApi.getAll(today);
      const list = Array.isArray(data) ? data : [];
      setUnreadNotifs(list.filter((n: any) => !n.lu).length);
    } catch (err) {}
  }, []);

  const loadBarData = useCallback(async () => {
    if (!isBar) return;
    try {
      setLoadingBar(true);
      const { data } = await commandesApi.getByBar();
      setBarOrders(Array.isArray(data) ? data : []);
    } catch (err) { setBarOrders([]); }
    finally { setLoadingBar(false); }
  }, [isBar]);

  const loadCashierData = useCallback(async () => {
    if (!isCaissier) return;
    try {
      const [cmdRes, caisseRes] = await Promise.all([
        paiementApi.getAPayer(),
        paiementApi.getCaisseJour(),
      ]);
      setNbAPayer(Array.isArray(cmdRes.data) ? cmdRes.data.length : 0);
      setCaisse(caisseRes.data);
    } catch (err) {}
  }, [isCaissier]);

  // Reload unread count every time the dashboard gets focus
  useFocusEffect(
    useCallback(() => {
      loadUnreadNotifs();
      loadStats();
      loadCashierData();
      loadBarData();
    }, [loadUnreadNotifs, loadStats, loadCashierData, loadBarData])
  );

  useEffect(() => {
    loadStats();
    loadUnreadNotifs();
    loadCashierData();
    loadBarData();
    const socket = getSocket();
    if (socket) {
      const refresh = () => { loadStats(); loadUnreadNotifs(); loadCashierData(); loadBarData(); };
      socket.on('nouvelle_commande', refresh);
      socket.on('commande_status_change', refresh);
      if (isCuisine) socket.on('nouvelle_commande_cuisine', refresh);
      if (isBar) socket.on('nouvelle_commande_bar', refresh);
      socket.on('notification_admin', refresh);
      socket.on('notification_user', refresh);
      return () => {
        socket.off('nouvelle_commande', refresh);
        socket.off('commande_status_change', refresh);
        if (isCuisine) socket.off('nouvelle_commande_cuisine', refresh);
        if (isBar) socket.off('nouvelle_commande_bar', refresh);
        socket.off('notification_admin', refresh);
        socket.off('notification_user', refresh);
      };
    }
  }, [isCuisine, isBar, isCaissier]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadUnreadNotifs(), loadCashierData()]);
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

  const commandeCards = [
    { title: 'En attente', value: stats.enAttente, icon: '⏳', color: Colors.warning },
    { title: 'Validees', value: stats.validees, icon: '✅', color: Colors.success },
    { title: 'En prepa.', value: stats.enPreparation, icon: '👨‍🍳', color: Colors.accent },
    { title: 'Pretes', value: stats.pretes, icon: '🍽', color: Colors.primary },
    { title: 'Servies', value: stats.servies, icon: '📋', color: Colors.secondary },
  ];

  const menuItems = [
    { icon: '🪑', label: 'Mes Tables', screen: 'Tables', color: '#3498DB', roles: ['SERVEUR', 'ADMIN', 'MANAGER'] },
    { icon: '📋', label: 'Commandes', screen: 'Commandes', color: '#E86B2A', roles: ['SERVEUR', 'ADMIN', 'MANAGER'] },
    { icon: '🍳', label: 'Cuisine', screen: 'Commandes', color: '#27AE60', roles: ['CUISINE'] },
    { icon: '🍹', label: 'Bar', screen: 'Commandes', color: '#F39C12', roles: ['BAR'] },
    { icon: '🍽', label: 'Menu', screen: 'Menu', color: '#8E44AD', roles: ['ADMIN', 'MANAGER'] },
    { icon: '📅', label: 'Planning', screen: 'Planning', color: '#2C3E50', roles: ['ADMIN', 'MANAGER', 'SERVEUR'] },
    { icon: '👥', label: 'Utilisateurs', screen: 'Users', color: '#16A085', roles: ['ADMIN', 'MANAGER'] },
    { icon: '💳', label: 'Caisse', screen: 'Cashier', color: '#C0392B', roles: ['ADMIN', 'MANAGER', 'CAISSIER'] },
    { icon: '📊', label: 'Statistiques', screen: 'Stats', color: '#2ECC71', roles: ['ADMIN', 'MANAGER'] },
    { icon: '🔔', label: 'Notifications', screen: 'Notifications', color: '#E67E22', badge: unreadNotifs, roles: ['ADMIN', 'MANAGER', 'SERVEUR', 'CUISINE', 'BAR', 'CAISSIER'] },
  ];

  const filteredMenu = menuItems.filter((item) => item.roles.includes(user?.role || ''));

  // ============ CASHIER DASHBOARD ============
  if (isCaissier) {
    const commandesAPayerGroup = useMemo(() => {
      // Group commands to pay by table
      const grouped: Record<number, { tableId: number; tableNumero: string; commandes: any[]; total: number }> = {};
      for (const cmd of (aPayerCommandes || [])) {
        const tId = cmd.tableId || cmd.table?.id;
        if (!tId) continue;
        const numero = cmd.table?.numero || `Table ${tId}`;
        if (!grouped[tId]) {
          grouped[tId] = { tableId: tId, tableNumero: numero, commandes: [], total: 0 };
        }
        grouped[tId].commandes.push(cmd);
        grouped[tId].total += Number(cmd.montantTotal);
      }
      return Object.values(grouped);
    }, [aPayerCommandes]);

    const openCashierModal = async (type: 'apayer' | 'factures') => {
      setCashierDetail(type);
      setShowCashierModal(true);
      if (type === 'apayer') {
        try {
          const { data } = await paiementApi.getAPayer();
          const list = Array.isArray(data) ? data : [];
          setAPayerCommandes(list);
        } catch (err) { setAPayerCommandes([]); }
      }
      if (type === 'factures') {
        try {
          const today = new Date().toISOString().split('T')[0];
          const { data } = await paiementApi.getFactures(today);
          const list = Array.isArray(data) ? data : [];
          setFacturesList(list);
        } catch (err) { setFacturesList([]); }
      }
    };

    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour, {user?.nom || 'Employe'} 👋</Text>
            <Text style={styles.role}>Caissier</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.avatarText}>{(user?.nom || 'U').charAt(0).toUpperCase()}</Text>
            {unreadNotifs > 0 && (
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Caisse du jour — cliquable */}
        {caisse && (
          <TouchableOpacity style={styles.caisseCard} onPress={() => openCashierModal('factures')} activeOpacity={0.8}>
            <Text style={styles.caisseCardTitle}>Caisse du jour</Text>
            <Text style={styles.caisseCardTotal}>{formatPrixDevise(caisse.totalGeneral, devise)}</Text>
            <View style={styles.caisseCardRow}>
              <View style={styles.caisseCardItem}>
                <Text style={styles.caisseCardItemLabel}>Especes</Text>
                <Text style={styles.caisseCardItemValue}>{formatPrixDevise(caisse.details.totalEspeces, devise)}</Text>
              </View>
              <View style={styles.caisseCardItem}>
                <Text style={styles.caisseCardItemLabel}>Mobile</Text>
                <Text style={styles.caisseCardItemValue}>{formatPrixDevise(caisse.details.totalMobileMoney, devise)}</Text>
              </View>
              <View style={styles.caisseCardItem}>
                <Text style={styles.caisseCardItemLabel}>Carte</Text>
                <Text style={styles.caisseCardItemValue}>{formatPrixDevise(caisse.details.totalCarte, devise)}</Text>
              </View>
            </View>
            <Text style={styles.caisseCardCount}>{caisse.nombreFactures} facture(s) — Voir details</Text>
          </TouchableOpacity>
        )}

        {/* Quick stats — cliquables */}
        <View style={styles.cashierStatsRow}>
          <TouchableOpacity
            style={[styles.cashierStatCard, { backgroundColor: Colors.warning + '15', borderColor: Colors.warning + '40' }]}
            onPress={() => openCashierModal('apayer')}
            activeOpacity={0.7}
          >
            <Text style={styles.cashierStatIcon}>🧾</Text>
            <Text style={styles.cashierStatValue}>{nbAPayer}</Text>
            <Text style={styles.cashierStatLabel}>A payer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cashierStatCard, { backgroundColor: Colors.success + '15', borderColor: Colors.success + '40' }]}
            onPress={() => openCashierModal('factures')}
            activeOpacity={0.7}
          >
            <Text style={styles.cashierStatIcon}>📋</Text>
            <Text style={styles.cashierStatValue}>{caisse?.nombreFactures || 0}</Text>
            <Text style={styles.cashierStatLabel}>Factures</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cashierStatCard, { backgroundColor: Colors.info + '15', borderColor: Colors.info + '40' }]}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Text style={styles.cashierStatIcon}>🔔</Text>
            <Text style={styles.cashierStatValue}>{unreadNotifs}</Text>
            <Text style={styles.cashierStatLabel}>Non lues</Text>
          </TouchableOpacity>
        </View>

        {/* Acces Rapide */}
        <Text style={styles.sectionTitle}>Acces Rapide</Text>
        <View style={styles.menuGrid}>
          {filteredMenu.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, { backgroundColor: (item as any).color + '18' }]}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                {item.badge !== undefined && item.badge > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Modal Detail Caissier */}
        <Modal visible={showCashierModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {cashierDetail === 'apayer' ? `A payer (${commandesAPayerGroup.length} tables)` : `Factures du jour (${facturesList.length})`}
                </Text>
                <TouchableOpacity onPress={() => setShowCashierModal(false)} style={styles.modalClose}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {cashierDetail === 'apayer' ? (
                commandesAPayerGroup.length === 0 ? (
                  <View style={styles.emptyDetail}>
                    <Text style={styles.emptyDetailIcon}>🧾</Text>
                    <Text style={styles.emptyDetailText}>Aucune commande a payer</Text>
                  </View>
                ) : (
                  <FlatList
                    data={commandesAPayerGroup}
                    keyExtractor={(item) => String(item.tableId)}
                    renderItem={({ item }) => {
                      const isExpanded = expandedTables.has(item.tableId);
                      return (
                        <View style={styles.tableGroup}>
                          <TouchableOpacity
                            style={styles.tableHeader}
                            onPress={() => toggleTable(item.tableId)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.tableHeaderLeft}>
                              <Text style={styles.tableIcon}>🪑</Text>
                              <View>
                                <Text style={styles.tableNumero}>Table {item.tableNumero}</Text>
                                <Text style={styles.tableCount}>
                                  {item.commandes.length} commande{item.commandes.length > 1 ? 's' : ''} · {item.total.toFixed(2)} {devise}
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
                                    <Text style={styles.commandeId}>#{cmd.id} — {cmd.statut === 'SERVIE' ? 'Servie' : 'Prete'}</Text>
                                    <Text style={styles.commandeMontant}>{Number(cmd.montantTotal).toFixed(2)} {devise}</Text>
                                  </View>
                                  {cmd.session?.dateArrivee && (
                                    <Text style={styles.cashierInfo}>
                                      🕐 Arrivee: {new Date(cmd.session.dateArrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                  )}
                                  {cmd.serveur && (
                                    <Text style={styles.cashierInfo}>
                                      👤 Serveur: {cmd.serveur.nom}
                                    </Text>
                                  )}
                                  {cmd.details?.map((d: any, di: number) => (
                                    <View key={di} style={styles.detailRow}>
                                      <Text style={styles.detailQte}>{d.quantite}x</Text>
                                      <Text style={styles.detailNom}>{d.menu?.nom || 'Article'}</Text>
                                      <Text style={styles.cashierDetailQte}>{formatPrixDevise(Number(d.prix) * d.quantite, devise)}</Text>
                                    </View>
                                  ))}
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    }}
                    style={styles.detailList}
                  />
                )
              ) : cashierDetail === 'factures' ? (
                facturesList.length === 0 ? (
                  <View style={styles.emptyDetail}>
                    <Text style={styles.emptyDetailIcon}>📋</Text>
                    <Text style={styles.emptyDetailText}>Aucune facture aujourd'hui</Text>
                  </View>
                ) : (
                  <FlatList
                    data={facturesList}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => (
                      <View style={styles.factureItem}>
                        <View style={styles.factureLeft}>
                          <Text style={styles.factureNum}>Facture {item.numero}</Text>
                          <Text style={styles.factureTable}>
                            Table {item.commande?.table?.numero || '?'} · {item.modePaiement ? MODE_LABELS_CASHIER[item.modePaiement] || item.modePaiement : '—'}
                          </Text>
                          <Text style={styles.factureDate}>
                            {new Date(item.datePaiement).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <Text style={styles.factureMontant}>{formatPrixDevise(item.montant, devise)}</Text>
                      </View>
                    )}
                    style={styles.detailList}
                  />
                )
              ) : null}
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  // ============ BAR DASHBOARD ============
  if (isBar) {
    const barOrdersParTable = useMemo(() => {
      const grouped: Record<number, { tableId: number; tableNumero: string; commandes: any[]; total: number }> = {};
      for (const cmd of barOrders) {
        const tId = cmd.tableId || cmd.table?.id;
        if (!tId) continue;
        const numero = cmd.table?.numero || `Table ${tId}`;
        if (!grouped[tId]) {
          grouped[tId] = { tableId: tId, tableNumero: numero, commandes: [], total: 0 };
        }
        grouped[tId].commandes.push(cmd);
        grouped[tId].total += Number(cmd.montantTotal);
      }
      return Object.values(grouped);
    }, [barOrders]);

    const boissonsEnAttente = barOrders.filter((c: any) =>
      c.statut !== 'ANNULEE' && c.statut !== 'PAYEE'
    ).length;

    const boissonsPretes = barOrders.filter((c: any) =>
      c.statut === 'PRETE' || c.statut === 'SERVIE'
    ).length;

    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour, {user?.nom || 'Employe'} 👋</Text>
            <Text style={styles.role}>Bar</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.avatarText}>{(user?.nom || 'U').charAt(0).toUpperCase()}</Text>
            {unreadNotifs > 0 && (
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Hero Bar */}
        <View style={styles.barHero}>
          <Text style={styles.barHeroTitle}>🍹 Commandes Bar</Text>
          <Text style={styles.barHeroCount}>{boissonsEnAttente} en attente</Text>
        </View>

        {/* Quick stats */}
        <View style={styles.barStatsRow}>
          <View style={[styles.barStatCard, { backgroundColor: Colors.warning + '15', borderColor: Colors.warning + '40' }]}>
            <Text style={styles.barStatIcon}>⏳</Text>
            <Text style={styles.barStatValue}>{boissonsEnAttente}</Text>
            <Text style={styles.barStatLabel}>En cours</Text>
          </View>
          <View style={[styles.barStatCard, { backgroundColor: Colors.success + '15', borderColor: Colors.success + '40' }]}>
            <Text style={styles.barStatIcon}>✅</Text>
            <Text style={styles.barStatValue}>{boissonsPretes}</Text>
            <Text style={styles.barStatLabel}>Pretes</Text>
          </View>
          <View style={[styles.barStatCard, { backgroundColor: Colors.info + '15', borderColor: Colors.info + '40' }]}>
            <Text style={styles.barStatIcon}>🔔</Text>
            <Text style={styles.barStatValue}>{unreadNotifs}</Text>
            <Text style={styles.barStatLabel}>Non lues</Text>
          </View>
        </View>

        {/* Liste des commandes bar par table */}
        <Text style={styles.sectionTitle}>A preparer ({barOrdersParTable.length} tables)</Text>
        {loadingBar ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
        ) : barOrdersParTable.length === 0 ? (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyDetailIcon}>🍹</Text>
            <Text style={styles.emptyDetailText}>Aucune commande bar</Text>
          </View>
        ) : (
          barOrdersParTable.map((item) => {
            const isExpanded = expandedTables.has(item.tableId);
            return (
              <View key={item.tableId} style={[styles.tableGroup, { marginHorizontal: 12, marginBottom: 8 }]}>
                <TouchableOpacity
                  style={styles.tableHeader}
                  onPress={() => toggleTable(item.tableId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.tableHeaderLeft}>
                    <Text style={styles.tableIcon}>🪑</Text>
                    <View>
                      <Text style={styles.tableNumero}>Table {item.tableNumero}</Text>
                      <Text style={styles.tableCount}>
                        {item.commandes.length} commande{item.commandes.length > 1 ? 's' : ''} · {formatPrixDevise(item.total, devise)}
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
                          <View style={[styles.barStatusBadge, {
                            backgroundColor: cmd.statut === 'VALIDEE' ? Colors.warning + '20' :
                              cmd.statut === 'EN_PREPARATION' ? Colors.accent + '20' :
                              cmd.statut === 'PRETE' ? Colors.success + '20' : Colors.inputBg
                          }]}>
                            <Text style={[styles.barStatusText, {
                              color: cmd.statut === 'VALIDEE' ? Colors.warning :
                                cmd.statut === 'EN_PREPARATION' ? Colors.accent :
                                cmd.statut === 'PRETE' ? Colors.success : Colors.textLight
                            }]}>
                              {cmd.statut === 'VALIDEE' ? 'Validee' :
                               cmd.statut === 'EN_PREPARATION' ? 'En prepa' :
                               cmd.statut === 'PRETE' ? 'Prete' : cmd.statut}
                            </Text>
                          </View>
                        </View>
                        {cmd.details?.map((d: any, di: number) => (
                          <View key={di} style={styles.detailRow}>
                            <Text style={styles.detailQte}>{d.quantite}x</Text>
                            <Text style={styles.detailNom}>{d.menu?.nom || 'Article'}</Text>
                          </View>
                        ))}
                        {cmd.serveur && (
                          <Text style={styles.serveurInfo}>👤 {cmd.serveur.nom}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Acces Rapide */}
        <Text style={styles.sectionTitle}>Acces Rapide</Text>
        <View style={styles.menuGrid}>
          {filteredMenu.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, { backgroundColor: (item as any).color + '18' }]}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                {item.badge !== undefined && item.badge > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ============ DEFAULT DASHBOARD (non-cashier, non-bar) ============
  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour, {user?.nom || 'Employe'} 👋</Text>
          <Text style={styles.role}>{roleLabels[user?.role || ''] || user?.role}</Text>
        </View>
        <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.avatarText}>{(user?.nom || 'U').charAt(0).toUpperCase()}</Text>
          {unreadNotifs > 0 && (
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
            </View>
          )}
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
      <Text style={styles.sectionTitle}>Acces Rapide</Text>
      <View style={styles.menuGrid}>
        {filteredMenu.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: (item as any).color + '18' }]}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              {item.badge !== undefined && item.badge > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                </View>
              )}
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Modal Detail par statut */}
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
                                  {formatPrixDevise(cmd.montantTotal, devise)}
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
  avatarBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.danger,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.surface,
    paddingHorizontal: 4,
  },
  avatarBadgeText: { color: Colors.textWhite, fontSize: 10, fontWeight: '800' },
  sectionTitle: {
    fontSize: 14, fontWeight: '800', color: Colors.text,
    paddingHorizontal: 16, marginTop: 14, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 },
  statCardWrapper: { width: '30%', margin: '1.6%' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, marginBottom: 40 },
  menuItem: {
    width: '30%',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
    margin: '1.6%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  menuIconBox: {
    width: 48, height: 48, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  menuIcon: { fontSize: 22 },
  menuLabel: { fontSize: 11, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  menuBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.danger,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.surface,
    paddingHorizontal: 3,
  },
  menuBadgeText: { color: Colors.textWhite, fontSize: 10, fontWeight: '800' },

  // Cashier dashboard
  caisseCard: {
    backgroundColor: Colors.primary,
    margin: 12, borderRadius: 20, padding: 24, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  caisseCardTitle: { color: Colors.textWhite, fontSize: 13, opacity: 0.8, fontWeight: '600' },
  caisseCardTotal: { color: Colors.textWhite, fontSize: 40, fontWeight: '800', marginVertical: 6 },
  caisseCardRow: {
    flexDirection: 'row', width: '100%', justifyContent: 'space-around',
    marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)',
  },
  caisseCardItem: { alignItems: 'center' },
  caisseCardItemLabel: { color: Colors.textWhite, fontSize: 11, opacity: 0.7 },
  caisseCardItemValue: { color: Colors.textWhite, fontSize: 15, fontWeight: '700', marginTop: 2 },
  caisseCardCount: { color: Colors.textWhite, fontSize: 12, opacity: 0.6, marginTop: 10 },
  cashierStatsRow: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 8, gap: 8 },
  cashierStatCard: {
    flex: 1, borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 1.5,
  },
  cashierStatIcon: { fontSize: 22, marginBottom: 4 },
  cashierStatValue: { fontSize: 22, fontWeight: '800', color: Colors.text },
  cashierStatLabel: { fontSize: 11, color: Colors.textLight, fontWeight: '600', marginTop: 2 },

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

  // Cashier detail
  cashierInfo: { fontSize: 11, color: Colors.textLight, marginTop: 4 },
  cashierDetailQte: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  // Facture list
  factureItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  factureLeft: { flex: 1 },
  factureNum: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  factureTable: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  factureDate: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  factureMontant: { fontSize: 16, fontWeight: '800', color: Colors.success },

  // Bar dashboard
  barHero: {
    backgroundColor: '#F39C12',
    margin: 12, borderRadius: 20, padding: 24, alignItems: 'center',
    shadowColor: '#F39C12', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  barHeroTitle: { color: Colors.textWhite, fontSize: 15, fontWeight: '700', opacity: 0.9 },
  barHeroCount: { color: Colors.textWhite, fontSize: 32, fontWeight: '800', marginTop: 4 },
  barStatsRow: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 8, gap: 8 },
  barStatCard: {
    flex: 1, borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 1.5,
  },
  barStatIcon: { fontSize: 22, marginBottom: 4 },
  barStatValue: { fontSize: 22, fontWeight: '800', color: Colors.text },
  barStatLabel: { fontSize: 11, color: Colors.textLight, fontWeight: '600', marginTop: 2 },
  barStatusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  barStatusText: { fontSize: 11, fontWeight: '700' },
});
