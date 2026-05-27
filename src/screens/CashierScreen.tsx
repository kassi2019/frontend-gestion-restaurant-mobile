import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Linking, Modal, ScrollView,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { formatPrixDevise, selectDevise } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import { paiementApi } from '../services/api';
import { showToast } from '../services/toast';
import ActionSheet from '../components/ActionSheet';

const MODE_LABELS: Record<string, string> = {
  ESPECES: 'Especes', MOBILE_MONEY: 'Mobile Money', CARTE_BANCAIRE: 'Carte Bancaire',
};

export default function CashierScreen() {
  const devise = useSelector(selectDevise);
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [caisse, setCaisse] = useState<any>(null);
  const [selectedCommande, setSelectedCommande] = useState<any>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());
  const [receiptData, setReceiptData] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

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
      const facture = data?.facture;
      if (facture) {
        // Afficher l'apercu du recu
        setReceiptData({
          ...facture,
          modePaiement: mode,
          commande: selectedCommande,
          details: selectedCommande.details || [],
        });
        setShowReceiptModal(true);
      } else {
        showToast.success('Paiement effectue');
      }
      loadData();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Echec du paiement');
    }
  };

  const handlePrintReceipt = () => {
    if (receiptData?.id) {
      Linking.openURL(paiementApi.imprimerFacture(receiptData.id));
    }
  };

  const handleCloture = () => {
    Alert.alert('Cloturer la caisse', 'Confirmer la cloture de la caisse du jour ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Cloturer', onPress: async () => {
        try {
          const { data } = await paiementApi.cloturerCaisse();
          showToast.success(`Caisse cloturee: ${formatPrixDevise(data.totalGeneral, devise)}`);
          loadData();
        } catch (e) { showToast.error('Echec cloture'); }
      }},
    ]);
  };

  const toggleTable = (tableId: number) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  // Grouper les commandes par table
  const commandesParTable = useMemo(() => {
    const grouped: Record<number, { tableId: number; tableNumero: string; commandes: any[]; total: number }> = {};
    for (const cmd of commandes) {
      const tId = cmd.tableId || cmd.table?.id;
      if (!tId) continue;
      const numero = cmd.table?.numero || `Table ${tId}`;
      if (!grouped[tId]) {
        grouped[tId] = { tableId: tId, tableNumero: numero, commandes: [], total: 0 };
      }
      grouped[tId].commandes.push(cmd);
      grouped[tId].total += Number(cmd.montantTotal);
    }
    return Object.values(grouped);
  }, [commandes]);

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Caisse resume */}
      {caisse && (
        <View style={styles.caisseCard}>
          <Text style={styles.caisseTitle}>Caisse du jour</Text>
          <Text style={styles.caisseTotal}>{formatPrixDevise(caisse.totalGeneral, devise)}</Text>
          <View style={styles.caisseRow}>
            <Text style={styles.caisseDetail}>Especes: {formatPrixDevise(caisse.details.totalEspeces, devise)}</Text>
            <Text style={styles.caisseDetail}>Mobile: {formatPrixDevise(caisse.details.totalMobileMoney, devise)}</Text>
            <Text style={styles.caisseDetail}>Carte: {formatPrixDevise(caisse.details.totalCarte, devise)}</Text>
          </View>
          <Text style={styles.caisseCount}>{caisse.nombreFactures} facture(s)</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Commandes a payer ({commandesParTable.length} tables)</Text>

      <FlatList
        data={commandesParTable}
        keyExtractor={(item) => String(item.tableId)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        renderItem={({ item }) => {
          const isExpanded = expandedTables.has(item.tableId);
          return (
            <View style={styles.tableGroup}>
              <TouchableOpacity
                style={styles.tableHeader}
                onPress={() => toggleTable(item.tableId)}
                activeOpacity={0.7}
              >
                <View style={styles.tableHeaderLeft}>
                  <Text style={styles.tableIcon}>🪑</Text>
                  <View>
                    <Text style={styles.tableLabel}>Table {item.tableNumero}</Text>
                    <Text style={styles.tableCount}>
                      {item.commandes.length} commande{item.commandes.length > 1 ? 's' : ''} · {item.total.toFixed(2)} {devise}
                    </Text>
                  </View>
                </View>
                <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.tableDetails}>
                  {item.commandes.map((cmd: any) => (
                    <TouchableOpacity
                      key={cmd.id}
                      style={styles.commandeItem}
                      onPress={() => { setSelectedCommande(cmd); setShowActionModal(true); }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.commandeLeft}>
                        <Text style={styles.commandeRef}>Commande #{cmd.id}</Text>
                        <Text style={styles.commandeArticles}>{cmd.details?.length || 0} article(s)</Text>
                        <Text style={styles.commandeStatut}>
                          {cmd.statut === 'SERVIE' ? 'Servie' : 'Prete'}
                        </Text>
                      </View>
                      <View style={styles.commandeRight}>
                        <Text style={styles.commandeTotal}>{formatPrixDevise(cmd.montantTotal, devise)}</Text>
                        <Text style={styles.payerLabel}>Payer →</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={styles.emptyText}>Aucune commande a payer</Text></View>
        }
      />

      <TouchableOpacity style={styles.clotureBtn} onPress={handleCloture}>
        <Text style={styles.clotureText}>Cloturer la caisse</Text>
      </TouchableOpacity>

      <ActionSheet
        visible={showActionModal}
        title={`Paiement Table ${selectedCommande?.table?.numero}`}
        subtitle={formatPrixDevise(selectedCommande?.montantTotal || 0, devise)}
        actions={[
          { icon: '💵', label: 'Especes', onPress: () => handlePayer('ESPECES') },
          { icon: '📱', label: 'Mobile Money', onPress: () => handlePayer('MOBILE_MONEY') },
          { icon: '💳', label: 'Carte Bancaire', onPress: () => handlePayer('CARTE_BANCAIRE') },
        ]}
        onClose={() => setShowActionModal(false)}
      />

      {/* Recu preview modal */}
      <Modal visible={showReceiptModal} transparent animationType="slide">
        <View style={styles.receiptOverlay}>
          <View style={styles.receiptContent}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptTitle}>Recu de paiement</Text>
              <TouchableOpacity onPress={() => setShowReceiptModal(false)} style={styles.receiptClose}>
                <Text style={styles.receiptCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {receiptData && (
              <ScrollView style={styles.receiptBody}>
                {/* En-tete */}
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Facture</Text>
                  <Text style={styles.receiptValue}>{receiptData.numero}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Table</Text>
                  <Text style={styles.receiptValue}>Table {receiptData.commande?.table?.numero || '?'}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Mode</Text>
                  <Text style={styles.receiptValue}>{MODE_LABELS[receiptData.modePaiement] || receiptData.modePaiement}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Date</Text>
                  <Text style={styles.receiptValue}>
                    {new Date(receiptData.datePaiement).toLocaleString('fr-FR')}
                  </Text>
                </View>

                {/* Articles */}
                <Text style={styles.receiptSection}>Articles</Text>
                {receiptData.details?.map((d: any, i: number) => (
                  <View key={i} style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailQte}>{d.quantite}x</Text>
                    <Text style={styles.receiptDetailNom}>{d.menu?.nom || 'Article'}</Text>
                    <Text style={styles.receiptDetailPrix}>
                      {formatPrixDevise(Number(d.prix) * (d.quantite || 1), devise)}
                    </Text>
                  </View>
                ))}

                {/* Total */}
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Total</Text>
                  <Text style={styles.receiptTotalValue}>{formatPrixDevise(receiptData.montant, devise)}</Text>
                </View>

                {/* Btn imprimer */}
                <TouchableOpacity style={styles.printBtn} onPress={handlePrintReceipt}>
                  <Text style={styles.printBtnText}>🖨 Imprimer le recu</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeReceiptBtn}
                  onPress={() => setShowReceiptModal(false)}
                >
                  <Text style={styles.closeReceiptText}>Fermer</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  list: { padding: 12, paddingBottom: 80 },
  // Table group
  tableGroup: {
    backgroundColor: Colors.surface, borderRadius: 14, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    borderWidth: 1, borderColor: Colors.border,
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
  },
  tableHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  tableIcon: { fontSize: 22, marginRight: 12 },
  tableLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  tableCount: { fontSize: 13, color: Colors.textLight, marginTop: 2 },
  expandArrow: { fontSize: 12, color: Colors.textLight },
  tableDetails: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.inputBg, paddingHorizontal: 10, paddingBottom: 10,
  },
  commandeItem: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginTop: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  commandeLeft: { flex: 1 },
  commandeRef: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  commandeArticles: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  commandeStatut: { fontSize: 11, color: Colors.accent, fontWeight: '600', marginTop: 2 },
  commandeRight: { alignItems: 'flex-end' },
  commandeTotal: { fontSize: 17, fontWeight: '800', color: Colors.text },
  payerLabel: { fontSize: 11, color: Colors.primary, fontWeight: '700', marginTop: 2 },
  clotureBtn: { backgroundColor: Colors.danger, margin: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  clotureText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
  empty: { alignItems: 'center', padding: 30 },
  emptyText: { color: Colors.textLight, fontSize: 14 },

  // Receipt modal
  receiptOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', paddingHorizontal: 20 },
  receiptContent: {
    backgroundColor: Colors.surface, borderRadius: 20, maxHeight: '80%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  receiptHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  receiptTitle: { fontSize: 18, fontWeight: '700', color: Colors.success },
  receiptClose: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.inputBg,
    justifyContent: 'center', alignItems: 'center',
  },
  receiptCloseText: { fontSize: 16, color: Colors.textLight, fontWeight: '600' },
  receiptBody: { padding: 16 },
  receiptRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  receiptLabel: { fontSize: 13, color: Colors.textLight },
  receiptValue: { fontSize: 13, fontWeight: '600', color: Colors.text },
  receiptSection: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 16, marginBottom: 8 },
  receiptDetailRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.inputBg,
  },
  receiptDetailQte: { fontSize: 13, fontWeight: '700', color: Colors.primary, width: 30 },
  receiptDetailNom: { flex: 1, fontSize: 13, color: Colors.text },
  receiptDetailPrix: { fontSize: 13, fontWeight: '600', color: Colors.text },
  receiptTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 12, marginTop: 12, borderTopWidth: 2, borderTopColor: Colors.border,
  },
  receiptTotalLabel: { fontSize: 16, fontWeight: '800', color: Colors.text },
  receiptTotalValue: { fontSize: 18, fontWeight: '800', color: Colors.success },
  printBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  printBtnText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
  closeReceiptBtn: { backgroundColor: Colors.inputBg, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  closeReceiptText: { color: Colors.textLight, fontWeight: '600', fontSize: 14 },
});
