import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { authApi } from '../services/api';
import { showToast } from '../services/toast';

export default function DashboardAdminScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigation = useNavigation<any>();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [paiementsAttente, setPaiementsAttente] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Gestion plans
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planForm, setPlanForm] = useState({ nom: '', dureeJours: '30', prix: '5000' });
  const [savingPlan, setSavingPlan] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dashboardRes, plansRes, paiementsRes] = await Promise.all([
        authApi.getDashboard(),
        authApi.getAllPlans(),
        authApi.getPaiementsEnAttente(),
      ]);
      setData(dashboardRes.data);
      setPlans(plansRes.data || []);
      setPaiementsAttente(paiementsRes.data || []);
    } catch { /* */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const openNewPlan = () => { setEditingPlan(null); setPlanForm({ nom: '', dureeJours: '30', prix: '5000' }); setShowPlanForm(true); };
  const openEditPlan = (p: any) => { setEditingPlan(p); setPlanForm({ nom: p.nom, dureeJours: String(p.dureeJours), prix: String(p.prix) }); setShowPlanForm(true); };

  const handleSavePlan = async () => {
    if (!planForm.nom || !planForm.dureeJours || !planForm.prix) { showToast.error('Tous les champs sont requis'); return; }
    setSavingPlan(true);
    try {
      if (editingPlan) {
        await authApi.updatePlan(editingPlan.id, { nom: planForm.nom, dureeJours: parseInt(planForm.dureeJours), prix: parseFloat(planForm.prix) });
        showToast.success('Plan mis à jour');
      } else {
        await authApi.createPlan({ nom: planForm.nom, dureeJours: parseInt(planForm.dureeJours), prix: parseFloat(planForm.prix) });
        showToast.success('Plan créé');
      }
      setShowPlanForm(false);
      const { data } = await authApi.getAllPlans();
      setPlans(data || []);
    } catch (err: any) { showToast.error(err.response?.data?.message || 'Erreur'); }
    finally { setSavingPlan(false); }
  };

  const handleDeletePlan = (p: any) => {
    Alert.alert('Désactiver le plan ?', `Désactiver "${p.nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Désactiver', style: 'destructive', onPress: async () => {
        try { await authApi.deletePlan(p.id); showToast.success('Plan désactivé'); const { data } = await authApi.getAllPlans(); setPlans(data || []); } catch {}
      }},
    ]);
  };

  if (!isSuperAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.lockText}>🔐 Réservé au Super Administrateur</Text>
      </View>
    );
  }

  const format = (d: string) => {
    try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : data ? (
        <>
          {/* Stats */}
          {/* <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: Colors.primary + '15' }]}>
              <Text style={[styles.statNumber, { color: Colors.primary }]}>{data.totalRestos}</Text>
              <Text style={styles.statLabel}>Total Restos</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.success + '15' }]}>
              <Text style={[styles.statNumber, { color: Colors.success }]}>{data.restosValides}</Text>
              <Text style={styles.statLabel}>En règle</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.warning + '15' }]}>
              <Text style={[styles.statNumber, { color: Colors.warning }]}>{data.restosEssai}</Text>
              <Text style={styles.statLabel}>En essai</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.danger + '15' }]}>
              <Text style={[styles.statNumber, { color: Colors.danger }]}>{data.restosExpires}</Text>
              <Text style={styles.statLabel}>Expirés</Text>
            </View>
          </View> */}

          {/* Codes */}
          {/* <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>🔑 Codes d'activation</Text>
              <TouchableOpacity style={styles.genBtn} onPress={() => navigation.navigate('GenerateCodes')}>
                <Text style={styles.genBtnText}>+ Générer</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.codeStats}>
              <Text style={styles.codeStat}>🟢 {data.codes.dispo} disponibles</Text>
              <Text style={styles.codeStat}>🔴 {data.codes.utilises} utilisés</Text>
              <Text style={styles.codeStat}>📊 {data.codes.total} total</Text>
            </View>
          </View> */}

          {/* Paiements en attente */}
          {paiementsAttente.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionTitle}>💳 Paiements en attente</Text>
                <View style={[styles.badge, { backgroundColor: Colors.warning + '20' }]}>
                  <Text style={[styles.badgeText, { color: Colors.warning }]}>{paiementsAttente.length}</Text>
                </View>
              </View>
              {paiementsAttente.map((p: any) => (
                <View key={p.id} style={styles.paiementRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paiementName}>{p.restaurant?.nom || '—'}</Text>
                    <Text style={styles.paiementMeta}>{p.plan?.nom} · {p.dureeJours}j</Text>
                  </View>
                  <Text style={styles.paiementMontant}>{Number(p.montant).toLocaleString('fr-FR')} F</Text>
                </View>
              ))}
              <TouchableOpacity
                style={styles.voirBtn}
                onPress={() => navigation.navigate('GenerateCodes')}
              >
                <Text style={styles.voirBtnText}>Tout voir →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Liste restaurants */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>🏪 Restaurants</Text>
              <TouchableOpacity style={styles.genBtn} onPress={() => navigation.navigate('CreerRestaurant')}>
                <Text style={styles.genBtnText}>+ Nouveau Restaurant</Text>
              </TouchableOpacity>
            </View>
            {data.restaurants?.map((r: any) => (
              <View key={r.id} style={styles.restoRow}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => navigation.navigate('HistoriqueAbonnement', { restaurantId: r.id, restaurantNom: r.nom })}
                >
                  <View>
                    <Text style={styles.restoName}>{r.nom}</Text>
                    <Text style={styles.restoMeta}>
                      {r.typeAbonnement === 'TRIAL' ? '🆓 Essai' :
                       r.typeAbonnement === 'MENSUEL' ? '📅 Mensuel' :
                       r.typeAbonnement === 'ANNUEL' ? '📆 Annuel' : r.typeAbonnement}
                      {' · '}{r._count?.utilisateurs || 0} utilisateurs
                    </Text>
                    {r.dateFinAbonnement && (
                      <Text style={styles.restoMeta}>
                        Expire le {format(r.dateFinAbonnement)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.moduleBtn}
                  onPress={() => navigation.navigate('RestaurantModules', { restaurantId: r.id, restaurantNom: r.nom })}
                >
                  <Text style={styles.moduleBtnIcon}>🧩</Text>
                  <Text style={styles.moduleBtnLabel}>Modules</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.arrowBtn}
                  onPress={() => navigation.navigate('HistoriqueAbonnement', { restaurantId: r.id, restaurantNom: r.nom })}
                >
                  <Text style={styles.arrow}>›</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Plans d'abonnement */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>💎 Plans d'abonnement</Text>
              <TouchableOpacity style={styles.genBtn} onPress={openNewPlan}>
                <Text style={styles.genBtnText}>+ Plan</Text>
              </TouchableOpacity>
            </View>
            {plans.length === 0 ? (
              <Text style={styles.emptyPlanText}>Aucun plan configuré</Text>
            ) : (
              plans.map((p: any) => (
                <View key={p.id} style={styles.planRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>
                      {p.nom}
                      {!p.actif && <Text style={{ color: Colors.danger }}> (Inactif)</Text>}
                    </Text>
                    <Text style={styles.restoMeta}>{p.dureeJours} jours · {Number(p.prix).toLocaleString('fr-FR')} F</Text>
                  </View>
                  <View style={styles.planActions}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEditPlan(p)}>
                      <Text>✏️</Text>
                    </TouchableOpacity>
                    {p.actif && (
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeletePlan(p)}>
                        <Text>🗑</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Modal formulaire plan */}
          {showPlanForm && (
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{editingPlan ? 'Modifier le plan' : 'Nouveau plan'}</Text>
                <Text style={styles.label}>Nom</Text>
                <TextInput style={styles.modalInput} value={planForm.nom} onChangeText={t => setPlanForm({ ...planForm, nom: t })} placeholder="Ex: Mensuel" placeholderTextColor={Colors.textLight} />
                <Text style={styles.label}>Durée (jours)</Text>
                <TextInput style={styles.modalInput} value={planForm.dureeJours} onChangeText={t => setPlanForm({ ...planForm, dureeJours: t })} keyboardType="numeric" placeholderTextColor={Colors.textLight} />
                <Text style={styles.label}>Prix (FCFA)</Text>
                <TextInput style={styles.modalInput} value={planForm.prix} onChangeText={t => setPlanForm({ ...planForm, prix: t })} keyboardType="numeric" placeholderTextColor={Colors.textLight} />
                <TouchableOpacity style={[styles.genBtn, styles.modalSaveBtn, savingPlan && { opacity: 0.6 }]} onPress={handleSavePlan} disabled={savingPlan}>
                  <Text style={styles.genBtnText}>{editingPlan ? 'Enregistrer' : 'Créer'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPlanForm(false)}>
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      ) : (
        <Text style={styles.emptyText}>Aucune donnée</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  lockText: { textAlign: 'center', color: Colors.warning, fontSize: 16, fontWeight: '600', marginTop: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47%', borderRadius: 14, padding: 16, alignItems: 'center',
  },
  statNumber: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, color: Colors.textLight, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  genBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  genBtnText: { color: Colors.textWhite, fontSize: 13, fontWeight: '700' },
  codeStats: { flexDirection: 'row', justifyContent: 'space-around' },
  codeStat: { fontSize: 14, fontWeight: '600', color: Colors.text },
  restoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  restoName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  restoMeta: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  moduleBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.primary + '10', marginRight: 4,
  },
  moduleBtnIcon: { fontSize: 18 },
  moduleBtnLabel: { fontSize: 9, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  arrowBtn: { paddingLeft: 4, paddingVertical: 8 },
  arrow: { fontSize: 22, color: Colors.textLight },
  // Paiements en attente
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  paiementRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  paiementName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  paiementMeta: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  paiementMontant: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  voirBtn: { alignItems: 'center', paddingTop: 10 },
  voirBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  // Plans
  planRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  planName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  planActions: { flexDirection: 'row', gap: 8 },
  editBtn: { padding: 8, backgroundColor: Colors.inputBg, borderRadius: 8 },
  deleteBtn: { padding: 8, backgroundColor: Colors.danger + '15', borderRadius: 8 },
  emptyPlanText: { textAlign: 'center', color: Colors.textLight, paddingVertical: 16 },
  emptyText: { textAlign: 'center', color: Colors.textLight, marginTop: 40 },
  // Modal plan
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 100, paddingHorizontal: 24 },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.secondary, marginBottom: 6, marginTop: 10 },
  modalInput: { backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  modalSaveBtn: { marginTop: 20, paddingVertical: 12, alignItems: 'center' },
  modalCancel: { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  modalCancelText: { color: Colors.textLight, fontSize: 14 },
});
