import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { formatPrixDevise, selectDevise } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import { commandesApi, tablesApi, menuApi } from '../services/api';
import { getSocket } from '../services/socket';
import { showToast } from '../services/toast';
import CalendarPicker, { toDateStr, formatDisplay } from '../components/CalendarPicker';
import useResponsive from '../hooks/useResponsive';

const STATUT_COLORS: Record<string, string> = {
  EN_ATTENTE: Colors.warning,
  VALIDEE: Colors.info,
  EN_PREPARATION: Colors.accent,
  PRETE: Colors.success,
  SERVIE: Colors.primary,
  PAYEE: Colors.secondary,
  ANNULEE: Colors.danger,
};

const STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  VALIDEE: 'Validée',
  EN_PREPARATION: 'En préparation',
  PRETE: 'Prête',
  SERVIE: 'Servie',
  PAYEE: 'Payée',
  ANNULEE: 'Annulée',
};

export default function CommandesScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const devise = useSelector(selectDevise);
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isServeur = user?.role === 'SERVEUR';
  const { sp, fs } = useResponsive();
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [tab, setTab] = useState<'encours' | 'payees'>('encours');
  const [filterDate, setFilterDate] = useState(toDateStr(new Date()));
  const [showFilterDatePicker, setShowFilterDatePicker] = useState(false);

  // Create order state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [availableMenus, setAvailableMenus] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number>(0);
  const [cart, setCart] = useState<{ menuId: number; nom: string; prix: number; quantite: number }[]>([]);

  const loadCommandes = async () => {
    try {
      let { data } = isManager
        ? await commandesApi.getAll()
        : await commandesApi.getByServeur();
      setCommandes(Array.isArray(data) ? data : []);
    } catch (err) {
      setCommandes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommandes();
    const socket = getSocket();
    if (socket) {
      const refresh = () => loadCommandes();
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
    await loadCommandes();
    setRefreshing(false);
  };

  const handleUpdateStatut = async (id: number, statut: string) => {
    try {
      await commandesApi.updateStatut(id, statut);
      showToast.success(`Commande → ${STATUT_LABELS[statut]}`);
      loadCommandes();
    } catch (err) {
      showToast.error('Impossible de mettre à jour le statut');
    }
  };

  const openCreateModal = async () => {
    try {
      const [tRes, mRes] = await Promise.all([tablesApi.getAll(), menuApi.getMenus()]);
      setAvailableTables(tRes.data || []);
      setAvailableMenus((mRes.data || []).filter((m: any) => m.disponibilite));
      setSelectedTableId(0);
      setCart([]);
    } catch (e) {
      showToast.error('Impossible de charger les données');
      return;
    }
    setShowCreateModal(true);
  };

  const addToCart = (menu: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuId === menu.id);
      if (existing) return prev.map((c) => c.menuId === menu.id ? { ...c, quantite: c.quantite + 1 } : c);
      return [...prev, { menuId: menu.id, nom: menu.nom, prix: Number(menu.prix), quantite: 1 }];
    });
  };
  const removeFromCart = (menuId: number) => setCart((prev) => prev.filter((c) => c.menuId !== menuId));
  const updateQty = (menuId: number, delta: number) => {
    setCart((prev) => prev.map((c) => {
      if (c.menuId !== menuId) return c;
      const newQty = c.quantite + delta;
      return newQty < 1 ? c : { ...c, quantite: newQty };
    }));
  };

  const handleCreateOrder = async () => {
    if (!selectedTableId) return Alert.alert('Erreur', 'Sélectionnez une table');
    if (cart.length === 0) return Alert.alert('Erreur', 'Ajoutez au moins un article');
    try {
      await commandesApi.createFromClient({ tableId: selectedTableId, articles: cart.map((c) => ({ menuId: c.menuId, quantite: c.quantite })) });
      setCart([]);
      setSelectedTableId(0);
      showToast.success('Commande créée');
      loadCommandes();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Impossible de créer la commande');
    }
  };

  const normalizeDate = (dateStr: string) => dateStr ? dateStr.split('T')[0] : '';

  // Commandes en cours (non payées) groupées par session (chaque arrivée client = une session)
  const commandesEnCours = useMemo(() => {
    const filtered = commandes.filter((c) => {
      if (c.statut === 'PAYEE' || c.statut === 'ANNULEE') return false;
      if (filterDate && normalizeDate(c.dateCommande) !== filterDate) return false;
      return true;
    });
    // Grouper par sessionId (des clients différents = sessions différentes)
    const grouped: Record<string, { sessionId: number; tableNum: string; tableId: number; dateArrivee: string; commandes: any[]; total: number }> = {};
    filtered.forEach((c) => {
      const key = String(c.sessionId || 's' + c.tableId + '-' + c.id);
      if (!grouped[key]) {
        grouped[key] = {
          sessionId: c.sessionId || 0,
          tableNum: c.table?.numero || '?',
          tableId: c.tableId,
          dateArrivee: c.session?.dateArrivee || c.dateCommande,
          commandes: [],
          total: 0,
        };
      }
      grouped[key].commandes.push(c);
      grouped[key].total += Number(c.montantTotal);
    });
    return Object.values(grouped);
  }, [commandes, filterDate]);

  // Commandes payées, groupées par session
  const commandesPayees = useMemo(() => {
    const filtered = commandes.filter((c) => {
      if (c.statut !== 'PAYEE') return false;
      if (filterDate && normalizeDate(c.dateCommande) !== filterDate) return false;
      return true;
    });
    const grouped: Record<string, { sessionId: number; tableNum: string; tableId: number; dateArrivee: string; commandes: any[]; total: number }> = {};
    filtered.forEach((c) => {
      const key = String(c.sessionId || 'ps' + c.tableId + '-' + c.id);
      if (!grouped[key]) {
        grouped[key] = {
          sessionId: c.sessionId || 0,
          tableNum: c.table?.numero || '?',
          tableId: c.tableId,
          dateArrivee: c.session?.dateArrivee || c.dateCommande,
          commandes: [],
          total: 0,
        };
      }
      grouped[key].commandes.push(c);
      grouped[key].total += Number(c.montantTotal);
    });
    return Object.values(grouped);
  }, [commandes, filterDate]);

  const totalCart = cart.reduce((sum, c) => sum + c.prix * c.quantite, 0);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Date filter */}
      <TouchableOpacity style={styles.dateBar} onPress={() => setShowFilterDatePicker(true)}>
        <Text style={styles.dateIcon}>📅</Text>
        <Text style={styles.dateText}>{filterDate ? formatDisplay(filterDate) : 'Toutes les dates'}</Text>
      </TouchableOpacity>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'encours' && styles.tabActive]} onPress={() => setTab('encours')}>
          <Text style={[styles.tabText, tab === 'encours' && styles.tabTextActive]}>🛒 En cours</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'payees' && styles.tabActive]} onPress={() => setTab('payees')}>
          <Text style={[styles.tabText, tab === 'payees' && styles.tabTextActive]}>💰 Payées</Text>
        </TouchableOpacity>
      </View>

      {/* Onglet En cours */}
      {tab === 'encours' && (
        <FlatList
          data={commandesEnCours}
          keyExtractor={(item) => 'enc-' + item.sessionId + '-' + item.tableId}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          renderItem={({ item: group }) => (
            <View style={styles.tableGroup}>
              <TouchableOpacity
                style={styles.tableGroupHeader}
                onPress={() => setExpandedGroup(expandedGroup === 'enc-' + group.sessionId + '-' + group.tableId ? null : 'enc-' + group.sessionId + '-' + group.tableId)}
                activeOpacity={0.7}
              >
                <View style={styles.tableGroupLeft}>
                  <Text style={styles.tableGroupNum}>Table {group.tableNum}</Text>
                  <Text style={styles.tableGroupCount}>
                    {new Date(group.dateArrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • {group.commandes.length} cde(s)
                  </Text>
                </View>
                <View style={styles.tableGroupRight}>
                  <Text style={styles.tableGroupTotal}>{formatPrixDevise(group.total, devise)}</Text>
                  <Text style={styles.expandIcon}>{expandedGroup === 'enc-' + group.sessionId + '-' + group.tableId ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>

              {expandedGroup === 'enc-' + group.sessionId + '-' + group.tableId && group.commandes.map((c) => (
                <View key={c.id} style={styles.orderItem}>
                  <View style={styles.orderItemHeader}>
                    <Text style={styles.orderTime}>
                      {new Date(c.dateCommande).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {c.clientRef && <Text style={styles.orderClient}>👤 {c.clientRef}</Text>}
                    <View style={[styles.orderStatus, { backgroundColor: STATUT_COLORS[c.statut] + '18' }]}>
                      <Text style={[styles.orderStatusText, { color: STATUT_COLORS[c.statut] }]}>{STATUT_LABELS[c.statut]}</Text>
                    </View>
                    <Text style={styles.orderTotal}>{formatPrixDevise(c.montantTotal, devise)}</Text>
                  </View>
                  {c.details?.map((d: any) => (
                    <View key={d.id} style={styles.orderDetail}>
                      <Text style={styles.orderQty}>x{d.quantite}</Text>
                      <Text style={styles.orderName}>{d.menu?.nom}</Text>
                      <Text style={styles.orderPrice}>{formatPrixDevise(d.prix, devise)}</Text>
                    </View>
                  ))}
                  {/* Actions */}
                  <View style={styles.orderActions}>
                    {c.statut === 'EN_ATTENTE' && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success }]} onPress={() => handleUpdateStatut(c.id, 'VALIDEE')}>
                        <Text style={styles.actionText}>✓ Valider</Text>
                      </TouchableOpacity>
                    )}
                    {c.statut === 'VALIDEE' && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.accent }]} onPress={() => handleUpdateStatut(c.id, 'EN_PREPARATION')}>
                        <Text style={styles.actionText}>👨‍🍳 En prépa</Text>
                      </TouchableOpacity>
                    )}
                    {c.statut === 'EN_PREPARATION' && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary }]} onPress={() => handleUpdateStatut(c.id, 'PRETE')}>
                        <Text style={styles.actionText}>✅ Prête</Text>
                      </TouchableOpacity>
                    )}
                    {c.statut === 'PRETE' && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.info }]} onPress={() => handleUpdateStatut(c.id, 'SERVIE')}>
                        <Text style={styles.actionText}>🍽 Servie</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🛒</Text>
              <Text style={styles.emptyText}>Aucune commande en cours</Text>
            </View>
          }
        />
      )}

      {/* Onglet Payées */}
      {tab === 'payees' && (
        <FlatList
          data={commandesPayees}
          keyExtractor={(item) => 'paid-' + item.sessionId + '-' + item.tableId}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          renderItem={({ item: group }) => (
            <View style={styles.tableGroup}>
              <TouchableOpacity
                style={styles.tableGroupHeader}
                onPress={() => setExpandedGroup(expandedGroup === 'paid-' + group.sessionId + '-' + group.tableId ? null : 'paid-' + group.sessionId + '-' + group.tableId)}
                activeOpacity={0.7}
              >
                <View style={styles.tableGroupLeft}>
                  <Text style={styles.tableGroupNum}>Table {group.tableNum}</Text>
                  <Text style={styles.tableGroupCount}>
                    {new Date(group.dateArrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • {group.commandes.length} cde(s) payée(s)
                  </Text>
                </View>
                <View style={styles.tableGroupRight}>
                  <Text style={[styles.tableGroupTotal, { color: Colors.success }]}>{formatPrixDevise(group.total, devise)}</Text>
                  <Text style={styles.expandIcon}>{expandedGroup === 'paid-' + group.sessionId + '-' + group.tableId ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>

              {expandedGroup === 'paid-' + group.sessionId + '-' + group.tableId && group.commandes.map((c) => (
                <View key={c.id} style={styles.orderItem}>
                  <View style={styles.orderItemHeader}>
                    <Text style={styles.orderTime}>
                      {new Date(c.dateCommande).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {c.clientRef && <Text style={styles.orderClient}>👤 {c.clientRef}</Text>}
                    <Text style={styles.orderTotal}>{formatPrixDevise(c.montantTotal, devise)}</Text>
                  </View>
                  {c.details?.map((d: any) => (
                    <View key={d.id} style={styles.orderDetail}>
                      <Text style={styles.orderQty}>x{d.quantite}</Text>
                      <Text style={styles.orderName}>{d.menu?.nom}</Text>
                      <Text style={styles.orderPrice}>{formatPrixDevise(Number(d.prix) * d.quantite, devise)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💰</Text>
              <Text style={styles.emptyText}>Aucune commande payée</Text>
            </View>
          }
        />
      )}

      {(isManager || isServeur) && (
        <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Filter Date Picker */}
      <CalendarPicker
        visible={showFilterDatePicker}
        value={filterDate}
        onSelect={(dateStr) => setFilterDate(dateStr)}
        onClose={() => setShowFilterDatePicker(false)}
      />

      {/* Create Order Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouvelle Commande</Text>
            <Text style={styles.fieldLabel}>Table</Text>
            <FlatList
              horizontal
              data={availableTables}
              keyExtractor={(t) => t.id.toString()}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 4 }}
              renderItem={({ item: t }) => (
                <TouchableOpacity
                  style={[styles.tableChip, selectedTableId === t.id && styles.tableChipActive]}
                  onPress={() => setSelectedTableId(t.id)}
                >
                  <Text style={selectedTableId === t.id ? styles.tableChipTextActive : styles.tableChipText}>{t.numero}</Text>
                </TouchableOpacity>
              )}
            />
            <Text style={styles.fieldLabel}>Plats & Boissons</Text>
            <View style={{ maxHeight: 180 }}>
              <FlatList
                data={availableMenus}
                keyExtractor={(m) => m.id.toString()}
                renderItem={({ item: m }) => (
                  <TouchableOpacity style={styles.menuItemRow} onPress={() => addToCart(m)}>
                    <Text style={styles.menuItemName}>{m.nom}</Text>
                    <Text style={styles.menuItemPrice}>{formatPrixDevise(m.prix, devise)}</Text>
                    <Text style={styles.menuItemAdd}>+</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{ color: Colors.textLight, padding: 10 }}>Aucun plat disponible</Text>}
              />
            </View>
            {cart.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Panier</Text>
                {cart.map((c) => (
                  <View key={c.menuId} style={styles.cartRow}>
                    <TouchableOpacity onPress={() => updateQty(c.menuId, -1)}><Text style={styles.cartQtyBtn}>−</Text></TouchableOpacity>
                    <Text style={styles.cartQty}>x{c.quantite}</Text>
                    <TouchableOpacity onPress={() => updateQty(c.menuId, 1)}><Text style={styles.cartQtyBtn}>+</Text></TouchableOpacity>
                    <Text style={styles.cartName}>{c.nom}</Text>
                    <Text style={styles.cartPrice}>{formatPrixDevise(c.prix * c.quantite, devise)}</Text>
                    <TouchableOpacity onPress={() => removeFromCart(c.menuId)}><Text style={styles.cartRemove}>🗑</Text></TouchableOpacity>
                  </View>
                ))}
                <Text style={styles.cartTotal}>Total: {formatPrixDevise(totalCart, devise)}</Text>
              </>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateOrder}><Text style={styles.saveText}>Commander</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dateBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 12, marginTop: 10,
    borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  dateIcon: { fontSize: 16, marginRight: 10 },
  dateText: { fontSize: 14, fontWeight: '600', color: Colors.text, textTransform: 'capitalize', flex: 1 },
  tabRow: { flexDirection: 'row', margin: 12, gap: 8 },
  tab: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textLight },
  tabTextActive: { color: Colors.textWhite },
  list: { padding: 12, paddingBottom: 80 },
  tableGroup: {
    backgroundColor: Colors.surface, borderRadius: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, overflow: 'hidden',
  },
  tableGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  tableGroupLeft: {},
  tableGroupNum: { fontSize: 16, fontWeight: '700', color: Colors.text },
  tableGroupCount: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  tableGroupRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tableGroupTotal: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  expandIcon: { fontSize: 12, color: Colors.textLight },
  orderItem: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 14 },
  orderItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  orderTime: { fontSize: 13, fontWeight: '600', color: Colors.textLight },
  orderClient: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  orderStatus: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  orderStatusText: { fontSize: 11, fontWeight: '700' },
  orderTotal: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginLeft: 'auto' },
  orderDetail: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 8 },
  orderQty: { width: 28, fontWeight: '700', color: Colors.primary, fontSize: 13 },
  orderName: { flex: 1, fontSize: 13, color: Colors.text },
  orderPrice: { fontSize: 13, fontWeight: '600', color: Colors.textLight },
  orderActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 6 },
  actionBtn: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  actionText: { color: Colors.textWhite, fontWeight: '700', fontSize: 11 },
  paidCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8 },
  paidHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  paidTable: { fontSize: 15, fontWeight: '700', color: Colors.text },
  paidDate: { fontSize: 12, color: Colors.textLight },
  paidTotal: { fontSize: 15, fontWeight: '700', color: Colors.success },
  paidDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  paidDetailName: { fontSize: 13, color: Colors.text },
  paidDetailPrice: { fontSize: 13, color: Colors.textLight },
  empty: { alignItems: 'center', padding: 50 },
  emptyIcon: { fontSize: 50, marginBottom: 10 },
  emptyText: { color: Colors.textLight, fontSize: 16 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8 },
  fabText: { color: Colors.textWhite, fontSize: 28, fontWeight: '300', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 16, textAlign: 'center' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.secondary, marginBottom: 8, marginTop: 12 },
  tableChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border },
  tableChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tableChipText: { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  tableChipTextActive: { color: Colors.textWhite, fontWeight: '700' },
  menuItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 4 },
  menuItemName: { flex: 1, fontSize: 14, color: Colors.text },
  menuItemPrice: { fontSize: 14, fontWeight: '600', color: Colors.text, marginRight: 12 },
  menuItemAdd: { fontSize: 20, fontWeight: '700', color: Colors.primary, width: 28, textAlign: 'center' },
  cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cartQtyBtn: { fontSize: 18, fontWeight: '700', color: Colors.primary, paddingHorizontal: 6 },
  cartQty: { fontSize: 14, fontWeight: '700', color: Colors.text, width: 30, textAlign: 'center' },
  cartName: { flex: 1, fontSize: 14, color: Colors.text, marginLeft: 6 },
  cartPrice: { fontSize: 14, fontWeight: '600', color: Colors.primary, marginRight: 8 },
  cartRemove: { fontSize: 14, padding: 4 },
  cartTotal: { fontSize: 16, fontWeight: '800', color: Colors.primary, textAlign: 'right', marginTop: 8 },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 12 },
  cancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { color: Colors.textLight, fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, backgroundColor: Colors.primary, alignItems: 'center' },
  saveText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
});
