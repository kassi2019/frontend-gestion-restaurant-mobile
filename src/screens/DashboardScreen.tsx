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
  Alert,
  TextInput,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootState } from '../store';
import { formatPrixDevise, selectDevise } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import StatCard from '../components/StatCard';
import ActionSheet from '../components/ActionSheet';
import { commandesApi, notificationsApi, paiementApi, printerApi } from '../services/api';
import { getSocket } from '../services/socket';
import { showToast } from '../services/toast';

const STATUT_COLORS: Record<string, string> = {
  EN_ATTENTE: '#FF9800',
  VALIDEE: '#2196F3',
  SERVEUR_VALIDE: '#2196F3',
  RECEPTION_VALIDE: '#4CAF50',
  EN_PREPARATION: '#E86B2A',
  PRETE: '#9C27B0',
  PAYEE: '#9C27B0',
  ANNULEE: '#f44336',
};

const STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  VALIDEE: 'Validée',
  SERVEUR_VALIDE: 'Serv. validé',
  RECEPTION_VALIDE: 'Réc. validé',
  EN_PREPARATION: 'En prépa',
  PRETE: 'Prête',
  PAYEE: 'Payée',
  ANNULEE: 'Annulée',
};

const STATUT_MAP: Record<string, string> = {
  'En attente': 'EN_ATTENTE',
  'Validees': 'VALIDEE',
  'En prepa.': 'EN_PREPARATION',
  'Pretes': 'PRETE',
  'Servies': 'SERVIE',
};

// Calculer le total des articles (details) d'une commande
function totalDetails(cmd: any) {
  if (!cmd.details) return 0;
  return cmd.details.reduce((sum: number, d: any) => sum + Number(d.prix) * d.quantite, 0);
}

export default function DashboardScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const devise = useSelector(selectDevise);
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState({
    totalTables: 0,
    totalCommandes: 0,
    enAttente: 0,
    serveurValide: 0,
    receptionValide: 0,
    payees: 0,
    annulees: 0,
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
  const [cashierDetail, setCashierDetail] = useState<'apayer' | 'factures' | 'clotures' | null>(null);
  const [cloturesList, setCloturesList] = useState<any[]>([]);

  // Bar data
  const [barOrders, setBarOrders] = useState<any[]>([]);
  const [loadingBar, setLoadingBar] = useState(false);
  const [barDetail, setBarDetail] = useState<'encours' | 'pretes' | null>(null);
  const [showBarModal, setShowBarModal] = useState(false);

  // Cuisine data
  const [cuisineOrders, setCuisineOrders] = useState<any[]>([]);
  const [loadingCuisine, setLoadingCuisine] = useState(false);

  // Paiement depuis la recherche
  const [selectedCommande, setSelectedCommande] = useState<any>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showRemise, setShowRemise] = useState(false);
  const [remiseForm, setRemiseForm] = useState({ type: 'POURCENTAGE', valeur: '0', motif: '' });

  const handlePrintReceipt = async () => {
    if (receiptData?.factureId) {
      try {
        const { data } = await printerApi.printFacture(receiptData.factureId);
        if (data.ok) showToast.success('Reçu imprimé');
        else showToast.error(data.message || 'Échec impression');
      } catch { showToast.error('Impossible d\'imprimer'); }
    }
  };

  const MODE_LABELS_CASHIER: Record<string, string> = {
    ESPECES: 'Especes', MOBILE_MONEY: 'Mobile Money', CARTE_BANCAIRE: 'Carte Bancaire',
  };

  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isServeur = user?.role === 'SERVEUR';
  const isCuisine = user?.role === 'CUISINE';
  const isBar = user?.role === 'BAR';
  const isCaissier = user?.role === 'CAISSIER';
  const canValidate = isServeur || isAdminOrManager;
  const canPrepare = isCuisine || isBar || isAdminOrManager;
  const canMarkReady = isAdminOrManager;
  const canMarkServed = isServeur || isAdminOrManager;

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

  const loadCuisineData = useCallback(async () => {
    if (!isCuisine) return;
    try {
      setLoadingCuisine(true);
      const { data } = await commandesApi.getByCuisine();
      setCuisineOrders(Array.isArray(data) ? data : []);
    } catch (err) { setCuisineOrders([]); }
    finally { setLoadingCuisine(false); }
  }, [isCuisine]);

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
      loadCuisineData();
    }, [loadUnreadNotifs, loadStats, loadCashierData, loadBarData, loadCuisineData])
  );

  // Polling automatique en arrière-plan (toutes les 15 secondes)
  useEffect(() => {
    const interval = setInterval(() => { loadStats(); loadUnreadNotifs(); loadCashierData(); loadBarData(); loadCuisineData(); }, 15000);
    return () => clearInterval(interval);
  }, [loadStats, loadUnreadNotifs, loadCashierData, loadBarData, loadCuisineData]);

  useEffect(() => {
    loadStats();
    loadUnreadNotifs();
    loadCashierData();
    loadBarData();
    loadCuisineData();
    const socket = getSocket();
    if (socket) {
      const refresh = () => { loadStats(); loadUnreadNotifs(); loadCashierData(); loadBarData(); loadCuisineData(); };
      socket.on('nouvelle_commande', refresh);
      socket.on('commande_status_change', refresh);
      if (isCuisine) socket.on('nouvelle_commande_cuisine', refresh);
      if (isBar) socket.on('nouvelle_commande_bar', refresh);
      socket.on('notification_admin', refresh);
      socket.on('notification_user', refresh);
      socket.on('demande_facture', refresh);
      return () => {
        socket.off('nouvelle_commande', refresh);
        socket.off('commande_status_change', refresh);
        if (isCuisine) socket.off('nouvelle_commande_cuisine', refresh);
        if (isBar) socket.off('nouvelle_commande_bar', refresh);
        socket.off('notification_admin', refresh);
        socket.off('notification_user', refresh);
        socket.off('demande_facture', refresh);
      };
    }
  }, [isCuisine, isBar, isCaissier]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadUnreadNotifs(), loadCashierData(), loadBarData(), loadCuisineData()]);
    setRefreshing(false);
  };

  const handleUpdateStatut = async (commandeId: number, statut: string) => {
    try {
      await commandesApi.updateStatut(commandeId, statut);
      showToast.success(`Commande #${commandeId} → ${STATUT_LABELS[statut] || statut}`);
      loadStats();
      loadCashierData();
      // Rafraîchir les détails si la modale est ouverte
      if (showDetail) openDetail(detailTitre);
    } catch (err) {
      showToast.error('Impossible de mettre à jour le statut');
    }
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

  const commandesAPayerGroup = useMemo(() => {
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
      grouped[tId].total += totalDetails(cmd);
    }
    return Object.values(grouped);
  }, [barOrders]);

  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrateur', MANAGER: 'Manager', RECEPTIONNISTE: 'Réceptionniste',
    SERVEUR: 'Serveur', CUISINE: 'Cuisine', BAR: 'Bar', CAISSIER: 'Caissier',
  };

  const commandesParTableCuisine = useMemo(() => {
    if (!isCuisine) return [];
    const maintenant = Date.now();
    const grouped: Record<number, { tableId: number; tableNumero: string; commandes: any[]; total: number; passeeDepuis: number }> = {};
    for (const cmd of cuisineOrders) {
      const tId = cmd.tableId || cmd.table?.id;
      if (!tId) continue;
      const numero = cmd.table?.numero || `Table ${tId}`;
      if (!grouped[tId]) {
        grouped[tId] = { tableId: tId, tableNumero: numero, commandes: [], total: 0, passeeDepuis: Date.now() - new Date(cmd.dateCommande).getTime() };
      }
      grouped[tId].commandes.push(cmd);
      grouped[tId].total += Number(cmd.montantTotal);
      const d = Date.now() - new Date(cmd.dateCommande).getTime();
      if (d < grouped[tId].passeeDepuis) grouped[tId].passeeDepuis = d;
    }
    return Object.values(grouped).sort((a, b) => a.passeeDepuis - b.passeeDepuis);
  }, [cuisineOrders, isCuisine]);

  const commandeCards = [
    { title: 'En attente', value: stats.enAttente, icon: '⏳', color: Colors.warning },
    { title: 'Serv. validé', value: stats.serveurValide, icon: '👤', color: '#2196F3' },
    { title: 'Réc. validé', value: stats.receptionValide, icon: '✅', color: Colors.success },
    { title: 'Payées', value: stats.payees, icon: '💰', color: '#9C27B0' },
    { title: 'Annulées', value: stats.annulees, icon: '✕', color: Colors.danger },
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
    { icon: '⭐', label: 'Abonnement', screen: 'RestaurantSettings', color: '#9333EA', roles: ['ADMIN'] },
    { icon: '🔒', label: 'Clôture', screen: 'RestaurantSettings', color: '#EF4444', roles: ['ADMIN'] },
    { icon: '📋', label: 'Réception', screen: 'Reception', color: '#7C3AED', roles: ['RECEPTIONNISTE'] },
    { icon: '🪑', label: 'Réservations', screen: 'Reservations', color: '#E67E22', roles: ['ADMIN', 'MANAGER', 'RECEPTIONNISTE'] },
    { icon: '🚚', label: 'Livraisons', screen: 'Livraisons', color: '#0284C7', roles: ['ADMIN', 'MANAGER', 'RECEPTIONNISTE'] },
    { icon: '⭐', label: 'Avis clients', screen: 'Evaluations', color: '#FFB300', roles: ['ADMIN', 'MANAGER'] },
    { icon: '📦', label: 'Stock', screen: 'Stock', color: '#16A34A', roles: ['ADMIN', 'MANAGER'] },
    { icon: '🔔', label: 'Notifications', screen: 'Notifications', color: '#E67E22', badge: unreadNotifs, roles: ['ADMIN', 'MANAGER', 'SERVEUR', 'CUISINE', 'BAR', 'CAISSIER'] },
  ];

  // Utiliser les modules dynamiques de l'utilisateur, sinon fallback sur menuItems
  const routeToScreen: Record<string, string> = {
    '/': 'Accueil', '/tables': 'Tables', '/assign-tables': 'AssignTables',
    '/commandes': 'Commandes', '/menu': 'Menu', '/planning': 'Planning',
    '/caisse': 'Cashier', '/users': 'Users', '/notifications': 'Notifications',
    '/stats': 'Stats', '/parametres': 'RestaurantSettings',
    '/abonnement': 'RestaurantSettings', '/super/codes': 'GenerateCodes',
    '/stock': 'Stock',
    '/reception': 'Reception',
    '/reservations': 'Reservations',
    '/livraisons': 'Livraisons',
  };
  const dynamicMenu = user?.modules?.length ? user.modules.map(m => ({
    icon: m.icon, label: m.nom, screen: routeToScreen[m.route] || m.route.replace('/', '') || 'Main',
    color: '#3498DB', roles: ['*'], badge: m.route === '/notifications' ? unreadNotifs : undefined,
  })) : menuItems;
  const filteredMenu = dynamicMenu.filter((item) => item.roles.includes('*') || item.roles.includes(user?.role || ''));

  // States pour le cashier (déplacés ici pour respecter les règles des hooks)
  const [searchCmd, setSearchCmd] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  // ============ CASHIER DASHBOARD ============
  if (isCaissier) {

    const handleSearchCmd = async () => {
      const term = searchCmd.trim();
      if (!term) return;
      setSearching(true);
      try {
        const { data } = await commandesApi.rechercher(term);
        const list = Array.isArray(data) ? data : [];
        setSearchResult(list.length > 0 ? list[0] : null);
        if (list.length === 0) showToast.error('Aucune commande trouvée');
      } catch (err) {
        showToast.error('Recherche impossible');
      } finally {
        setSearching(false);
      }
    };

    const handleRemise = async () => {
      if (!selectedCommande) return;
      const v = parseFloat(remiseForm.valeur);
      if (isNaN(v) || v <= 0) { showToast.error('Valeur invalide'); return; }
      try {
        const { data } = await paiementApi.appliquerRemise(selectedCommande.id, { type: remiseForm.type, valeur: v, motif: remiseForm.motif || undefined });
        setSelectedCommande({ ...selectedCommande, montantTotal: parseFloat(data.montantFinal) });
        setShowRemise(false);
        showToast.success(`Remise appliquée : ${data.montantFinal} ${devise}`);
        loadCashierData();
      } catch (err: any) { showToast.error(err.response?.data?.message || 'Erreur'); }
    };

    const payerToutMobile = async (cmds: any[], mode: string) => {
      let ok = 0;
      for (const c of cmds) {
        try { await paiementApi.payer(c.id, mode); ok++; } catch {}
      }
      showToast.success(`${ok} commande(s) payée(s)`);
      loadCashierData();
    };

    const handlePayer = async (mode: string) => {
      if (!selectedCommande) return;
      try {
        const { data } = await paiementApi.payer(selectedCommande.id, mode);
        setShowActionModal(false);
        const facture = data?.facture;
        if (facture) {
          // Afficher l'aperçu du reçu
          setReceiptData({
            ...facture,
            factureId: facture.id,
            modePaiement: mode,
            commande: selectedCommande,
            details: selectedCommande.details || [],
          });
          setShowReceiptModal(true);
        } else {
          showToast.success('Paiement effectué');
        }
        setSelectedCommande(null);
        loadCashierData();
      } catch (err: any) {
        showToast.error(err.response?.data?.message || 'Échec du paiement');
      }
    };

    const openCashierModal = async (type: 'apayer' | 'factures' | 'clotures') => {
      setCashierDetail(type);
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
      if (type === 'clotures') {
        try {
          const { data } = await paiementApi.getHistoriqueClotures();
          const list = Array.isArray(data) ? data : [];
          setCloturesList(list);
        } catch (err) { setCloturesList([]); }
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

        {/* Barre de recherche */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <TextInput
              style={styles.searchInputField}
              placeholder="🔍 N° commande..."
              placeholderTextColor={Colors.textLight}
              value={searchCmd}
              onChangeText={setSearchCmd}
              onSubmitEditing={handleSearchCmd}
              returnKeyType="search"
            />
            {searchCmd !== '' && (
              <TouchableOpacity onPress={() => { setSearchCmd(''); setSearchResult(null); }}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearchCmd} disabled={searching}>
            <Text style={styles.searchBtnText}>{searching ? '...' : '🔍'}</Text>
          </TouchableOpacity>
        </View>

        {/* Résultat de la recherche */}
        {searchResult && (
          <TouchableOpacity
            style={styles.searchResultCard}
            activeOpacity={0.7}
            onPress={() => {
              const cmd = searchResult;
              setSearchResult(null);
              setSearchCmd('');
              if (cmd.statut === 'PAYEE' || (cmd.statut !== 'EN_ATTENTE' && cmd.statut !== 'ANNULEE')) {
                setSelectedCommande(cmd);
                setShowActionModal(true);
              } else {
                showToast.warning('Commande pas encore validée');
              }
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primary }}>
                {searchResult.numeroCommande || `CMD-${String(searchResult.id).padStart(4, '0')}`}
              </Text>
              <Text style={{
                fontSize: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
                backgroundColor: (STATUT_COLORS[searchResult.statut] || '#EEE') + '20',
                color: STATUT_COLORS[searchResult.statut] || '#333', fontWeight: '700',
              }}>
                {STATUT_LABELS[searchResult.statut] || searchResult.statut}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: Colors.textLight, marginTop: 4 }}>
              Table {searchResult.table?.numero || '?'} · {formatPrixDevise(searchResult.montantTotal, devise)}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.success, marginTop: 6 }}>
              {searchResult.statut === 'PAYEE' ? '🖨 Cliquer pour réimprimer le reçu' :
               searchResult.statut !== 'EN_ATTENTE' && searchResult.statut !== 'ANNULEE' ? '💰 Cliquer pour payer' :
               '⏳ En attente de préparation'}
            </Text>
          </TouchableOpacity>
        )}

        {/* 2 Onglets : À payer / Payées */}
        <View style={styles.cashierTabs}>
          <TouchableOpacity
            style={[styles.cashierTab, cashierDetail === 'apayer' && styles.cashierTabActive]}
            onPress={() => openCashierModal('apayer')}
          >
            <Text style={[styles.cashierTabText, cashierDetail === 'apayer' && styles.cashierTabTextActive]}>
              🧾 À payer ({nbAPayer})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cashierTab, cashierDetail === 'factures' && styles.cashierTabActive]}
            onPress={() => openCashierModal('factures')}
          >
            <Text style={[styles.cashierTabText, cashierDetail === 'factures' && styles.cashierTabTextActive]}>
              💰 Payées ({caisse?.nombreFactures || 0})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Liste selon l'onglet actif */}
        {cashierDetail === 'apayer' ? (
          commandesAPayerGroup.length === 0 ? (
            <View style={styles.emptyDetail}>
              <Text style={styles.emptyDetailIcon}>🧾</Text>
              <Text style={styles.emptyDetailText}>Aucune commande à payer</Text>
            </View>
          ) : (
            <FlatList
              data={commandesAPayerGroup}
              keyExtractor={(item) => String(item.tableId)}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isExpanded = expandedTables.has(item.tableId);
                return (
                  <View style={styles.tableGroup}>
                    <View style={styles.tableHeader}>
                      <TouchableOpacity
                        style={styles.tableHeaderLeft}
                        onPress={() => toggleTable(item.tableId)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.tableIcon}>🪑</Text>
                        <View>
                          <Text style={styles.tableNumero}>Table {item.tableNumero}</Text>
                          <Text style={styles.tableCount}>
                            {item.commandes.length} commande{item.commandes.length > 1 ? 's' : ''} · {item.total.toFixed(2)} {devise}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {item.commandes.length > 1 && (
                          <TouchableOpacity
                            style={{ backgroundColor: Colors.success, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}
                            onPress={() => {
                              Alert.alert(
                                '💰 Payer toute la table ?',
                                `${item.commandes.length} commande(s) · Total: ${item.total.toFixed(2)} ${devise}`,
                                [
                                  { text: 'Annuler', style: 'cancel' },
                                  { text: '💵 Espèces', onPress: () => payerToutMobile(item.commandes, 'ESPECES') },
                                  { text: '📱 Mobile', onPress: () => payerToutMobile(item.commandes, 'MOBILE_MONEY') },
                                  { text: '💳 Carte', onPress: () => payerToutMobile(item.commandes, 'CARTE_BANCAIRE') },
                                ]
                              );
                            }}
                          >
                            <Text style={{ color: Colors.textWhite, fontWeight: '700', fontSize: 11 }}>💰 Tout payer</Text>
                          </TouchableOpacity>
                        )}
                        <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
                      </View>
                    </View>
                    {isExpanded && (
                      <View style={styles.tableDetails}>
                        {item.commandes.map((cmd: any) => (
                          <TouchableOpacity key={cmd.id} style={styles.commandeItem}
                            onPress={() => {
                              setSelectedCommande(cmd);
                              setShowActionModal(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.commandeHeader}>
                              <Text style={styles.commandeId}>#{cmd.id} · {cmd.statut === 'SERVIE' ? 'Servie' : cmd.statut === 'PRETE' ? 'Prête' : cmd.statut === 'VALIDEE' ? 'Validée' : cmd.statut}</Text>
                              <Text style={styles.commandeMontant}>{formatPrixDevise(cmd.montantTotal, devise)}</Text>
                            </View>
                            {cmd.details?.map((d: any, di: number) => (
                              <View key={di} style={styles.detailRow}>
                                <Text style={styles.detailQte}>{d.quantite}x</Text>
                                <Text style={styles.detailNom}>{d.menu?.nom || 'Article'}</Text>
                                <Text style={styles.cashierDetailQte}>{formatPrixDevise(Number(d.prix) * d.quantite, devise)}</Text>
                              </View>
                            ))}
                            <Text style={{ fontSize: 11, color: Colors.success, marginTop: 4, fontWeight: '600' }}>💰 Cliquer pour payer</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              }}
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
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.factureItem}
                  onPress={async () => {
                    try {
                      const { data } = await printerApi.printFacture(item.id);
                      if (data.ok) showToast.success('Reçu imprimé');
                      else showToast.error(data.message || 'Échec');
                    } catch { showToast.error('Impossible d\'imprimer'); }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.factureLeft}>
                    <Text style={styles.factureNum}>Facture {item.numero}</Text>
                    <Text style={styles.factureTable}>
                      Table {item.commande?.table?.numero || '?'} · {item.modePaiement ? MODE_LABELS_CASHIER[item.modePaiement] || item.modePaiement : '—'}
                    </Text>
                    <Text style={styles.factureDate}>
                      {new Date(item.dateFacture).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.factureRight}>
                    <Text style={styles.factureMontant}>{formatPrixDevise(item.montantTotal, devise)}</Text>
                    <Text style={styles.printIcon}>🖨</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )
        ) : null}

        {/* Clôture */}
        <TouchableOpacity
          style={[styles.clotureCard, { marginTop: 12 }]}
          onPress={() => openCashierModal('clotures')}
          activeOpacity={0.7}
        >
          <Text style={styles.clotureCardIcon}>📋</Text>
          <Text style={styles.clotureCardText}>Historique des clôtures</Text>
          <Text style={{ color: Colors.primary, fontSize: 18 }}>›</Text>
        </TouchableOpacity>

        {/* Modal Clotures */}
        <Modal visible={cashierDetail === 'clotures'} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Clôtures ({cloturesList.length})</Text>
                <TouchableOpacity onPress={() => setCashierDetail(null)} style={styles.modalClose}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              {cloturesList.length === 0 ? (
                <View style={styles.emptyDetail}>
                  <Text style={styles.emptyDetailIcon}>📋</Text>
                  <Text style={styles.emptyDetailText}>Aucune clôture</Text>
                </View>
              ) : (
                <FlatList
                  data={cloturesList}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <View style={styles.clotureItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>
                          {new Date(item.dateCloture).toLocaleString('fr-FR')}
                        </Text>
                        <Text style={{ fontSize: 11, color: Colors.textLight, marginTop: 2 }}>
                          {item.caissier?.nom || '—'} · {item.nbFactures} facture(s)
                        </Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.success }}>
                        {formatPrixDevise(item.totalGeneral, devise)}
                      </Text>
                    </View>
                  )}
                  style={styles.detailList}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* Acces Rapide */}
        <Text style={styles.sectionTitle}>Accès Rapide</Text>
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

        {/* ActionSheet de paiement depuis la recherche */}
        <ActionSheet
          visible={showActionModal}
          title={`Paiement ${selectedCommande?.numeroCommande || `CMD-${String(selectedCommande?.id || 0).padStart(4, '0')}`}`}
          subtitle={formatPrixDevise(selectedCommande?.montantTotal || 0, devise)}
          actions={[
            { icon: '🏷️', label: 'Appliquer une remise', onPress: () => { setShowActionModal(false); setTimeout(() => setShowRemise(true), 300); } },
            { icon: '💵', label: 'Espèces', onPress: () => handlePayer('ESPECES') },
            { icon: '📱', label: 'Mobile Money', onPress: () => handlePayer('MOBILE_MONEY') },
            { icon: '💳', label: 'Carte Bancaire', onPress: () => handlePayer('CARTE_BANCAIRE') },
          ]}
          onClose={() => setShowActionModal(false)}
        />

        {/* Aperçu reçu après paiement */}
        <Modal visible={showReceiptModal} transparent animationType="slide">
          <View style={styles.receiptOverlay}>
            <View style={styles.receiptContent}>
              <View style={styles.receiptHeader}>
                <Text style={styles.receiptTitle}>🧾 Reçu de paiement</Text>
                <TouchableOpacity onPress={() => { setShowReceiptModal(false); setReceiptData(null); }} style={styles.receiptClose}>
                  <Text style={styles.receiptCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {receiptData && (
                <View style={{ padding: 16 }}>
                  <View style={styles.receiptRow}>
                    <Text style={{ color: Colors.textLight }}>Facture</Text>
                    <Text style={{ fontWeight: '600' }}>{receiptData.numero}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={{ color: Colors.textLight }}>Table</Text>
                    <Text style={{ fontWeight: '600' }}>Table {receiptData.commande?.table?.numero || '?'}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={{ color: Colors.textLight }}>Mode</Text>
                    <Text style={{ fontWeight: '600' }}>{MODE_LABELS_CASHIER[receiptData.modePaiement] || receiptData.modePaiement}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={{ color: Colors.textLight }}>Date</Text>
                    <Text style={{ fontWeight: '600' }}>
                      {receiptData.date ? new Date(receiptData.date).toLocaleString('fr-FR') : '-'}
                    </Text>
                  </View>

                  <Text style={{ fontWeight: '700', marginTop: 16, marginBottom: 8 }}>Articles</Text>
                  {receiptData.details?.map((d: any, i: number) => (
                    <View key={i} style={styles.receiptRow}>
                      <Text>{d.quantite}x {d.menu?.nom || 'Article'}</Text>
                      <Text style={{ fontWeight: '600' }}>
                        {formatPrixDevise(Number(d.prix) * (d.quantite || 1), devise)}
                      </Text>
                    </View>
                  ))}

                  <View style={[styles.receiptRow, { borderTopWidth: 2, borderTopColor: Colors.border, marginTop: 12, paddingTop: 12 }]}>
                    <Text style={{ fontWeight: '800', fontSize: 16 }}>Total</Text>
                    <Text style={{ fontWeight: '800', fontSize: 18, color: Colors.success }}>
                      {formatPrixDevise(receiptData.montant, devise)}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.printBtn} onPress={handlePrintReceipt}>
                    <Text style={styles.printBtnText}>🖨 Imprimer le reçu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.closeReceiptBtn} onPress={() => { setShowReceiptModal(false); setReceiptData(null); }}>
                    <Text style={styles.closeReceiptText}>Fermer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Modal Remise */}
        <Modal visible={showRemise} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🏷️ Appliquer une remise</Text>
              <Text style={{ fontSize: 13, color: Colors.textLight, marginBottom: 16 }}>Commande #{String(selectedCommande?.id || 0).padStart(4, '0')} · {formatPrixDevise(selectedCommande?.montantTotal || 0, devise)}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: remiseForm.type === 'POURCENTAGE' ? Colors.primary : Colors.inputBg, borderWidth: 1, borderColor: remiseForm.type === 'POURCENTAGE' ? Colors.primary : Colors.border }} onPress={() => setRemiseForm({...remiseForm, type: 'POURCENTAGE'})}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: remiseForm.type === 'POURCENTAGE' ? Colors.textWhite : Colors.text }}>% Pourcentage</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: remiseForm.type === 'MONTANT' ? Colors.primary : Colors.inputBg, borderWidth: 1, borderColor: remiseForm.type === 'MONTANT' ? Colors.primary : Colors.border }} onPress={() => setRemiseForm({...remiseForm, type: 'MONTANT'})}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: remiseForm.type === 'MONTANT' ? Colors.textWhite : Colors.text }}>{devise} Montant</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TextInput style={[styles.searchInput, { flex: 1 }]} placeholder={remiseForm.type === 'POURCENTAGE' ? 'Ex: 10' : 'Ex: 500'} keyboardType="numeric" value={remiseForm.valeur} onChangeText={(t) => setRemiseForm({...remiseForm, valeur: t})} />
                <TextInput style={[styles.searchInput, { flex: 2 }]} placeholder="Motif (optionnel)" value={remiseForm.motif} onChangeText={(t) => setRemiseForm({...remiseForm, motif: t})} />
              </View>
              <TouchableOpacity style={{ backgroundColor: Colors.success, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12 }} onPress={handleRemise}>
                <Text style={{ color: Colors.textWhite, fontWeight: '800', fontSize: 15 }}>🏷️ Appliquer la remise</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center', marginTop: 6 }} onPress={() => setShowRemise(false)}>
                <Text style={{ color: Colors.textLight, fontSize: 14 }}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  // ============ BAR DASHBOARD ============
  if (isBar) {
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

        {/* Hero Bar — cliquable */}
        <TouchableOpacity style={styles.barHero} onPress={() => { setBarDetail('encours'); setShowBarModal(true); }} activeOpacity={0.8}>
          <Text style={styles.barHeroTitle}>🍹 Commandes Bar</Text>
          <Text style={styles.barHeroCount}>{boissonsEnAttente} en attente</Text>
          <Text style={styles.barHeroSub}>Voir details →</Text>
        </TouchableOpacity>

        {/* Quick stats — cliquables */}
        <View style={styles.barStatsRow}>
          <TouchableOpacity
            style={[styles.barStatCard, { backgroundColor: Colors.warning + '15', borderColor: Colors.warning + '40' }]}
            onPress={() => { setBarDetail('encours'); setShowBarModal(true); }}
            activeOpacity={0.7}
          >
            <Text style={styles.barStatIcon}>⏳</Text>
            <Text style={styles.barStatValue}>{boissonsEnAttente}</Text>
            <Text style={styles.barStatLabel}>En cours</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.barStatCard, { backgroundColor: Colors.success + '15', borderColor: Colors.success + '40' }]}
            onPress={() => { setBarDetail('pretes'); setShowBarModal(true); }}
            activeOpacity={0.7}
          >
            <Text style={styles.barStatIcon}>✅</Text>
            <Text style={styles.barStatValue}>{boissonsPretes}</Text>
            <Text style={styles.barStatLabel}>Pretes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.barStatCard, { backgroundColor: Colors.info + '15', borderColor: Colors.info + '40' }]}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Text style={styles.barStatIcon}>🔔</Text>
            <Text style={styles.barStatValue}>{unreadNotifs}</Text>
            <Text style={styles.barStatLabel}>Non lues</Text>
          </TouchableOpacity>
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
                <View style={styles.tableHeader}>
                  <TouchableOpacity
                    style={styles.tableHeaderLeft}
                    onPress={() => toggleTable(item.tableId)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tableIcon}>🪑</Text>
                    <View>
                      <Text style={styles.tableNumero}>Table {item.tableNumero}</Text>
                      <Text style={styles.tableCount}>
                        {item.commandes.length} commande{item.commandes.length > 1 ? 's' : ''} · {formatPrixDevise(item.total, devise)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.toutPretBtn}
                    onPress={() => {
                      commandesApi.toutPret(item.tableId, 'BAR').then(() => {
                        showToast.success('Toutes les boissons marquées prêtes');
                        loadBarData();
                      }).catch(() => showToast.error('Impossible de mettre à jour'));
                    }}
                  >
                    <Text style={styles.toutPretText}>✅ Tout prêt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleTable(item.tableId)} activeOpacity={0.7}>
                    <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                </View>
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

        {/* Bar Detail Modal */}
        <Modal visible={showBarModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {barDetail === 'encours' ? `En cours (${barOrdersParTable.length} tables)` : `Pretes (${barOrdersParTable.length} tables)`}
                </Text>
                <TouchableOpacity onPress={() => setShowBarModal(false)} style={styles.modalClose}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {barOrdersParTable.length === 0 ? (
                <View style={styles.emptyDetail}>
                  <Text style={styles.emptyDetailIcon}>🍹</Text>
                  <Text style={styles.emptyDetailText}>Aucune commande</Text>
                </View>
              ) : (
                <FlatList
                  data={barOrdersParTable}
                  keyExtractor={(item) => String(item.tableId)}
                  renderItem={({ item }) => {
                    const isExpanded = expandedTables.has(item.tableId);
                    return (
                      <View style={styles.tableGroup}>
                        <View style={styles.tableHeader}>
                          <TouchableOpacity
                            style={styles.tableHeaderLeft}
                            onPress={() => toggleTable(item.tableId)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.tableIcon}>🪑</Text>
                            <View>
                              <Text style={styles.tableNumero}>Table {item.tableNumero}</Text>
                              <Text style={styles.tableCount}>
                                {item.commandes.length} commande{item.commandes.length > 1 ? 's' : ''} · {formatPrixDevise(item.total, devise)}
                              </Text>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.toutPretBtn}
                            onPress={() => {
                              commandesApi.toutPret(item.tableId, 'BAR').then(() => {
                                showToast.success('Toutes les boissons marquées prêtes');
                                loadBarData();
                              }).catch(() => showToast.error('Impossible de mettre à jour'));
                            }}
                          >
                            <Text style={styles.toutPretText}>✅ Tout prêt</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => toggleTable(item.tableId)} activeOpacity={0.7}>
                            <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
                          </TouchableOpacity>
                        </View>
                        {isExpanded && (
                          <View style={styles.tableDetails}>
                            {item.commandes.map((cmd: any) => (
                              <View key={cmd.id} style={styles.commandeItem}>
                                <View style={styles.commandeHeader}>
                                  <Text style={styles.commandeId}>#{cmd.id}</Text>
                                  <Text style={styles.commandeMontant}>{formatPrixDevise(totalDetails(cmd), devise)}</Text>
                                </View>
                                {cmd.session?.dateArrivee && (
                                  <Text style={styles.cashierInfo}>
                                    🕐 Arrivee: {new Date(cmd.session.dateArrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                                )}
                                {cmd.serveur && (
                                  <Text style={styles.cashierInfo}>👤 {cmd.serveur.nom}</Text>
                                )}
                                {cmd.details?.map((d: any, di: number) => (
                                  <View key={di} style={styles.detailRow}>
                                    <Text style={styles.detailQte}>{d.quantite}x</Text>
                                    <Text style={styles.detailNom}>{d.menu?.nom || 'Article'}</Text>
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
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  // ============ CUISINE DASHBOARD ============
  if (isCuisine) {

    const nbEnPreparation = cuisineOrders.filter((c: any) => c.statut === 'EN_PREPARATION').length;
    const nbPretes = cuisineOrders.filter((c: any) => c.statut === 'PRETE').length;

    const getWaitColor = (minutes: number) => {
      if (minutes >= 15) return { bg: '#FF525215', accent: '#FF5252', label: 'Urgent' };
      if (minutes >= 5) return { bg: '#FFC10715', accent: '#FFC107', label: 'Moyen' };
      return { bg: '#4CAF5015', accent: '#4CAF50', label: 'Normal' };
    };

    const getDetailStatusStyle = (statutPrep: string) => {
      if (statutPrep === 'PRET') return { bg: '#4CAF5020', color: '#2E7D32', icon: '✅' };
      return { bg: '#FF980020', color: '#E65100', icon: '🔴' };
    };

    const handleUpdateDetail = async (detailId: number, statut: string) => {
      try {
        await commandesApi.updateDetailStatut(detailId, statut);
        showToast.success(statut === 'PRET' ? 'Article prêt !' : 'Statut mis à jour');
        loadCuisineData();
      } catch (err) {
        showToast.error('Impossible de mettre à jour');
      }
    };

    const handleUpdateCmdStatut = async (commandeId: number, statut: string) => {
      try {
        await commandesApi.updateStatut(commandeId, statut);
        showToast.success(`Commande → ${STATUT_LABELS[statut]}`);
        loadCuisineData();
      } catch (err) {
        showToast.error('Impossible de mettre à jour');
      }
    };

    // Header + Stats (composant séparé pour ListHeaderComponent)
    const CuisineHeader = () => (
      <View>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>🍳 Cuisine</Text>
            <Text style={styles.role}>{commandesParTableCuisine.length} tables en attente</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.avatarText}>{(user?.nom || 'C').charAt(0).toUpperCase()}</Text>
            {unreadNotifs > 0 && (
              <View style={styles.avatarBadge}><Text style={styles.avatarBadgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.cuisineStatsRow}>
          <View style={[styles.cuisineStatCard, { backgroundColor: Colors.warning + '15', borderColor: Colors.warning + '40' }]}>
            <Text style={styles.cuisineStatIcon}>⏳</Text>
            <Text style={styles.cuisineStatLabel}>À préparer</Text>
          </View>
          <View style={[styles.cuisineStatCard, { backgroundColor: Colors.accent + '15', borderColor: Colors.accent + '40' }]}>
            <Text style={styles.cuisineStatIcon}>👨‍🍳</Text>
            <Text style={styles.cuisineStatValue}>{nbEnPreparation}</Text>
            <Text style={styles.cuisineStatLabel}>En cours</Text>
          </View>
          <View style={[styles.cuisineStatCard, { backgroundColor: Colors.success + '15', borderColor: Colors.success + '40' }]}>
            <Text style={styles.cuisineStatIcon}>✅</Text>
            <Text style={styles.cuisineStatValue}>{nbPretes}</Text>
            <Text style={styles.cuisineStatLabel}>Prêtes</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>📋 À préparer</Text>
        {loadingCuisine && (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        )}
        {!loadingCuisine && commandesParTableCuisine.length === 0 && (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyDetailIcon}>🍳</Text>
            <Text style={styles.emptyDetailText}>Aucune commande en attente</Text>
          </View>
        )}
      </View>
    );

    const CuisineFooter = () => (
      <View>
        <Text style={styles.sectionTitle}>Accès Rapide</Text>
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
                  <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{item.badge > 9 ? '9+' : item.badge}</Text></View>
                )}
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </View>
    );

    return (
      <FlatList
        data={commandesParTableCuisine}
        keyExtractor={(item: any) => String(item.tableId)}
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListHeaderComponent={<CuisineHeader />}
        ListFooterComponent={<CuisineFooter />}
        renderItem={({ item }: { item: any }) => {
          const isExpanded = expandedTables.has(item.tableId);
          const waitInfo = getWaitColor(item.passeeDepuis);
          return (
            <View style={[styles.cuisineTableGroup, { borderLeftColor: waitInfo.accent }]}>
              <View style={styles.cuisineTableHeader}>
                <TouchableOpacity
                  style={styles.tableHeaderLeft}
                  onPress={() => toggleTable(item.tableId)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tableIcon}>🪑</Text>
                  <View>
                    <Text style={styles.tableNumero}>Table {item.tableNumero}</Text>
                    <Text style={[styles.waitTime, { color: waitInfo.accent }]}>
                      ⏱ {item.passeeDepuis} min d'attente
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toutPretBtn}
                  onPress={() => {
                    commandesApi.toutPret(item.tableId, 'CUISINE').then(() => {
                      showToast.success('Tous les articles cuisine marqués prêts');
                      loadCuisineData();
                    }).catch(() => showToast.error('Impossible de mettre à jour'));
                  }}
                >
                  <Text style={styles.toutPretText}>✅ Tout prêt</Text>
                </TouchableOpacity>
                <Text style={styles.tableGroupTotal}>{formatPrixDevise(item.total, devise)}</Text>
                <TouchableOpacity onPress={() => toggleTable(item.tableId)} activeOpacity={0.7}>
                  <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>
              </View>

              {isExpanded && (
                <View style={styles.cuisineTableDetails}>
                  {item.commandes.map((cmd: any) => (
                    <View key={cmd.id} style={styles.cuisineCommandeBlock}>
                      <View style={styles.cuisineCommandeHeader}>
                        <View style={[styles.cmdBadge, { backgroundColor: (STATUT_COLORS[cmd.statut] || Colors.inputBg) + '20' }]}>
                          <Text style={[styles.cmdBadgeText, { color: STATUT_COLORS[cmd.statut] || Colors.text }]}>
                            {STATUT_LABELS[cmd.statut] || cmd.statut}
                          </Text>
                        </View>
                        <Text style={styles.cmdMontant}>{formatPrixDevise(totalDetails(cmd), devise)}</Text>
                      </View>

                      {cmd.details?.map((d: any) => {
                        const ds = getDetailStatusStyle(d.statutPreparation);
                        return (
                          <View key={d.id} style={styles.cuisineDetailRow}>
                            <Text style={styles.cuisineDetailStatus}>{ds.icon}</Text>
                            <Text style={styles.cuisineDetailQte}>{d.quantite}x</Text>
                            <Text style={styles.cuisineDetailNom}>{d.menu?.nom || 'Article'}</Text>
                            {d.statutPreparation !== 'PRET' ? (
                              <TouchableOpacity
                                style={styles.detailReadyBtn}
                                onPress={() => handleUpdateDetail(d.id, 'PRET')}
                              >
                                <Text style={styles.detailReadyText}>✅ Prêt</Text>
                              </TouchableOpacity>
                            ) : (
                              <Text style={styles.detailDoneLabel}>Prêt</Text>
                            )}
                          </View>
                        );
                      })}

                      <View style={styles.cuisineActions}>
                        {cmd.statut === 'VALIDEE' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: Colors.accent }]}
                            onPress={() => handleUpdateCmdStatut(cmd.id, 'EN_PREPARATION')}
                          >
                            <Text style={styles.actionText}>👨‍🍳 En préparation</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />
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
                              {/* Actions selon le rôle */}
                              <View style={styles.orderActions}>
                                {cmd.statut === 'EN_ATTENTE' && canValidate && (
                                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success }]} onPress={() => handleUpdateStatut(cmd.id, 'SERVEUR_VALIDE')}>
                                    <Text style={styles.actionText}>✓ Valider</Text>
                                  </TouchableOpacity>
                                )}
                                {cmd.statut === 'VALIDEE' && canPrepare && (
                                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.accent }]} onPress={() => handleUpdateStatut(cmd.id, 'EN_PREPARATION')}>
                                    <Text style={styles.actionText}>👨‍🍳 En préparation</Text>
                                  </TouchableOpacity>
                                )}
                                {cmd.statut === 'EN_PREPARATION' && canMarkReady && (
                                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary }]} onPress={() => handleUpdateStatut(cmd.id, 'PRETE')}>
                                    <Text style={styles.actionText}>✅ Prête</Text>
                                  </TouchableOpacity>
                                )}
                                {cmd.statut === 'PRETE' && canMarkServed && (
                                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.info }]} onPress={() => handleUpdateStatut(cmd.id, 'SERVIE')}>
                                    <Text style={styles.actionText}>🍽 Servie</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
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
  statCardWrapper: { width: '22%', margin: '1.5%' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, marginBottom: 40 },
  menuItem: {
    width: '22%',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 10,
    margin: '1.5%',
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
    width: 40, height: 40, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  menuIcon: { fontSize: 18 },
  menuLabel: { fontSize: 10, fontWeight: '700', color: Colors.text, textAlign: 'center' },
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
  // Cashier tabs
  cashierTabs: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 12, gap: 8 },
  cashierTab: {
    flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  cashierTabActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  cashierTabText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  cashierTabTextActive: { color: Colors.textWhite },

  // Search input wrap
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.inputBg, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10,
  },
  searchInputField: { flex: 1, height: 40, fontSize: 13, color: Colors.text },
  searchClear: { fontSize: 16, color: Colors.textLight, paddingLeft: 6 },

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
  orderActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 6 },
  actionBtn: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  actionText: { color: Colors.textWhite, fontWeight: '700', fontSize: 11 },

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
  factureRight: { alignItems: 'flex-end', gap: 4 },
  printIcon: { fontSize: 16 },

  // Bar dashboard
  barHero: {
    backgroundColor: '#F39C12',
    margin: 12, borderRadius: 20, padding: 24, alignItems: 'center',
    shadowColor: '#F39C12', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  barHeroTitle: { color: Colors.textWhite, fontSize: 15, fontWeight: '700', opacity: 0.9 },
  barHeroCount: { color: Colors.textWhite, fontSize: 32, fontWeight: '800', marginTop: 4 },
  barHeroSub: { color: Colors.textWhite, fontSize: 12, opacity: 0.7, marginTop: 6 },
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

  // Cuisine dashboard
  cuisineStatsRow: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 8, gap: 8 },
  cuisineStatCard: {
    flex: 1, borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 1.5,
  },
  cuisineStatIcon: { fontSize: 22, marginBottom: 4 },
  cuisineStatValue: { fontSize: 22, fontWeight: '800', color: Colors.text },
  cuisineStatLabel: { fontSize: 11, color: Colors.textLight, fontWeight: '600', marginTop: 2 },
  cuisineTableGroup: {
    backgroundColor: Colors.surface, borderRadius: 14, marginBottom: 10, marginHorizontal: 12,
    overflow: 'hidden', borderLeftWidth: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  cuisineTableHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
  },
  waitTime: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  cuisineTableDetails: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.inputBg, paddingHorizontal: 10, paddingBottom: 10,
  },
  cuisineCommandeBlock: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  cuisineCommandeHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cmdBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  cmdBadgeText: { fontSize: 11, fontWeight: '700' },
  cmdMontant: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cuisineDetailRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.inputBg,
  },
  cuisineDetailStatus: { fontSize: 14, marginRight: 6, width: 24, textAlign: 'center' },
  cuisineDetailQte: { fontSize: 14, fontWeight: '700', color: Colors.primary, width: 30 },
  cuisineDetailNom: { flex: 1, fontSize: 14, color: Colors.text },
  detailReadyBtn: {
    backgroundColor: Colors.success + '18', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.success + '40',
  },
  detailReadyText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  detailDoneLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.success,
    backgroundColor: Colors.success + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  cuisineActions: {
    flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 6, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  tableGroupRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tableGroupTotal: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  searchRow: {
    flexDirection: 'row', marginHorizontal: 12, marginTop: 8, gap: 8,
  },
  searchInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  searchBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, width: 48, justifyContent: 'center', alignItems: 'center',
  },
  searchBtnText: { fontSize: 18 },
  searchResultCard: {
    backgroundColor: Colors.surface, marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.primary + '30',
  },
  toutPretBtn: {
    backgroundColor: Colors.success + '18', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.success + '40',
  },
  toutPretText: { fontSize: 11, fontWeight: '700', color: Colors.success },

  // Receipt modal
  receiptOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', paddingHorizontal: 20 },
  receiptContent: {
    backgroundColor: Colors.surface, borderRadius: 20, maxHeight: '80%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  receiptHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  receiptTitle: { fontSize: 18, fontWeight: '700', color: Colors.success },
  receiptClose: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.inputBg,
    justifyContent: 'center', alignItems: 'center',
  },
  receiptCloseText: { fontSize: 16, color: Colors.textLight, fontWeight: '600' },
  receiptRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.inputBg,
  },
  printBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  printBtnText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
  closeReceiptBtn: { backgroundColor: Colors.inputBg, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  closeReceiptText: { color: Colors.textLight, fontWeight: '600', fontSize: 14 },
  // Clôtures
  clotureCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, marginHorizontal: 12, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: Colors.border,
  },
  clotureCardIcon: { fontSize: 16 },
  clotureCardText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  clotureItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
});
