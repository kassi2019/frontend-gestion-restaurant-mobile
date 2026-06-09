import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { authApi } from '../services/api';
import { showToast } from '../services/toast';

export default function GenerateCodesScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [dureeJours, setDureeJours] = useState('30');
  const [nombre, setNombre] = useState('5');
  const [generating, setGenerating] = useState(false);
  const [codes, setCodes] = useState<any[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<'dispo' | 'utilises'>('dispo');
  // Gestion plans
  const [plans, setPlans] = useState<any[]>([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planForm, setPlanForm] = useState({ nom: '', dureeJours: '30', prix: '5000' });
  const [savingPlan, setSavingPlan] = useState(false);
  // Paiements en attente
  const [paiementsAttente, setPaiementsAttente] = useState<any[]>([]);

  const toggleCode = (id: number) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadCodes = useCallback(async () => {
    setLoadingCodes(true);
    try {
      const { data } = await authApi.listeCodes();
      setCodes(data || []);
    } catch {
      showToast.error('Impossible de charger les codes');
    } finally {
      setLoadingCodes(false);
    }
  }, []);

  // Recharger automatiquement quand l'écran est affiché
  useFocusEffect(
    useCallback(() => {
      loadCodes();
    }, [loadCodes]),
  );

  const handleDelete = (id: number, codeText: string) => {
    Alert.alert(
      'Supprimer le code',
      `Voulez-vous vraiment supprimer ce code ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await authApi.supprimerCode(id);
              showToast.success('Code supprimé');
              loadCodes();
            } catch (err: any) {
              showToast.error(err.response?.data?.message || 'Erreur suppression');
            }
          },
        },
      ],
    );
  };

  const handleGenerate = async () => {
    const duree = parseInt(dureeJours);
    const nb = parseInt(nombre);
    if (isNaN(duree) || duree < 1) {
      showToast.error('Durée invalide');
      return;
    }
    if (isNaN(nb) || nb < 1 || nb > 100) {
      showToast.error('Nombre entre 1 et 100');
      return;
    }

    setGenerating(true);
    try {
      const { data } = await authApi.genererCodes({ dureeJours: duree, nombre: nb });
      showToast.success(`${data.codes?.length || 0} code(s) généré(s)`);
      loadCodes();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Erreur génération');
    } finally {
      setGenerating(false);
    }
  };

  // ========== Gestion des plans ==========
  const loadPlans = async () => {
    try { const { data } = await authApi.getAllPlans(); setPlans(data || []); } catch {}
  };
  React.useEffect(() => { if (isSuperAdmin) { loadPlans(); loadPaiements(); } }, []);

  const loadPaiements = async () => {
    try { const { data } = await authApi.getPaiementsEnAttente(); setPaiementsAttente(data || []); } catch {}
  };

  const handleConfirmer = async (p: any) => {
    Alert.alert('Confirmer le paiement ?', `${p.restaurant?.nom} — ${Number(p.montant).toLocaleString('fr-FR')} F — ${p.dureeJours}j`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: async () => {
        try { const { data } = await authApi.confirmerPaiement(p.id); showToast.success(data.message || 'Activé'); loadPaiements(); } catch {}
      }},
    ]);
  };

  const handleRejeter = async (p: any) => {
    Alert.alert('Rejeter le paiement ?', p.restaurant?.nom, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Rejeter', style: 'destructive', onPress: async () => {
        try { await authApi.rejeterPaiement(p.id); showToast.success('Rejeté'); loadPaiements(); } catch {}
      }},
    ]);
  };

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
      setShowPlanForm(false); loadPlans();
    } catch (err: any) { showToast.error(err.response?.data?.message || 'Erreur'); }
    finally { setSavingPlan(false); }
  };

  const handleDeletePlan = (p: any) => {
    Alert.alert('Désactiver le plan', `Désactiver "${p.nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Désactiver', style: 'destructive', onPress: async () => {
        try { await authApi.deletePlan(p.id); showToast.success('Plan désactivé'); loadPlans(); } catch {}
      }},
    ]);
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('fr-FR');
    } catch {
      return d;
    }
  };

  if (!isSuperAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.lockIcon}>🔐</Text>
          <Text style={styles.lockText}>Réservé au Super Administrateur</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>🔑 Générer des codes d'activation</Text>

        <Text style={styles.label}>Durée</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.presetBtn, dureeJours === '30' && styles.presetActive]}
              onPress={() => setDureeJours('30')}
            >
              <Text style={[styles.presetText, dureeJours === '30' && styles.presetTextActive]}>30 j</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetBtn, dureeJours === '365' && styles.presetActive]}
              onPress={() => setDureeJours('365')}
            >
              <Text style={[styles.presetText, dureeJours === '365' && styles.presetTextActive]}>1 an</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetBtn, dureeJours === '730' && styles.presetActive]}
              onPress={() => setDureeJours('730')}
            >
              <Text style={[styles.presetText, dureeJours === '730' && styles.presetTextActive]}>2 ans</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetBtn, dureeJours === '1095' && styles.presetActive]}
              onPress={() => setDureeJours('1095')}
            >
              <Text style={[styles.presetText, dureeJours === '1095' && styles.presetTextActive]}>3 ans</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetBtn, dureeJours === '1460' && styles.presetActive]}
              onPress={() => setDureeJours('1460')}
            >
              <Text style={[styles.presetText, dureeJours === '1460' && styles.presetTextActive]}>4 ans</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetBtn, dureeJours === '1825' && styles.presetActive]}
              onPress={() => setDureeJours('1825')}
            >
              <Text style={[styles.presetText, dureeJours === '1825' && styles.presetTextActive]}>5 ans</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <TextInput
          style={styles.inputFull}
          value={dureeJours}
          onChangeText={setDureeJours}
          keyboardType="numeric"
          placeholder="Ou entrez un nombre de jours personnalisé..."
          placeholderTextColor={Colors.textLight}
        />

        <Text style={styles.label}>Nombre de codes</Text>
        <TextInput
          style={styles.inputSmall}
          value={nombre}
          onChangeText={setNombre}
          keyboardType="numeric"
          placeholder="1-100"
          placeholderTextColor={Colors.textLight}
        />

        <TouchableOpacity
          style={[styles.generateBtn, generating && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color={Colors.textWhite} />
          ) : (
            <Text style={styles.generateBtnText}>Générer {nombre} code(s)</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Gestion des plans d'abonnement */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.title}>💎 Plans d'abonnement</Text>
          <TouchableOpacity style={styles.generateBtnSmall} onPress={openNewPlan}>
            <Text style={styles.generateBtnTextSmall}>+ Plan</Text>
          </TouchableOpacity>
        </View>
        {plans.map((p: any) => (
          <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: Colors.text }}>{p.nom}{!p.actif ? ' (Inactif)' : ''}</Text>
              <Text style={{ fontSize: 12, color: Colors.textLight }}>{p.dureeJours} jours · {Number(p.prix).toLocaleString('fr-FR')} F</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => openEditPlan(p)} style={{ padding: 8, backgroundColor: Colors.inputBg, borderRadius: 8 }}>
                <Text>✏️</Text>
              </TouchableOpacity>
              {p.actif && (
                <TouchableOpacity onPress={() => handleDeletePlan(p)} style={{ padding: 8, backgroundColor: Colors.danger + '15', borderRadius: 8 }}>
                  <Text>🗑</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {plans.length === 0 && <Text style={styles.empty}>Aucun plan</Text>}
      </View>

      {/* Modal formulaire plan */}
      {showPlanForm && (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 100, paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>
              {editingPlan ? 'Modifier le plan' : 'Nouveau plan'}
            </Text>
            <Text style={styles.label}>Nom</Text>
            <TextInput style={styles.inputFull} value={planForm.nom} onChangeText={t => setPlanForm({ ...planForm, nom: t })} placeholder="Ex: Mensuel" placeholderTextColor={Colors.textLight} />
            <Text style={styles.label}>Durée (jours)</Text>
            <TextInput style={styles.inputFull} value={planForm.dureeJours} onChangeText={t => setPlanForm({ ...planForm, dureeJours: t })} keyboardType="numeric" placeholderTextColor={Colors.textLight} />
            <Text style={styles.label}>Prix (FCFA)</Text>
            <TextInput style={styles.inputFull} value={planForm.prix} onChangeText={t => setPlanForm({ ...planForm, prix: t })} keyboardType="numeric" placeholderTextColor={Colors.textLight} />
            <TouchableOpacity style={[styles.generateBtn, savingPlan && { opacity: 0.6 }]} onPress={handleSavePlan} disabled={savingPlan}>
              <Text style={styles.generateBtnText}>Enregistrer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPlanForm(false)} style={{ alignItems: 'center', marginTop: 12, paddingVertical: 8 }}>
              <Text style={{ color: Colors.textLight }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Paiements en attente */}
      {paiementsAttente.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.title}>💳 Paiements en attente ({paiementsAttente.length})</Text>
          {paiementsAttente.map((p: any) => (
            <View key={p.id} style={{ backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#FED7AA' }}>
              <Text style={{ fontWeight: '700', color: Colors.text }}>{p.restaurant?.nom || '—'}</Text>
              <Text style={{ fontSize: 12, color: Colors.textLight }}>
                {p.plan?.nom} · {p.dureeJours}j · Réf: {p.reference}
              </Text>
              {p.infosPaiement ? <Text style={{ fontSize: 11, color: Colors.textLight, marginTop: 2 }}>💬 {p.infosPaiement}</Text> : null}
              <Text style={{ fontSize: 11, color: Colors.textLight }}>{new Date(p.dateCreation).toLocaleString('fr-FR')}</Text>
              <Text style={{ fontWeight: '800', color: Colors.primary, fontSize: 16, marginTop: 4 }}>
                {Number(p.montant).toLocaleString('fr-FR')} F
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejeter(p)}>
                  <Text style={styles.rejectBtnText}>❌ Rejeter</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={() => handleConfirmer(p)}>
                  <Text style={styles.confirmBtnText}>✅ Confirmer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Liste des codes avec tabs */}
      <View style={styles.card}>
        {/* Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, tab === 'dispo' && styles.tabActive]}
            onPress={() => setTab('dispo')}
          >
            <Text style={[styles.tabText, tab === 'dispo' && styles.tabTextActive]}>
              🟢 Disponibles ({codes.filter(c => !c.estUtilise).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'utilises' && styles.tabActive]}
            onPress={() => setTab('utilises')}
          >
            <Text style={[styles.tabText, tab === 'utilises' && styles.tabTextActive]}>
              🔴 Utilisés ({codes.filter(c => c.estUtilise).length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contenu */}
        {loadingCodes ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          (tab === 'dispo'
            ? codes.filter(c => !c.estUtilise)
            : codes.filter(c => c.estUtilise)
          ).length === 0 ? (
          <Text style={styles.empty}>
            {tab === 'dispo' ? 'Aucun code disponible' : 'Aucun code utilisé'}
          </Text>
        ) : (
          (tab === 'dispo'
            ? codes.filter(c => !c.estUtilise)
            : codes.filter(c => c.estUtilise)
          ).map((c: any) => {
            const isVisible = visibleIds.has(c.id);
            return (
            <View key={c.id} style={styles.codeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.codeText, c.estUtilise && styles.codeUsed]}>
                  {isVisible && c.codeClair ? c.codeClair : (c.codeMasque || 'RESTO-••••-••••-••••')}
                </Text>
                <Text style={styles.codeMeta}>
                  {c.dureeJours} jours{' '}
                  {c.estUtilise
                    ? `• Utilisé par ${c.restaurant?.nom || '—'}`
                    : '• Disponible'}
                </Text>
                {c.dateUtilisation && (
                  <Text style={styles.codeMeta}>Utilisé le {formatDate(c.dateUtilisation)}</Text>
                )}
              </View>
              <View style={styles.codeActions}>
                <TouchableOpacity style={styles.eyeBtnSmall} onPress={() => toggleCode(c.id)}>
                  <Text style={styles.eyeTextSmall}>{isVisible ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
                {!c.estUtilise && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(c.id, c.codeClair)}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )})
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 12 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 0 },
  inputSmall: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  inputFull: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    fontStyle: 'italic',
  },
  presetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  presetText: { fontSize: 14, fontWeight: '600', color: Colors.textLight },
  presetTextActive: { color: Colors.textWhite },
  generateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  generateBtnText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
  generateBtnSmall: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
  },
  generateBtnTextSmall: { color: Colors.textWhite, fontWeight: '700', fontSize: 13 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  codeText: { fontSize: 15, fontWeight: '700', color: Colors.text, fontFamily: 'monospace' },
  codeUsed: { color: Colors.textLight, textDecorationLine: 'line-through' },
  codeMeta: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  codeActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.danger + '15',
  },
  deleteBtnText: { fontSize: 18 },
  eyeBtnSmall: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary + '10',
  },
  eyeTextSmall: { fontSize: 18 },
  tabBar: {
    flexDirection: 'row', backgroundColor: Colors.inputBg,
    borderRadius: 12, padding: 4, marginBottom: 16,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  tabActive: { backgroundColor: Colors.surface },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textLight },
  tabTextActive: { color: Colors.text },
  empty: { textAlign: 'center', color: Colors.textLight, marginVertical: 20 },
  lockIcon: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  lockText: { fontSize: 14, color: Colors.warning, fontWeight: '600', textAlign: 'center' },
  rejectBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.danger + '15', alignItems: 'center' },
  rejectBtnText: { color: Colors.danger, fontWeight: '700', fontSize: 13 },
  confirmBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.success, alignItems: 'center' },
  confirmBtnText: { color: Colors.textWhite, fontWeight: '700', fontSize: 13 },
});
