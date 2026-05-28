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
  TextInput,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { tablesApi, serveurTablesApi, usersApi, commandesApi } from '../services/api';
import { getSocket } from '../services/socket';
import { showToast } from '../services/toast';
import ModalPicker from '../components/ModalPicker';
import ActionSheet from '../components/ActionSheet';
import useResponsive from '../hooks/useResponsive';

const STATUT_COLORS: Record<string, string> = {
  LIBRE: Colors.success,
  OCCUPEE: Colors.danger,
  RESERVEE: Colors.warning,
};

const ZONES = ['Terrasse', 'Intérieur', 'VIP', 'Comptoir'];

export default function TablesScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigation = useNavigation<any>();
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const { columns, sp } = useResponsive();
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [showStatutModal, setShowStatutModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [newTable, setNewTable] = useState({ numero: '', zone: 'Terrasse' });
  const [editTable, setEditTable] = useState({ id: 0, numero: '', zone: '' });
  const [serveurs, setServeurs] = useState<any[]>([]);

  const loadTables = async () => {
    try {
      if (isManager) {
        const { data } = await tablesApi.getAll();
        setTables(Array.isArray(data) ? data : []);
      } else {
        // Serveur : utilise serveur_tables (affectation basée sur le planning du jour)
        const { data } = await serveurTablesApi.findByServeur();
        const assignedTables = Array.isArray(data)
          ? data.map((a: any) => a.table).filter(Boolean)
          : [];
        setTables(assignedTables);
      }
    } catch (err) {
      showToast.error('Impossible de charger les tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
    const socket = getSocket();
    if (socket) {
      const refresh = () => loadTables();
      socket.on('commande_status_change', refresh);
      socket.on('nouvelle_commande', refresh);
      return () => {
        socket.off('commande_status_change', refresh);
        socket.off('nouvelle_commande', refresh);
      };
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTables();
    setRefreshing(false);
  };

  const handleChangeStatut = async (statut: string) => {
    if (!selectedTable) return;
    try {
      await tablesApi.updateStatut(selectedTable.id, statut);
      setShowStatutModal(false);
      showToast.success(`Table ${selectedTable.numero} → ${statut === 'LIBRE' ? 'Libre' : statut === 'OCCUPEE' ? 'Occupée' : 'Réservée'}`);
      loadTables();
    } catch (err) {
      showToast.error('Impossible de changer le statut');
    }
  };

  const handleCreate = async () => {
    if (!newTable.numero.trim()) return Alert.alert('Erreur', 'Le numéro est requis');
    try {
      await tablesApi.create(newTable);
      setNewTable({ numero: '', zone: 'Terrasse' });
      showToast.success(`Table ${newTable.numero} créée`);
      loadTables();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Impossible de créer la table');
    }
  };

  const handleEdit = async () => {
    if (!editTable.numero.trim()) return Alert.alert('Erreur', 'Le numéro est requis');
    try {
      await tablesApi.update(editTable.id, { numero: editTable.numero, zone: editTable.zone });
      setShowEditModal(false);
      showToast.success(`Table ${editTable.numero} modifiée`);
      loadTables();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Impossible de modifier la table');
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert('Supprimer', `Supprimer la table ${item.numero} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await tablesApi.delete(item.id);
            showToast.success(`Table ${item.numero} supprimée`);
            loadTables();
          } catch (e) { showToast.error('Suppression échouée'); }
        },
      },
    ]);
  };

  const openAssignModal = async () => {
    try {
      const { data } = await usersApi.findByRole('SERVEUR');
      setServeurs(Array.isArray(data) ? data.filter((s: any) => s.statut === 'ACTIF') : []);
    } catch (e) {
      setServeurs([]);
    }
    setShowAssignModal(true);
  };

  const handleAssignServeur = async (serveurId: number) => {
    if (!selectedTable || !serveurId) return;
    try {
      await serveurTablesApi.assign({ utilisateurId: serveurId, tableId: selectedTable.id });
      setShowAssignModal(false);
      showToast.success(`Table ${selectedTable.numero} assignée`);
      loadTables();
    } catch (err) {
      showToast.error('Impossible d\'assigner le serveur');
    }
  };

  const handleRunDailyCheck = () => {
    Alert.alert('Vérification quotidienne', 'Lancer la vérification des plannings et l\'affectation automatique ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Lancer',
        onPress: async () => {
          try {
            const { data } = await serveurTablesApi.runDailyCheck();
            showToast.success(`${data.tablesRedistribuees} tables redistribuées, ${data.desactives} serveurs désactivés`);
            loadTables();
          } catch (e) {
            showToast.error('Échec de la vérification');
          }
        },
      },
    ]);
  };

  const handleShowQrCode = async () => {
    if (!selectedTable) return;
    try {
      const { data } = await tablesApi.getQrCode(selectedTable.id);
      Alert.alert(
        `QR Code - Table ${data.numero}`,
        `Code: ${data.qrCode}`,
        [{ text: 'Fermer', style: 'cancel' }],
      );
    } catch (e) {
      showToast.error('Impossible de récupérer le QR Code');
    }
  };

  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [tableOrders, setTableOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const handleTablePress = (item: any) => {
    setSelectedTable(item);
    if (isManager) {
      setShowActionModal(true);
    } else {
      loadTableOrders(item.id);
    }
  };

  const loadTableOrders = async (tableId: number) => {
    setLoadingOrders(true);
    setShowOrdersModal(true);
    try {
      const { data } = await commandesApi.getByTable(tableId);
      setTableOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setTableOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const statutOptions = [
    { label: 'Libre', value: 'LIBRE' },
    { label: 'Occupée', value: 'OCCUPEE' },
    { label: 'Réservée', value: 'RESERVEE' },
  ];

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
        data={tables}
        keyExtractor={(item) => item.id.toString()}
        numColumns={columns}
        contentContainerStyle={[styles.list, { paddingHorizontal: sp(8) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleTablePress(item)}
            activeOpacity={0.7}
          >
            <View style={[styles.statusDot, { backgroundColor: STATUT_COLORS[item.statut] }]} />
            <Text style={styles.tableNum}>Table {item.numero}</Text>
            <Text style={styles.zone}>{item.zone}</Text>
            <View style={[styles.statutBadge, { backgroundColor: STATUT_COLORS[item.statut] + '18' }]}>
              <Text style={[styles.statutText, { color: STATUT_COLORS[item.statut] }]}>
                {item.statut === 'LIBRE' ? 'Libre' : item.statut === 'OCCUPEE' ? 'Occupée' : 'Réservée'}
              </Text>
            </View>
            {item.serveur && (
              <Text style={styles.serveur}>👤 {item.serveur.nom}</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🪑</Text>
            <Text style={styles.emptyText}>Aucune table trouvée</Text>
          </View>
        }
      />

      {isManager && (
        <>
          <TouchableOpacity style={styles.fab} onPress={() => setShowCreateModal(true)}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.assignFab} onPress={() => navigation.navigate('AssignTables')}>
            <Text style={styles.assignFabText}>👤</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Action Sheet */}
      <ActionSheet
        visible={showActionModal}
        title={`Table ${selectedTable?.numero}`}
        subtitle={`${selectedTable?.zone} ${selectedTable?.serveur ? '• ' + selectedTable.serveur.nom : ''}`}
        actions={[
          { icon: '🔄', label: 'Changer statut', onPress: () => { setShowActionModal(false); setShowStatutModal(true); } },
          { icon: '👤', label: selectedTable?.serveur ? 'Réassigner serveur' : 'Assigner serveur', onPress: () => { setShowActionModal(false); openAssignModal(); } },
          { icon: '📱', label: 'Voir QR Code', onPress: () => { setShowActionModal(false); handleShowQrCode(); } },
          { icon: '✏️', label: 'Modifier', onPress: () => { setShowActionModal(false); setEditTable({ id: selectedTable?.id || 0, numero: selectedTable?.numero || '', zone: selectedTable?.zone || '' }); setShowEditModal(true); } },
          { icon: '🗑', label: 'Supprimer', danger: true, onPress: () => { setShowActionModal(false); handleDelete(selectedTable); } },
        ]}
        onClose={() => setShowActionModal(false)}
      />

      {/* Statut Modal */}
      <ModalPicker
        visible={showStatutModal}
        title={`Table ${selectedTable?.numero} - Changer statut`}
        options={statutOptions}
        selectedValue={selectedTable?.statut || ''}
        onSelect={handleChangeStatut}
        onClose={() => setShowStatutModal(false)}
      />

      {/* Create Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouvelle Table</Text>

            <Text style={styles.fieldLabel}>Numéro</Text>
            <TextInput style={styles.field} placeholder="Ex: T11" value={newTable.numero} onChangeText={(t) => setNewTable({ ...newTable, numero: t })} />

            <Text style={styles.fieldLabel}>Zone</Text>
            <View style={styles.chipRow}>
              {ZONES.map((z) => (
                <TouchableOpacity key={z} style={[styles.optChip, newTable.zone === z && styles.optChipActive]} onPress={() => setNewTable({ ...newTable, zone: z })}>
                  <Text style={newTable.zone === z ? styles.optChipTextActive : styles.optChipText}>{z}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}>
                <Text style={styles.saveText}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier la Table</Text>

            <Text style={styles.fieldLabel}>Numéro</Text>
            <TextInput style={styles.field} placeholder="Ex: T11" value={editTable.numero} onChangeText={(t) => setEditTable({ ...editTable, numero: t })} />

            <Text style={styles.fieldLabel}>Zone</Text>
            <View style={styles.chipRow}>
              {ZONES.map((z) => (
                <TouchableOpacity key={z} style={[styles.optChip, editTable.zone === z && styles.optChipActive]} onPress={() => setEditTable({ ...editTable, zone: z })}>
                  <Text style={editTable.zone === z ? styles.optChipTextActive : styles.optChipText}>{z}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleEdit}>
                <Text style={styles.saveText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Serveur Modal */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assigner un serveur</Text>
            <Text style={{ textAlign: 'center', color: Colors.textLight, marginBottom: 16 }}>
              Table {selectedTable?.numero}
            </Text>
            {serveurs.length === 0 ? (
              <Text style={{ color: Colors.textLight, textAlign: 'center', padding: 20 }}>Aucun serveur actif disponible</Text>
            ) : (
              serveurs.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.assignRow, selectedTable?.serveur?.id === s.id && styles.assignRowActive]}
                  onPress={() => handleAssignServeur(s.id)}
                >
                  <View style={styles.assignAvatar}>
                    <Text style={styles.assignAvatarText}>{s.nom.charAt(0)}</Text>
                  </View>
                  <Text style={styles.assignName}>{s.nom}</Text>
                  {selectedTable?.serveur?.id === s.id && <Text style={styles.assignCurrent}>Actuel</Text>}
                </TouchableOpacity>
              ))
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAssignModal(false)}>
                <Text style={styles.cancelText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Table Orders Modal (Serveur) */}
      <Modal visible={showOrdersModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Commandes - Table {selectedTable?.numero}</Text>
            {loadingOrders ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 30 }} />
            ) : tableOrders.length === 0 ? (
              <Text style={{ textAlign: 'center', color: Colors.textLight, padding: 30 }}>Aucune commande pour cette table</Text>
            ) : (
              <FlatList
                data={tableOrders}
                keyExtractor={(o) => o.id.toString()}
                renderItem={({ item: o }) => (
                  <View style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderDate}>
                        {new Date(o.dateCommande).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <View style={[styles.orderStatus, { backgroundColor: (STATUT_COLORS[o.statut] || Colors.textLight) + '18' }]}>
                        <Text style={[styles.orderStatusText, { color: STATUT_COLORS[o.statut] || Colors.textLight }]}>
                          {o.statut === 'EN_ATTENTE' ? 'En attente' : o.statut === 'VALIDEE' ? 'Validée' : o.statut === 'EN_PREPARATION' ? 'En préparation' : o.statut === 'PRETE' ? 'Prête' : o.statut === 'SERVIE' ? 'Servie' : o.statut === 'PAYEE' ? 'Payée' : o.statut}
                        </Text>
                      </View>
                    </View>
                    {o.details?.map((d: any) => (
                      <View key={d.id} style={styles.orderDetail}>
                        <Text style={styles.orderQty}>x{d.quantite}</Text>
                        <Text style={styles.orderName}>{d.menu?.nom}</Text>
                      </View>
                    ))}
                    {o.clientRef && <Text style={styles.orderClient}>👤 {o.clientRef}</Text>}
                  </View>
                )}
              />
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowOrdersModal(false)}>
              <Text style={styles.cancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Daily Check button (Manager only) */}
      {isManager && (
        <TouchableOpacity style={styles.checkFab} onPress={handleRunDailyCheck}>
          <Text style={styles.checkFabText}>🔄</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, paddingBottom: 80 },
  card: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 16, margin: 6,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6, position: 'absolute', top: 10, right: 10 },
  tableNum: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 8 },
  zone: { fontSize: 13, color: Colors.textLight, marginTop: 4 },
  statutBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10 },
  statutText: { fontSize: 12, fontWeight: '600' },
  serveur: { fontSize: 12, color: Colors.textLight, marginTop: 8 },
  fab: {
    position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: Colors.textWhite, fontSize: 28, fontWeight: '300', marginTop: -2 },
  assignFab: {
    position: 'absolute', bottom: 160, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  assignFabText: { fontSize: 22 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 20, textAlign: 'center' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.secondary, marginBottom: 6, marginTop: 12 },
  field: {
    backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46,
    fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  optChip: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border,
    marginTop: 4, marginRight: 6, alignSelf: 'flex-start',
  },
  optChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optChipText: { fontSize: 13, color: Colors.textLight },
  optChipTextActive: { fontSize: 13, color: Colors.textWhite, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
  cancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { color: Colors.textLight, fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, backgroundColor: Colors.primary, alignItems: 'center' },
  saveText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
  empty: { alignItems: 'center', padding: 50 },
  emptyIcon: { fontSize: 50, marginBottom: 10 },
  emptyText: { color: Colors.textLight, fontSize: 16 },
  assignRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 6, backgroundColor: Colors.inputBg,
  },
  assignRowActive: { backgroundColor: Colors.primary + '15' },
  assignAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  assignAvatarText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  assignName: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  assignCurrent: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  checkFab: {
    position: 'absolute', bottom: 90, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  checkFabText: { fontSize: 22 },
  orderCard: { backgroundColor: Colors.inputBg, borderRadius: 12, padding: 12, marginBottom: 8 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderDate: { fontSize: 14, fontWeight: '600', color: Colors.text },
  orderStatus: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  orderStatusText: { fontSize: 11, fontWeight: '700' },
  orderDetail: { flexDirection: 'row', paddingVertical: 4, gap: 8 },
  orderQty: { width: 30, fontWeight: '700', color: Colors.primary, fontSize: 13 },
  orderName: { fontSize: 13, color: Colors.text },
  orderClient: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 4 },
});
