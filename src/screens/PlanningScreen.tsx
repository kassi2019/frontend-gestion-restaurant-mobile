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
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { planningApi, usersApi } from '../services/api';
import { showToast } from '../services/toast';
import ActionSheet from '../components/ActionSheet';

export default function PlanningScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [plannings, setPlannings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedPlanning, setSelectedPlanning] = useState<any>(null);
  const [serveurs, setServeurs] = useState<any[]>([]);
  const [form, setForm] = useState({ jour: '', heureDebut: '08:00', heureFin: '17:00', utilisateurId: 0 });
  const [editForm, setEditForm] = useState({ id: 0, jour: '', heureDebut: '', heureFin: '' });

  useEffect(() => { loadPlannings(); }, []);

  const loadPlannings = async () => {
    try {
      const { data } = await planningApi.getMine();
      setPlannings(Array.isArray(data) ? data : []);
    } catch (err) {
      setPlannings([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlannings();
    setRefreshing(false);
  };

  const openCreateModal = async () => {
    if (isManager) {
      try {
        const { data } = await usersApi.findByRole('SERVEUR');
        setServeurs(Array.isArray(data) ? data : []);
      } catch (e) { setServeurs([]); }
    }
    setForm({ jour: '', heureDebut: '08:00', heureFin: '17:00', utilisateurId: isManager ? 0 : user!.id });
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!form.jour) return Alert.alert('Erreur', 'La date est requise (YYYY-MM-DD)');
    const uid = isManager ? form.utilisateurId : user!.id;
    if (!uid) return Alert.alert('Erreur', 'Sélectionnez un serveur');
    try {
      await planningApi.create({
        utilisateurId: uid,
        jour: form.jour,
        heureDebut: form.heureDebut,
        heureFin: form.heureFin,
      });
      setShowCreateModal(false);
      showToast.success('Planning créé');
      loadPlannings();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Impossible de créer le planning');
    }
  };

  const handleEdit = async () => {
    if (!editForm.jour) return Alert.alert('Erreur', 'La date est requise');
    try {
      await planningApi.update(editForm.id, {
        jour: editForm.jour,
        heureDebut: editForm.heureDebut,
        heureFin: editForm.heureFin,
      });
      setShowEditModal(false);
      showToast.success('Planning modifié');
      loadPlannings();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Impossible de modifier le planning');
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert('Confirmer', 'Supprimer ce planning ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await planningApi.delete(item.id);
            showToast.success('Planning supprimé');
            loadPlannings();
          } catch (e) { showToast.error('Suppression échouée'); }
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const toDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  };

  const toTimeStr = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

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
        data={plannings}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => { setSelectedPlanning(item); if (isManager) setShowActionModal(true); }}
            activeOpacity={isManager ? 0.7 : 1}
          >
            <View style={styles.dateBox}>
              <Text style={styles.dateText}>{formatDate(item.jour)}</Text>
            </View>
            <View style={styles.timeRow}>
              <View style={styles.timeBox}>
                <Text style={styles.timeLabel}>Début</Text>
                <Text style={styles.timeValue}>{formatTime(item.heureDebut)}</Text>
              </View>
              <View style={styles.timeDivider}><View style={styles.dividerLine} /></View>
              <View style={styles.timeBox}>
                <Text style={styles.timeLabel}>Fin</Text>
                <Text style={styles.timeValue}>{formatTime(item.heureFin)}</Text>
              </View>
            </View>
            <View style={[styles.statutBadge, { backgroundColor: item.statut === 'ACTIF' ? Colors.success + '15' : Colors.danger + '15' }]}>
              <Text style={[styles.statutText, { color: item.statut === 'ACTIF' ? Colors.success : Colors.danger }]}>
                {item.statut === 'ACTIF' ? 'Actif' : item.statut === 'ABSENT' ? 'Absent' : 'Congé'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>Aucun planning trouvé</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Action Sheet */}
      <ActionSheet
        visible={showActionModal}
        title="Planning"
        subtitle={selectedPlanning ? formatDate(selectedPlanning.jour) : ''}
        actions={[
          {
            icon: '✏️', label: 'Modifier',
            onPress: () => {
              setShowActionModal(false);
              setEditForm({
                id: selectedPlanning?.id || 0,
                jour: toDateStr(selectedPlanning?.jour),
                heureDebut: toTimeStr(selectedPlanning?.heureDebut),
                heureFin: toTimeStr(selectedPlanning?.heureFin),
              });
              setShowEditModal(true);
            },
          },
          { icon: '🗑', label: 'Supprimer', danger: true, onPress: () => { setShowActionModal(false); handleDelete(selectedPlanning); } },
        ]}
        onClose={() => setShowActionModal(false)}
      />

      {/* Create Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouveau Planning</Text>
            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.field} placeholder="Ex: 2026-05-25" value={form.jour} onChangeText={(t) => setForm({ ...form, jour: t })} />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>Heure début</Text>
                <TextInput style={styles.field} placeholder="08:00" value={form.heureDebut} onChangeText={(t) => setForm({ ...form, heureDebut: t })} />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.fieldLabel}>Heure fin</Text>
                <TextInput style={styles.field} placeholder="17:00" value={form.heureFin} onChangeText={(t) => setForm({ ...form, heureFin: t })} />
              </View>
            </View>
            {isManager && serveurs.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Serveur</Text>
                <View style={styles.chipRow}>
                  {serveurs.map((s) => (
                    <TouchableOpacity key={s.id} style={[styles.optChip, form.utilisateurId === s.id && styles.optChipActive]} onPress={() => setForm({ ...form, utilisateurId: s.id })}>
                      <Text style={form.utilisateurId === s.id ? styles.optChipTextActive : styles.optChipText}>{s.nom}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}><Text style={styles.saveText}>Créer</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier le Planning</Text>
            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.field} placeholder="Ex: 2026-05-25" value={editForm.jour} onChangeText={(t) => setEditForm({ ...editForm, jour: t })} />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>Heure début</Text>
                <TextInput style={styles.field} placeholder="08:00" value={editForm.heureDebut} onChangeText={(t) => setEditForm({ ...editForm, heureDebut: t })} />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.fieldLabel}>Heure fin</Text>
                <TextInput style={styles.field} placeholder="17:00" value={editForm.heureFin} onChangeText={(t) => setEditForm({ ...editForm, heureFin: t })} />
              </View>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleEdit}><Text style={styles.saveText}>Enregistrer</Text></TouchableOpacity>
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
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  dateBox: { marginBottom: 12 },
  dateText: { fontSize: 16, fontWeight: '700', color: Colors.text, textTransform: 'capitalize' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  timeBox: { flex: 1, backgroundColor: Colors.inputBg, borderRadius: 12, padding: 12, alignItems: 'center' },
  timeLabel: { fontSize: 11, color: Colors.textLight, fontWeight: '500', marginBottom: 4 },
  timeValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  timeDivider: { paddingHorizontal: 12, alignItems: 'center' },
  dividerLine: { width: 20, height: 2, backgroundColor: Colors.border },
  statutBadge: { borderRadius: 12, paddingVertical: 6, alignItems: 'center' },
  statutText: { fontWeight: '700', fontSize: 13 },
  fab: {
    position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: Colors.textWhite, fontSize: 28, fontWeight: '300', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 20, textAlign: 'center' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.secondary, marginBottom: 6, marginTop: 12 },
  field: { backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  optChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, marginTop: 4, marginRight: 6, alignSelf: 'flex-start' },
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
});
