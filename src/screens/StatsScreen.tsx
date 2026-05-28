import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, TouchableOpacity, Modal,
} from 'react-native';
import { useSelector } from 'react-redux';
import { formatPrixDevise, selectDevise } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import { statistiquesApi } from '../services/api';
import { showToast } from '../services/toast';
import StatCard from '../components/StatCard';
import CalendarPicker, { toDateStr, formatDisplay } from '../components/CalendarPicker';

export default function StatsScreen() {
  const devise = useSelector(selectDevise);
  const [dashboard, setDashboard] = useState<any>(null);
  const [platsPop, setPlatsPop] = useState<any[]>([]);
  const [serveurs, setServeurs] = useState<any[]>([]);
  const [affluence, setAffluence] = useState<any[]>([]);
  const [caissiers, setCaissiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtres de date — par défaut aujourd'hui
  const today = toDateStr(new Date());
  const [dateDebut, setDateDebut] = useState(today);
  const [dateFin, setDateFin] = useState(today);
  const [showDebutPicker, setShowDebutPicker] = useState(false);
  const [showFinPicker, setShowFinPicker] = useState(false);

  // Modale de détail
  const [showDetail, setShowDetail] = useState(false);
  const [detailType, setDetailType] = useState('');
  const [ventesDetail, setVentesDetail] = useState<any>(null);

  const openDetail = async (type: string) => {
    setDetailType(type);
    setShowDetail(true);
    if (type === 'ventes') {
      try {
        const { data } = await statistiquesApi.getVentes(dateDebut, dateFin);
        setVentesDetail(data);
      } catch (e) { setVentesDetail(null); }
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [dashRes, platsRes, servRes, affRes, caissRes] = await Promise.all([
        statistiquesApi.getDashboard(dateDebut, dateFin),
        statistiquesApi.getPlatsPopulaires(10, dateDebut, dateFin),
        statistiquesApi.getPerformanceServeurs(dateDebut, dateFin),
        statistiquesApi.getAffluence(dateDebut, dateFin),
        statistiquesApi.getPerformanceCaissiers(dateDebut, dateFin),
      ]);
      setDashboard(dashRes.data);
      setPlatsPop(Array.isArray(platsRes.data) ? platsRes.data : []);
      setServeurs(Array.isArray(servRes.data) ? servRes.data : []);
      setAffluence(Array.isArray(affRes.data) ? affRes.data : []);
      setCaissiers(Array.isArray(caissRes.data) ? caissRes.data : []);
    } catch (err) {
      showToast.error('Erreur de chargement');
    } finally { setLoading(false); }
  }, [dateDebut, dateFin]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const maxAffluence = Math.max(...affluence.map((x: any) => x.commandes), 1);
  const dateLabel = dateDebut === dateFin
    ? formatDisplay(dateDebut)
    : `${formatDisplay(dateDebut)} → ${formatDisplay(dateFin)}`;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}>
      {/* Filtre de date */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDebutPicker(true)}>
          <Text style={styles.dateBtnLabel}>Du</Text>
          <Text style={styles.dateBtnValue}>{formatDisplay(dateDebut)}</Text>
        </TouchableOpacity>
        <Text style={styles.dateSep}>→</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFinPicker(true)}>
          <Text style={styles.dateBtnLabel}>Au</Text>
          <Text style={styles.dateBtnValue}>{formatDisplay(dateFin)}</Text>
        </TouchableOpacity>
      </View>

      {/* Carte resume principal */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Chiffre d'affaires</Text>
        <Text style={styles.heroValue}>{formatPrixDevise(dashboard?.chiffreAffairesJour || 0, devise, 0)}</Text>
        <Text style={styles.heroDate}>{dateLabel}</Text>
      </View>

      {/* Stats en grille 2x2 — cliquables */}
      <View style={styles.statsGrid}>
        <TouchableOpacity style={styles.statsGridItem} onPress={() => openDetail('commandes')} activeOpacity={0.7}>
          <StatCard title="Commandes" value={dashboard?.commandesJour || 0} icon="📋" color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.statsGridItem} onPress={() => openDetail('tables')} activeOpacity={0.7}>
          <StatCard title="Tables" value={dashboard?.totalTables || 0} icon="🪑" color={Colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.statsGridItem} onPress={() => openDetail('serveurs')} activeOpacity={0.7}>
          <StatCard title="Serveurs" value={dashboard?.serveursActifs || 0} icon="👤" color={Colors.warning} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.statsGridItem} onPress={() => openDetail('ventes')} activeOpacity={0.7}>
          <StatCard title="Prix moyen" value={`${(dashboard?.panierMoyen || 0).toFixed(0)} ${devise}`} icon="🏷" color={Colors.info} />
        </TouchableOpacity>
      </View>

      {/* Section: Top Plats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏆 Top Plats</Text>
        {platsPop.length === 0 ? (
          <Text style={styles.emptyText}>Aucune donnée</Text>
        ) : platsPop.slice(0, 5).map((p, i) => (
          <View key={i} style={styles.rankRow}>
            <View style={[styles.rankBadge, i === 0 && styles.rankBadgeGold, i === 1 && styles.rankBadgeSilver, i === 2 && styles.rankBadgeBronze]}>
              <Text style={styles.rankBadgeText}>#{i + 1}</Text>
            </View>
            <Text style={styles.rankName}>{p.nom}</Text>
            <Text style={styles.rankQty}>x{p.quantite}</Text>
            <Text style={styles.rankMontant}>{formatPrixDevise(p.montant, devise, 0)}</Text>
          </View>
        ))}
      </View>

      {/* Section: Performance Serveurs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👨‍🍳 Performance Serveurs</Text>
        {serveurs.length === 0 ? (
          <Text style={styles.emptyText}>Aucune donnée</Text>
        ) : serveurs.slice(0, 5).map((s, i) => {
          const max = Math.max(...serveurs.map((x: any) => x.chiffreAffaires || 0), 1);
          const pct = Math.round((s.chiffreAffaires / max) * 100);
          return (
            <View key={i} style={styles.serveurRow}>
              <View style={styles.serveurInfo}>
                <Text style={styles.serveurRank}>#{i + 1}</Text>
                <Text style={styles.serveurName}>{s.nom}</Text>
              </View>
              <View style={styles.serveurBarTrack}>
                <View style={[styles.serveurBarFill, { width: `${pct}%` }]} />
              </View>
              <View style={styles.serveurStats}>
                <Text style={styles.serveurCmd}>{s.commandes} cmd</Text>
                <Text style={styles.serveurCA}>{formatPrixDevise(s.chiffreAffaires, devise, 0)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Section: Performance Caissiers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💰 Performance Caissiers</Text>
        {caissiers.length === 0 ? (
          <Text style={styles.emptyText}>Aucune donnée</Text>
        ) : caissiers.map((c, i) => {
          const max = Math.max(...caissiers.map((x: any) => x.chiffreAffaires || 0), 1);
          const pct = Math.round((c.chiffreAffaires / max) * 100);
          return (
            <View key={i} style={styles.serveurRow}>
              <View style={styles.serveurInfo}>
                <Text style={styles.serveurRank}>#{i + 1}</Text>
                <Text style={styles.serveurName}>{c.nom}</Text>
              </View>
              <View style={styles.serveurBarTrack}>
                <View style={[styles.serveurBarFill, { width: `${pct}%` }]} />
              </View>
              <View style={styles.serveurStats}>
                <Text style={styles.serveurCmd}>{c.factures} factures</Text>
                <Text style={styles.serveurCA}>{formatPrixDevise(c.chiffreAffaires, devise, 0)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Section: Affluence */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 Heures d'Affluence</Text>
        <View style={styles.affluenceCard}>
          <View style={styles.affluenceRow}>
            {affluence.map((a, i) => {
              const h = (a.commandes / maxAffluence) * 100;
              return (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barValueBox}>
                    <Text style={styles.barValue}>{a.commandes}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: `${Math.max(h, 4)}%` }]} />
                  </View>
                  <Text style={styles.barLabel}>{a.heure}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={{ height: 50 }} />

      {/* Modale de détail */}
      <Modal visible={showDetail} transparent animationType="slide">
        <View style={styles.detailOverlay}>
          <View style={styles.detailContent}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>
                {detailType === 'commandes' ? '📋 Détail des commandes' :
                 detailType === 'tables' ? '🪑 Tables' :
                 detailType === 'serveurs' ? '👤 Serveurs actifs' :
                 detailType === 'ventes' ? '💰 Détail des ventes' : ''}
              </Text>
              <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.detailCloseBtn}>
                <Text style={styles.detailCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {/* Commandes */}
              {detailType === 'commandes' && (
                <View style={{ padding: 16 }}>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Total commandes</Text><Text style={styles.detailValue}>{dashboard?.commandesJour || 0}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Chiffre d'affaires</Text><Text style={styles.detailValue}>{formatPrixDevise(dashboard?.chiffreAffairesJour || 0, devise)}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Panier moyen</Text><Text style={styles.detailValue}>{(dashboard?.panierMoyen || 0).toFixed(0)} {devise}</Text></View>
                </View>
              )}

              {/* Tables */}
              {detailType === 'tables' && (
                <View style={{ padding: 16 }}>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Total tables</Text><Text style={styles.detailValue}>{dashboard?.totalTables || 0}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Serveurs actifs</Text><Text style={styles.detailValue}>{dashboard?.serveursActifs || 0}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Commandes aujourd'hui</Text><Text style={styles.detailValue}>{dashboard?.commandesJour || 0}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Moyenne par table</Text><Text style={styles.detailValue}>{dashboard?.totalTables > 0 ? (dashboard.commandesJour / dashboard.totalTables).toFixed(1) : '0'} cmd/table</Text></View>
                </View>
              )}

              {/* Serveurs */}
              {detailType === 'serveurs' && (
                <View style={{ padding: 16 }}>
                  {serveurs.length === 0 ? (
                    <Text style={{ color: Colors.textLight, textAlign: 'center', padding: 20 }}>Aucun serveur avec planning sur cette période</Text>
                  ) : serveurs.map((s, i) => (
                    <View key={i} style={[styles.detailRow, { paddingVertical: 10 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', color: Colors.text }}>#{i + 1} {s.nom}</Text>
                        <Text style={{ fontSize: 11, color: Colors.textLight }}>{s.commandes} commandes</Text>
                      </View>
                      <Text style={{ fontWeight: '700', color: Colors.success, fontSize: 15 }}>{formatPrixDevise(s.chiffreAffaires, devise)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Ventes */}
              {detailType === 'ventes' && (
                <View style={{ padding: 16 }}>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Nombre de ventes</Text><Text style={styles.detailValue}>{ventesDetail?.nombreCommandes || 0}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Chiffre d'affaires</Text><Text style={styles.detailValue}>{formatPrixDevise(ventesDetail?.chiffreAffaires || 0, devise)}</Text></View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Prix moyen</Text>
                    <Text style={styles.detailValue}>
                      {ventesDetail?.nombreCommandes > 0
                        ? formatPrixDevise(ventesDetail.chiffreAffaires / ventesDetail.nombreCommandes, devise)
                        : '0 ' + devise}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.detailCloseFull} onPress={() => setShowDetail(false)}>
              <Text style={{ color: Colors.textLight, fontWeight: '600', fontSize: 14 }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Calendar Pickers */}
      <CalendarPicker visible={showDebutPicker} value={dateDebut} onSelect={(d) => { setDateDebut(d); setShowDebutPicker(false); }} onClose={() => setShowDebutPicker(false)} />
      <CalendarPicker visible={showFinPicker} value={dateFin} onSelect={(d) => { setDateFin(d); setShowFinPicker(false); }} onClose={() => setShowFinPicker(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Filtre date
  filterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 12, marginTop: 10, gap: 8,
  },
  dateBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  dateBtnLabel: { fontSize: 11, color: Colors.textLight, fontWeight: '600' },
  dateBtnValue: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginTop: 2, textTransform: 'capitalize' },
  dateSep: { fontSize: 16, color: Colors.textLight },

  // Hero
  heroCard: {
    backgroundColor: Colors.primary,
    margin: 12, borderRadius: 20, padding: 24, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  heroLabel: { color: Colors.textWhite, fontSize: 13, opacity: 0.8, fontWeight: '600' },
  heroValue: { color: Colors.textWhite, fontSize: 36, fontWeight: '800', marginTop: 4 },
  heroDate: { color: Colors.textWhite, fontSize: 12, opacity: 0.6, marginTop: 6, textTransform: 'capitalize' },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  statsGridItem: { width: '46%', margin: '2%' },

  // Sections
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },
  emptyText: { textAlign: 'center', color: Colors.textLight, fontSize: 13, padding: 20 },

  // Rank row (Top plats)
  rankRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.surface, marginHorizontal: 12, marginBottom: 6,
    borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  rankBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  rankBadgeGold: { backgroundColor: '#FFD700' },
  rankBadgeSilver: { backgroundColor: '#C0C0C0' },
  rankBadgeBronze: { backgroundColor: '#CD7F32' },
  rankBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.text },
  rankName: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '600' },
  rankQty: { fontSize: 14, fontWeight: '600', color: Colors.textLight, marginRight: 12 },
  rankMontant: { fontSize: 14, fontWeight: '700', color: Colors.success },

  // Serveur row
  serveurRow: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.surface, marginHorizontal: 12, marginBottom: 6,
    borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  serveurInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  serveurRank: { fontSize: 13, fontWeight: '800', color: Colors.primary, marginRight: 8, width: 24 },
  serveurName: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1 },
  serveurBarTrack: {
    height: 6, backgroundColor: Colors.inputBg, borderRadius: 3, marginBottom: 4,
    overflow: 'hidden',
  },
  serveurBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  serveurStats: { flexDirection: 'row', justifyContent: 'space-between' },
  serveurCmd: { fontSize: 12, color: Colors.textLight },
  serveurCA: { fontSize: 13, fontWeight: '700', color: Colors.success },

  // Affluence
  affluenceCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 12, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  affluenceRow: { flexDirection: 'row', alignItems: 'flex-end', height: 180, gap: 3 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  barValueBox: { marginBottom: 4 },
  barValue: { fontSize: 10, fontWeight: '700', color: Colors.text },
  barTrack: { width: '100%', flex: 1, backgroundColor: Colors.inputBg, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: Colors.primary, borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 10, color: Colors.textLight, marginTop: 6 },

  // Detail modal
  detailOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  detailContent: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 20,
  },
  detailHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  detailTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  detailCloseBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.inputBg,
    justifyContent: 'center', alignItems: 'center',
  },
  detailCloseText: { fontSize: 16, color: Colors.textLight, fontWeight: '600' },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.inputBg,
  },
  detailLabel: { fontSize: 14, color: Colors.textLight },
  detailValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  detailCloseFull: {
    backgroundColor: Colors.inputBg, marginHorizontal: 16, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
});
