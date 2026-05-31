import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { tablesApi, serveurTablesApi, usersApi } from '../services/api';
import { showToast } from '../services/toast';

type Mode = 'affectation' | 'transfert';

export default function AssignTablesScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const [serveurs, setServeurs] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>('affectation');

  // Mode affectation
  const [selectedServeurId, setSelectedServeurId] = useState<number | null>(null);
  const [checkedTableIds, setCheckedTableIds] = useState<Set<number>>(new Set());

  // Mode transfert
  const [fromServeurId, setFromServeurId] = useState<number | null>(null);
  const [toServeurId, setToServeurId] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [serveursRes, tablesRes] = await Promise.all([
        usersApi.findByRole('SERVEUR'),
        tablesApi.getAll(),
      ]);
      const actifs = (Array.isArray(serveursRes.data) ? serveursRes.data : [])
        .filter((s: any) => s.statut === 'ACTIF');
      setServeurs(actifs);
      setTables(Array.isArray(tablesRes.data) ? tablesRes.data : []);
    } catch (err) {
      showToast.error('Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  // ---- Mode Affectation ----

  const handleSelectServeur = async (serveurId: number) => {
    setSelectedServeurId(serveurId);
    try {
      const { data } = await serveurTablesApi.getAll();
      const serveurTables = Array.isArray(data)
        ? data.filter((a: any) => a.utilisateurId === serveurId)
        : [];
      setCheckedTableIds(new Set(serveurTables.map((a: any) => a.tableId)));
    } catch {
      setCheckedTableIds(new Set());
    }
  };

  const toggleTable = (tableId: number) => {
    setCheckedTableIds((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedServeurId) {
      showToast.error('Sélectionnez un serveur');
      return;
    }
    setSaving(true);
    try {
      await serveurTablesApi.assignBulk({
        utilisateurId: selectedServeurId,
        tableIds: Array.from(checkedTableIds),
      });
      const serveur = serveurs.find((s) => s.id === selectedServeurId);
      showToast.success(`${serveur?.nom || 'Serveur'} → ${checkedTableIds.size} table(s)`);
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Erreur lors de l\'affectation');
    } finally {
      setSaving(false);
    }
  };

  // ---- Mode Transfert ----

  const handleTransfer = () => {
    if (!fromServeurId || !toServeurId) {
      showToast.error('Sélectionnez le serveur source et le serveur cible');
      return;
    }
    if (fromServeurId === toServeurId) {
      showToast.error('Le serveur source et cible doivent être différents');
      return;
    }
    const from = serveurs.find((s) => s.id === fromServeurId);
    const to = serveurs.find((s) => s.id === toServeurId);
    Alert.alert(
      'Confirmer le transfert',
      `Transférer toutes les tables de ${from?.nom} vers ${to?.nom} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Transférer',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const { data } = await serveurTablesApi.reassign({
                fromServeurId,
                toServeurId,
              });
              showToast.success(`${data.reassigned} table(s) transférée(s) de ${from?.nom} à ${to?.nom}`);
              setFromServeurId(null);
              setToServeurId(null);
            } catch (err: any) {
              showToast.error(err.response?.data?.message || 'Erreur lors du transfert');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  // ---- Rendu commun ----

  const tablesByZone: Record<string, any[]> = {};
  for (const t of tables) {
    const z = t.zone || 'Sans zone';
    if (!tablesByZone[z]) tablesByZone[z] = [];
    tablesByZone[z].push(t);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const otherServeurs = (excludeId?: number | null) =>
    serveurs.filter((s) => s.id !== excludeId);

  return (
    <View style={styles.container}>
      {/* Mode Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, mode === 'affectation' && styles.tabActive]}
          onPress={() => setMode('affectation')}
        >
          <Text style={[styles.tabText, mode === 'affectation' && styles.tabTextActive]}>
            Affectation
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'transfert' && styles.tabActive]}
          onPress={() => setMode('transfert')}
        >
          <Text style={[styles.tabText, mode === 'transfert' && styles.tabTextActive]}>
            Transfert (maladie/absence)
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'affectation' ? (
        <>
          {/* Serveur Selector */}
          <View style={styles.serveurSection}>
            <Text style={styles.sectionTitle}>Choisir un serveur</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.serveurScroll}>
              {serveurs.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.serveurChip, selectedServeurId === s.id && styles.serveurChipActive]}
                  onPress={() => handleSelectServeur(s.id)}
                >
                  <View style={[styles.serveurAvatar, selectedServeurId === s.id && styles.serveurAvatarActive]}>
                    <Text style={[styles.serveurAvatarText, selectedServeurId === s.id && styles.serveurAvatarTextActive]}>
                      {s.nom.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.serveurName, selectedServeurId === s.id && styles.serveurNameActive]}>
                    {s.nom}
                  </Text>
                </TouchableOpacity>
              ))}
              {serveurs.length === 0 && (
                <Text style={styles.emptyText}>Aucun serveur actif</Text>
              )}
            </ScrollView>
          </View>

          {/* Tables Checklist */}
          <ScrollView style={styles.tablesSection} contentContainerStyle={styles.tablesContent}>
            {selectedServeurId ? (
              Object.keys(tablesByZone).map((zone) => (
                <View key={zone} style={styles.zoneGroup}>
                  <Text style={styles.zoneTitle}>{zone}</Text>
                  {tablesByZone[zone].map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.tableRow}
                      onPress={() => toggleTable(t.id)}
                    >
                      <View style={[styles.checkbox, checkedTableIds.has(t.id) && styles.checkboxChecked]}>
                        {checkedTableIds.has(t.id) && <Text style={styles.checkMark}>✓</Text>}
                      </View>
                      <Text style={styles.tableNum}>{t.numero}</Text>
                      <View style={[styles.statusDot, { backgroundColor: t.statut === 'LIBRE' ? Colors.success : t.statut === 'OCCUPEE' ? Colors.danger : Colors.warning }]} />
                      <Text style={styles.tableStatut}>{t.statut}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            ) : (
              <View style={styles.centered}>
                <Text style={styles.placeholderText}>Sélectionnez un serveur ci-dessus</Text>
              </View>
            )}
          </ScrollView>

          {selectedServeurId && (
            <View style={styles.footer}>
              <Text style={styles.footerInfo}>
                {checkedTableIds.size} table(s) sélectionnée(s)
              </Text>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.textWhite} />
                ) : (
                  <Text style={styles.saveBtnText}>Valider l'affectation</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <>
          {/* Mode Transfert */}
          <ScrollView style={styles.tablesSection} contentContainerStyle={styles.transferContent}>
            <View style={styles.transferCard}>
              <Text style={styles.transferTitle}>Serveur absent / malade</Text>
              <Text style={styles.transferLabel}>Sélectionnez le serveur à remplacer :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.serveurScroll}>
                {serveurs.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.serveurChip, fromServeurId === s.id && styles.serveurChipActiveDanger]}
                    onPress={() => setFromServeurId(s.id)}
                  >
                    <View style={[styles.serveurAvatar, fromServeurId === s.id && styles.serveurAvatarActiveDanger]}>
                      <Text style={[styles.serveurAvatarText, fromServeurId === s.id && styles.serveurAvatarTextActiveDanger]}>
                        {s.nom.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.serveurName, fromServeurId === s.id && styles.serveurNameActiveDanger]}>
                      {s.nom}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.transferArrow}>
              <Text style={styles.transferArrowText}>⬇</Text>
            </View>

            <View style={styles.transferCard}>
              <Text style={styles.transferTitle}>Serveur remplaçant</Text>
              <Text style={styles.transferLabel}>Sélectionnez le serveur qui récupère les tables :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.serveurScroll}>
                {otherServeurs(fromServeurId).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.serveurChip, toServeurId === s.id && styles.serveurChipActive]}
                    onPress={() => setToServeurId(s.id)}
                  >
                    <View style={[styles.serveurAvatar, toServeurId === s.id && styles.serveurAvatarActive]}>
                      <Text style={[styles.serveurAvatarText, toServeurId === s.id && styles.serveurAvatarTextActive]}>
                        {s.nom.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.serveurName, toServeurId === s.id && styles.serveurNameActive]}>
                      {s.nom}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {fromServeurId && toServeurId && (
              <View style={styles.transferSummary}>
                <Text style={styles.transferSummaryText}>
                  Toutes les tables de <Text style={{ fontWeight: '700' }}>{serveurs.find(s => s.id === fromServeurId)?.nom}</Text> seront
                  transférées à <Text style={{ fontWeight: '700' }}>{serveurs.find(s => s.id === toServeurId)?.nom}</Text>.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerInfo}>
              {fromServeurId && toServeurId ? 'Prêt à transférer' : 'Sélectionnez les 2 serveurs'}
            </Text>
            <TouchableOpacity
              style={[styles.transferBtn, saving && { opacity: 0.6 }]}
              onPress={handleTransfer}
              disabled={saving || !fromServeurId || !toServeurId}
            >
              {saving ? (
                <ActivityIndicator color={Colors.textWhite} />
              ) : (
                <Text style={styles.saveBtnText}>Transférer les tables</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Tabs
  tabRow: { flexDirection: 'row', backgroundColor: Colors.surface, padding: 4 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: 10, marginHorizontal: 2,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textLight },
  tabTextActive: { color: Colors.textWhite },

  // Serveur chips
  serveurSection: { backgroundColor: Colors.surface, paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  serveurScroll: { flexGrow: 0 },
  serveurChip: {
    alignItems: 'center', marginRight: 16, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 16, backgroundColor: Colors.inputBg, minWidth: 70,
  },
  serveurChipActive: { backgroundColor: Colors.primary + '15' },
  serveurChipActiveDanger: { backgroundColor: Colors.danger + '15' },
  serveurAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.inputBg,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
    borderWidth: 2, borderColor: Colors.border,
  },
  serveurAvatarActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '20' },
  serveurAvatarActiveDanger: { borderColor: Colors.danger, backgroundColor: Colors.danger + '20' },
  serveurAvatarText: { fontSize: 20, fontWeight: '700', color: Colors.textLight },
  serveurAvatarTextActive: { color: Colors.primary },
  serveurAvatarTextActiveDanger: { color: Colors.danger },
  serveurName: { fontSize: 13, fontWeight: '500', color: Colors.textLight },
  serveurNameActive: { color: Colors.primary, fontWeight: '700' },
  serveurNameActiveDanger: { color: Colors.danger, fontWeight: '700' },
  emptyText: { color: Colors.textLight, fontSize: 14, paddingVertical: 12 },

  // Tables
  tablesSection: { flex: 1 },
  tablesContent: { padding: 16, paddingBottom: 100 },
  zoneGroup: { marginBottom: 20 },
  zoneTitle: { fontSize: 15, fontWeight: '700', color: Colors.secondary, marginBottom: 8, textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkMark: { color: Colors.textWhite, fontSize: 14, fontWeight: '700' },
  tableNum: { fontSize: 16, fontWeight: '600', color: Colors.text, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  tableStatut: { fontSize: 12, color: Colors.textLight, minWidth: 60, flexShrink: 0 },
  placeholderText: { fontSize: 16, color: Colors.textLight, marginTop: 40 },

  // Footer
  footer: {
    backgroundColor: Colors.surface, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footerInfo: { fontSize: 13, color: Colors.textLight },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  saveBtnText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
  transferBtn: {
    backgroundColor: Colors.danger, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center',
  },

  // Transfert
  transferContent: { padding: 16, paddingBottom: 100 },
  transferCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  transferTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  transferLabel: { fontSize: 13, color: Colors.textLight, marginBottom: 12 },
  transferArrow: { alignItems: 'center', paddingVertical: 12 },
  transferArrowText: { fontSize: 28 },
  transferSummary: {
    backgroundColor: Colors.warning + '20', borderRadius: 12, padding: 14, marginTop: 16,
    borderLeftWidth: 4, borderLeftColor: Colors.warning,
  },
  transferSummaryText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
});
