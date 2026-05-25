import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { formatPrixDevise, selectDevise } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import { paiementApi } from '../services/api';
import { showToast } from '../services/toast';
import ActionSheet from '../components/ActionSheet';

const MODE_LABELS: Record<string, string> = {
  ESPECES: 'Espèces', MOBILE_MONEY: 'Mobile Money', CARTE_BANCAIRE: 'Carte Bancaire',
};

export default function CashierScreen() {
  const devise = useSelector(selectDevise);
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [caisse, setCaisse] = useState<any>(null);
  const [selectedCommande, setSelectedCommande] = useState<any>(null);
  const [showActionModal, setShowActionModal] = useState(false);

  const loadData = async () => {
    try {
      const [cmdRes, caisseRes] = await Promise.all([
        paiementApi.getAPayer(),
        paiementApi.getCaisseJour(),
      ]);
      setCommandes(Array.isArray(cmdRes.data) ? cmdRes.data : []);
      setCaisse(caisseRes.data);
    } catch (err) {
      showToast.error('Erreur de chargement');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handlePayer = async (mode: string) => {
    if (!selectedCommande) return;
    try {
      const { data } = await paiementApi.payer(selectedCommande.id, mode);
      setShowActionModal(false);
      const factureId = data?.facture?.id;
      if (factureId) {
        Alert.alert('✅ Paiement effectué', `Facture ${data.facture.numero}\nMontant: ${Number(data.facture.montant).toFixed(2)} ${devise}`, [
          { text: 'Fermer', style: 'cancel' },
          { text: '🖨 Imprimer', onPress: () => Linking.openURL(paiementApi.imprimerFacture(factureId)) },
        ]);
      } else {
        showToast.success('Paiement effectué');
      }
      loadData();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Échec du paiement');
    }
  };

  const handleCloture = () => {
    Alert.alert('Clôturer la caisse', 'Confirmer la clôture de la caisse du jour ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Clôturer', onPress: async () => {
        try {
          const { data } = await paiementApi.cloturerCaisse();
          showToast.success(`Caisse clôturée: ${formatPrixDevise(data.totalGeneral, devise)}`);
          loadData();
        } catch (e) { showToast.error('Échec clôture'); }
      }},
    ]);
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Caisse résumé */}
      {caisse && (
        <View style={styles.caisseCard}>
          <Text style={styles.caisseTitle}>Caisse du jour</Text>
          <Text style={styles.caisseTotal}>{formatPrixDevise(caisse.totalGeneral, devise)}</Text>
          <View style={styles.caisseRow}>
            <Text style={styles.caisseDetail}>Espèces: {formatPrixDevise(caisse.details.totalEspeces, devise)}</Text>
            <Text style={styles.caisseDetail}>Mobile: {formatPrixDevise(caisse.details.totalMobileMoney, devise)}</Text>
            <Text style={styles.caisseDetail}>Carte: {formatPrixDevise(caisse.details.totalCarte, devise)}</Text>
          </View>
          <Text style={styles.caisseCount}>{caisse.nombreFactures} facture(s)</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Commandes à payer</Text>

      <FlatList
        data={commandes}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => { setSelectedCommande(item); setShowActionModal(true); }}
          >
            <View>
              <Text style={styles.tableLabel}>Table {item.table?.numero}</Text>
              <Text style={styles.detailCount}>{item.details?.length || 0} article(s)</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.total}>{formatPrixDevise(item.montantTotal, devise)}</Text>
              <Text style={styles.statutLabel}>{item.statut === 'SERVIE' ? 'Servie' : 'Prête'}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={styles.emptyText}>Aucune commande à payer</Text></View>
        }
      />

      <TouchableOpacity style={styles.clotureBtn} onPress={handleCloture}>
        <Text style={styles.clotureText}>🔒 Clôturer la caisse</Text>
      </TouchableOpacity>

      <ActionSheet
        visible={showActionModal}
        title={`Paiement Table ${selectedCommande?.table?.numero}`}
        subtitle={formatPrixDevise(selectedCommande?.montantTotal || 0, devise)}
        actions={[
          { icon: '💵', label: 'Espèces', onPress: () => handlePayer('ESPECES') },
          { icon: '📱', label: 'Mobile Money', onPress: () => handlePayer('MOBILE_MONEY') },
          { icon: '💳', label: 'Carte Bancaire', onPress: () => handlePayer('CARTE_BANCAIRE') },
        ]}
        onClose={() => setShowActionModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  caisseCard: { backgroundColor: Colors.primary, margin: 12, borderRadius: 16, padding: 20, alignItems: 'center' },
  caisseTitle: { color: Colors.textWhite, fontSize: 14, opacity: 0.8 },
  caisseTotal: { color: Colors.textWhite, fontSize: 36, fontWeight: '800', marginVertical: 4 },
  caisseRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  caisseDetail: { color: Colors.textWhite, fontSize: 12, opacity: 0.9 },
  caisseCount: { color: Colors.textWhite, fontSize: 12, opacity: 0.7, marginTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, paddingHorizontal: 16, marginTop: 4, marginBottom: 8 },
  list: { padding: 12 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  tableLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  detailCount: { fontSize: 13, color: Colors.textLight, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  total: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  statutLabel: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  clotureBtn: { backgroundColor: Colors.danger, margin: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  clotureText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
  empty: { alignItems: 'center', padding: 30 },
  emptyText: { color: Colors.textLight, fontSize: 14 },
});
