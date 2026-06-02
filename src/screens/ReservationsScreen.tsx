import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { Colors } from '../theme/colors';
import { reservationsApi, tablesApi } from '../services/api';
import { showToast } from '../services/toast';

export default function ReservationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({ nomClient: '', telephone: '', nbPersonnes: '1', dateReservation: '', tableId: 0, notes: '' });

  const load = useCallback(async () => {
    try {
      const [rRes, tRes] = await Promise.all([reservationsApi.getAll(dateFilter), tablesApi.getAll()]);
      setReservations(Array.isArray(rRes.data) ? rRes.data : []);
      setTables(Array.isArray(tRes.data) ? tRes.data : []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [dateFilter]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ nomClient: '', telephone: '', nbPersonnes: '1', dateReservation: dateFilter, tableId: 0, notes: '' });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.nomClient || !form.telephone) { showToast.error('Nom et téléphone requis'); return; }
    try {
      const data = { ...form, nbPersonnes: parseInt(form.nbPersonnes) || 1, dateReservation: form.dateReservation || dateFilter, tableId: form.tableId || undefined };
      if (editing) { await reservationsApi.update(editing.id, data); showToast.success('Réservation modifiée'); }
      else { await reservationsApi.create(data); showToast.success('Réservation créée'); }
      setShowForm(false); resetForm(); load();
    } catch (err: any) { showToast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleHonorer = (id: number) => {
    Alert.alert('Honorer ?', 'Le client est arrivé.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Honorer', onPress: async () => { await reservationsApi.honorer(id); load(); showToast.success('Réservation honorée'); } },
    ]);
  };

  const statutColor = (s: string) => {
    switch (s) { case 'EN_ATTENTE': return '#FF9800'; case 'CONFIRMEE': return '#2196F3'; case 'HONOREE': return '#4CAF50'; case 'ANNULEE': return '#F44336'; default: return '#999'; }
  };
  const statutLabel = (s: string) => {
    switch (s) { case 'EN_ATTENTE': return 'En attente'; case 'CONFIRMEE': return 'Confirmée'; case 'HONOREE': return 'Honorée'; case 'ANNULEE': return 'Annulée'; default: return s; }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🪑 Réservations</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowForm(true); }}>
          <Text style={styles.addBtnText}>+ Nouvelle</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <TextInput style={styles.dateInput} value={dateFilter} onChangeText={setDateFilter} placeholder="AAAA-MM-JJ" maxLength={10} keyboardType="numbers-and-punctuation" />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={reservations}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.nomClient}</Text>
                  <Text style={styles.cardSub}>{item.telephone} · {item.nbPersonnes} pers.</Text>
                  <Text style={styles.cardSub}>{new Date(item.dateReservation).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statutColor(item.statut) + '20' }]}>
                  <Text style={[styles.badgeText, { color: statutColor(item.statut) }]}>{statutLabel(item.statut)}</Text>
                </View>
              </View>
              {item.table && <Text style={styles.tableInfo}>🪑 Table {item.table.numero} ({item.table.zone})</Text>}
              {item.notes ? <Text style={styles.notes}>📝 {item.notes}</Text> : null}
              <View style={styles.actions}>
                {item.statut === 'EN_ATTENTE' && (
                  <TouchableOpacity style={styles.actionHonor} onPress={() => handleHonorer(item.id)}>
                    <Text style={styles.actionHonorText}>✅ Honorer</Text>
                  </TouchableOpacity>
                )}
                {(item.statut === 'EN_ATTENTE' || item.statut === 'CONFIRMEE') && (
                  <TouchableOpacity style={styles.actionCancel} onPress={async () => { await reservationsApi.annuler(item.id); load(); }}>
                    <Text style={styles.actionCancelText}>✕ Annuler</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.actionEdit} onPress={() => { setEditing(item); setForm({ nomClient: item.nomClient, telephone: item.telephone, nbPersonnes: String(item.nbPersonnes), dateReservation: item.dateReservation ? new Date(item.dateReservation).toISOString().slice(0, 16) : '', tableId: item.tableId || 0, notes: item.notes || '' }); setShowForm(true); }}>
                  <Text style={styles.actionEditText}>✏️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucune réservation</Text>}
        />
      )}

      <Modal visible={showForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editing ? '✏️ Modifier' : '+ Nouvelle réservation'}</Text>
            <TextInput style={styles.input} placeholder="Nom du client" value={form.nomClient} onChangeText={t => setForm({...form, nomClient: t})} />
            <TextInput style={styles.input} placeholder="Téléphone" value={form.telephone} onChangeText={t => setForm({...form, telephone: t})} keyboardType="phone-pad" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Nb personnes" value={form.nbPersonnes} onChangeText={t => setForm({...form, nbPersonnes: t})} keyboardType="numeric" />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Date (AAAA-MM-JJ)" value={form.dateReservation} onChangeText={t => setForm({...form, dateReservation: t})} maxLength={10} />
            </View>
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerLabel}>Table (optionnel)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {tables.map((t: any) => (
                  <TouchableOpacity key={t.id} style={[styles.tableChip, form.tableId === t.id && styles.tableChipActive]} onPress={() => setForm({...form, tableId: t.id})}>
                    <Text style={[styles.tableChipText, form.tableId === t.id && styles.tableChipTextActive]}>{t.numero}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TextInput style={[styles.input, { height: 60 }]} placeholder="Notes (optionnel)" value={form.notes} onChangeText={t => setForm({...form, notes: t})} multiline />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Enregistrer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); resetForm(); }}>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: Colors.textWhite, fontWeight: '700', fontSize: 14 },
  filterRow: { paddingHorizontal: 16, marginBottom: 8 },
  dateInput: { height: 40, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, fontSize: 14, color: Colors.text },
  list: { padding: 12, paddingBottom: 40 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  cardSub: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  tableInfo: { fontSize: 12, color: Colors.text, marginTop: 6 },
  notes: { fontSize: 12, color: Colors.textLight, marginTop: 4, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 6, marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  actionHonor: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#E8F5E9' },
  actionHonorText: { fontSize: 12, fontWeight: '600', color: '#2E7D32' },
  actionCancel: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FFEBEE' },
  actionCancelText: { fontSize: 12, fontWeight: '600', color: '#C62828' },
  actionEdit: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: Colors.inputBg },
  actionEditText: { fontSize: 14 },
  empty: { textAlign: 'center', color: Colors.textLight, paddingVertical: 40, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  input: { height: 46, backgroundColor: Colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, marginBottom: 10, fontSize: 14, color: Colors.text },
  pickerWrap: { marginBottom: 10 },
  pickerLabel: { fontSize: 13, color: Colors.textLight, marginBottom: 6 },
  tableChip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border },
  tableChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tableChipText: { fontSize: 12, color: Colors.textLight },
  tableChipTextActive: { color: Colors.textWhite, fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: Colors.textWhite, fontWeight: '800', fontSize: 15 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  cancelText: { color: Colors.textLight, fontSize: 14 },
});
