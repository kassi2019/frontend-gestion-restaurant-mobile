import React, { useEffect, useState } from 'react';
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
import { Colors } from '../theme/colors';
import { commandesApi, tablesApi, menuApi } from '../services/api';
import { showToast } from '../services/toast';

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
  const isServeur = user?.role === 'SERVEUR' || user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Create order state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [availableMenus, setAvailableMenus] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number>(0);
  const [cart, setCart] = useState<{ menuId: number; nom: string; prix: number; quantite: number }[]>([]);

  const loadCommandes = async () => {
    try {
      let { data } = await commandesApi.getByServeur();
      setCommandes(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast.error('Impossible de charger les commandes');
      setCommandes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCommandes(); }, []);

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
      if (existing) {
        return prev.map((c) => c.menuId === menu.id ? { ...c, quantite: c.quantite + 1 } : c);
      }
      return [...prev, { menuId: menu.id, nom: menu.nom, prix: Number(menu.prix), quantite: 1 }];
    });
  };

  const removeFromCart = (menuId: number) => {
    setCart((prev) => prev.filter((c) => c.menuId !== menuId));
  };

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
      await commandesApi.createFromClient({
        tableId: selectedTableId,
        articles: cart.map((c) => ({ menuId: c.menuId, quantite: c.quantite })),
      });
      setShowCreateModal(false);
      showToast.success('Commande créée');
      loadCommandes();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Impossible de créer la commande');
    }
  };

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
      <FlatList
        data={commandes}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.tableLabel}>Table {item.table?.numero}</Text>
                {item.clientRef && (
                  <Text style={styles.clientRef}>👤 {item.clientRef}</Text>
                )}
                <Text style={styles.date}>
                  {new Date(item.dateCommande).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <View style={[styles.statutBadge, { backgroundColor: STATUT_COLORS[item.statut] + '18' }]}>
                  <Text style={[styles.statutText, { color: STATUT_COLORS[item.statut] }]}>
                    {STATUT_LABELS[item.statut]}
                  </Text>
                </View>
                <Text style={styles.total}>{Number(item.montantTotal).toFixed(2)} €</Text>
              </View>
            </TouchableOpacity>

            {expandedId === item.id && (
              <View style={styles.details}>
                <Text style={styles.detailsTitle}>Articles</Text>
                {item.details?.map((d: any) => (
                  <View key={d.id} style={styles.detailRow}>
                    <Text style={styles.detailQty}>x{d.quantite}</Text>
                    <Text style={styles.detailName}>{d.menu?.nom}</Text>
                    <Text style={styles.detailPrice}>{Number(d.prix).toFixed(2)} €</Text>
                  </View>
                ))}

                <View style={styles.actions}>
                  {item.statut === 'EN_ATTENTE' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.success }]}
                      onPress={() => handleUpdateStatut(item.id, 'VALIDEE')}
                    >
                      <Text style={styles.actionText}>✓ Valider</Text>
                    </TouchableOpacity>
                  )}
                  {item.statut === 'VALIDEE' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.accent }]}
                      onPress={() => handleUpdateStatut(item.id, 'EN_PREPARATION')}
                    >
                      <Text style={styles.actionText}>👨‍🍳 En préparation</Text>
                    </TouchableOpacity>
                  )}
                  {item.statut === 'EN_PREPARATION' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
                      onPress={() => handleUpdateStatut(item.id, 'PRETE')}
                    >
                      <Text style={styles.actionText}>✅ Prête</Text>
                    </TouchableOpacity>
                  )}
                  {item.statut === 'PRETE' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.info }]}
                      onPress={() => handleUpdateStatut(item.id, 'SERVIE')}
                    >
                      <Text style={styles.actionText}>🍽 Servie</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>Aucune commande</Text>
          </View>
        }
      />

      {isServeur && (
        <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Create Order Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouvelle Commande</Text>

            {/* Table selection */}
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
                  <Text style={selectedTableId === t.id ? styles.tableChipTextActive : styles.tableChipText}>
                    {t.numero}
                  </Text>
                </TouchableOpacity>
              )}
            />

            {/* Menu items */}
            <Text style={styles.fieldLabel}>Plats & Boissons</Text>
            <View style={{ maxHeight: 180 }}>
              <FlatList
                data={availableMenus}
                keyExtractor={(m) => m.id.toString()}
                renderItem={({ item: m }) => (
                  <TouchableOpacity style={styles.menuItemRow} onPress={() => addToCart(m)}>
                    <Text style={styles.menuItemName}>{m.nom}</Text>
                    <Text style={styles.menuItemPrice}>{Number(m.prix).toFixed(2)} €</Text>
                    <Text style={styles.menuItemAdd}>+</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{ color: Colors.textLight, padding: 10 }}>Aucun plat disponible</Text>}
              />
            </View>

            {/* Cart */}
            {cart.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Panier</Text>
                {cart.map((c) => (
                  <View key={c.menuId} style={styles.cartRow}>
                    <TouchableOpacity onPress={() => updateQty(c.menuId, -1)}>
                      <Text style={styles.cartQtyBtn}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.cartQty}>x{c.quantite}</Text>
                    <TouchableOpacity onPress={() => updateQty(c.menuId, 1)}>
                      <Text style={styles.cartQtyBtn}>+</Text>
                    </TouchableOpacity>
                    <Text style={styles.cartName}>{c.nom}</Text>
                    <Text style={styles.cartPrice}>{(c.prix * c.quantite).toFixed(2)} €</Text>
                    <TouchableOpacity onPress={() => removeFromCart(c.menuId)}>
                      <Text style={styles.cartRemove}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <Text style={styles.cartTotal}>Total: {totalCart.toFixed(2)} €</Text>
              </>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateOrder}>
                <Text style={styles.saveText}>Commander</Text>
              </TouchableOpacity>
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
  list: { padding: 12, paddingBottom: 80 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  tableLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  clientRef: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  date: { fontSize: 13, color: Colors.textLight, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  statutBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statutText: { fontSize: 11, fontWeight: '700' },
  total: { fontSize: 16, fontWeight: '700', color: Colors.primary, marginTop: 6 },
  details: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 16 },
  detailsTitle: { fontSize: 14, fontWeight: '600', color: Colors.textLight, marginBottom: 10 },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  detailQty: { width: 36, fontWeight: '700', color: Colors.primary, fontSize: 14 },
  detailName: { flex: 1, fontSize: 14, color: Colors.text },
  detailPrice: { fontSize: 14, fontWeight: '600', color: Colors.text },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 8 },
  actionBtn: {
    borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  actionText: { color: Colors.textWhite, fontWeight: '700', fontSize: 13 },
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: Colors.textWhite, fontSize: 28, fontWeight: '300', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 16, textAlign: 'center' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.secondary, marginBottom: 8, marginTop: 12 },
  tableChip: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8,
    backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border,
  },
  tableChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tableChipText: { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  tableChipTextActive: { color: Colors.textWhite, fontWeight: '700' },
  menuItemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 4,
  },
  menuItemName: { flex: 1, fontSize: 14, color: Colors.text },
  menuItemPrice: { fontSize: 14, fontWeight: '600', color: Colors.text, marginRight: 12 },
  menuItemAdd: { fontSize: 20, fontWeight: '700', color: Colors.primary, width: 28, textAlign: 'center' },
  cartRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
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
  empty: { alignItems: 'center', padding: 50 },
  emptyIcon: { fontSize: 50, marginBottom: 10 },
  emptyText: { color: Colors.textLight, fontSize: 16 },
});
