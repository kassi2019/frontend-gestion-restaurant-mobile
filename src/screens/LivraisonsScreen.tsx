import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Modal, TextInput } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { formatPrixDevise, selectDevise } from '../store/slices/authSlice';
import { commandesApi, usersApi } from '../services/api';
import { showToast } from '../services/toast';

export default function LivraisonsScreen() {
  const devise = useSelector(selectDevise);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [livraisons, setLivraisons] = useState<any[]>([]);
  const [livreurs, setLivreurs] = useState<any[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [assignForm, setAssignForm] = useState({ livreurId: 0, adresse: '', frais: '' });

  const load = useCallback(async () => {
    try {
      const [lRes, uRes] = await Promise.all([commandesApi.getAll(), usersApi.findByRole('LIVREUR')]);
      const all = Array.isArray(lRes.data) ? lRes.data : [];
      setLivraisons(all.filter((c: any) => c.adresseLivraison || c.statutLivraison));
      setLivreurs(Array.isArray(uRes.data) ? uRes.data.filter((s: any) => s.statut === 'ACTIF') : []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAssign = async () => {
    if (!selectedId || !assignForm.livreurId) return;
    try {
      await commandesApi.assignerLivraison(selectedId, assignForm.livreurId, assignForm.adresse || undefined, parseFloat(assignForm.frais) || undefined);
      showToast.success('Livraison assignée'); setShowAssign(false); load();
    } catch { showToast.error('Erreur'); }
  };

  const handleStatut = async (id: number, statut: string) => {
    try { await commandesApi.updateStatutLivraison(id, statut); load(); } catch { showToast.error('Erreur'); }
  };

  const statutColor = (s: string) => {
    switch (s) { case 'A_LIVRER': return '#FF9800'; case 'EN_COURS': return '#2196F3'; case 'LIVREE': return '#4CAF50'; case 'ECHEC': return '#F44336'; default: return '#999'; }
  };
  const statutLabel = (s: string) => {
    switch (s) { case 'A_LIVRER': return 'À livrer'; case 'EN_COURS': return 'En cours'; case 'LIVREE': return 'Livrée'; case 'ECHEC': return 'Échec'; default: return s; }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚚 Livraisons</Text>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View> : (
        <FlatList
          data={livraisons}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>CMD #{String(item.id).padStart(4, '0')}</Text>
                  <Text style={styles.cardSub}>{formatPrixDevise(item.montantTotal, devise)}</Text>
                  {item.adresseLivraison ? <Text style={styles.cardAdresse}>📍 {item.adresseLivraison}</Text> : null}
                </View>
                {item.statutLivraison && (
                  <View style={[styles.badge, { backgroundColor: statutColor(item.statutLivraison) + '20' }]}>
                    <Text style={[styles.badgeText, { color: statutColor(item.statutLivraison) }]}>{statutLabel(item.statutLivraison)}</Text>
                  </View>
                )}
              </View>
              {item.livreur && <Text style={styles.livreur}>👤 Livreur: {item.livreur.nom}</Text>}
              <View style={styles.actions}>
                {!item.statutLivraison && (
                  <TouchableOpacity style={styles.actionAssign} onPress={() => { setSelectedId(item.id); setAssignForm({ livreurId: livreurs[0]?.id || 0, adresse: item.adresseLivraison || '', frais: item.fraisLivraison ? String(item.fraisLivraison) : '' }); setShowAssign(true); }}>
                    <Text style={styles.actionAssignText}>🚚 Assigner</Text>
                  </TouchableOpacity>
                )}
                {item.statutLivraison === 'A_LIVRER' && (
                  <TouchableOpacity style={styles.actionGo} onPress={() => handleStatut(item.id, 'EN_COURS')}>
                    <Text style={styles.actionGoText}>▶ En cours</Text>
                  </TouchableOpacity>
                )}
                {item.statutLivraison === 'EN_COURS' && (
                  <>
                    <TouchableOpacity style={styles.actionOk} onPress={() => handleStatut(item.id, 'LIVREE')}>
                      <Text style={styles.actionOkText}>✅ Livrée</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionFail} onPress={() => handleStatut(item.id, 'ECHEC')}>
                      <Text style={styles.actionFailText}>✕ Échec</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucune livraison</Text>}
        />
      )}

      <Modal visible={showAssign} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🚚 Assigner une livraison</Text>
            <Text style={styles.label}>Livreur</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {livreurs.map((l: any) => (
                <TouchableOpacity key={l.id} style={[styles.chip, assignForm.livreurId === l.id && styles.chipActive]} onPress={() => setAssignForm({...assignForm, livreurId: l.id})}>
                  <Text style={[styles.chipText, assignForm.livreurId === l.id && styles.chipTextActive]}>{l.nom}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="Adresse de livraison" value={assignForm.adresse} onChangeText={t => setAssignForm({...assignForm, adresse: t})} />
            <TextInput style={styles.input} placeholder="Frais de livraison" value={assignForm.frais} onChangeText={t => setAssignForm({...assignForm, frais: t})} keyboardType="numeric" />
            <TouchableOpacity style={styles.saveBtn} onPress={handleAssign}>
              <Text style={styles.saveBtnText}>✅ Assigner</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAssign(false)}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  list: { padding: 12, paddingBottom: 40 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  cardSub: { fontSize: 13, color: Colors.textLight, marginTop: 2 },
  cardAdresse: { fontSize: 12, color: Colors.textLight, marginTop: 4 },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  livreur: { fontSize: 12, color: Colors.text, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 6, marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  actionAssign: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FFF3E0' },
  actionAssignText: { fontSize: 13, fontWeight: '600', color: '#E65100' },
  actionGo: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#E3F2FD' },
  actionGoText: { fontSize: 13, fontWeight: '600', color: '#1565C0' },
  actionOk: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#E8F5E9' },
  actionOkText: { fontSize: 13, fontWeight: '600', color: '#2E7D32' },
  actionFail: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FFEBEE' },
  actionFailText: { fontSize: 13, fontWeight: '600', color: '#C62828' },
  empty: { textAlign: 'center', color: Colors.textLight, paddingVertical: 40, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textLight },
  chipTextActive: { color: Colors.textWhite, fontWeight: '600' },
  input: { height: 46, backgroundColor: Colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, marginBottom: 10, fontSize: 14, color: Colors.text },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: Colors.textWhite, fontWeight: '800', fontSize: 15 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  cancelText: { color: Colors.textLight, fontSize: 14 },
});
