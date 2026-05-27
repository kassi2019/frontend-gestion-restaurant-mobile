import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { formatPrixDevise, selectDevise } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import { statistiquesApi } from '../services/api';
import { showToast } from '../services/toast';
import StatCard from '../components/StatCard';

export default function StatsScreen() {
  const devise = useSelector(selectDevise);
  const [dashboard, setDashboard] = useState<any>(null);
  const [platsPop, setPlatsPop] = useState<any[]>([]);
  const [serveurs, setServeurs] = useState<any[]>([]);
  const [affluence, setAffluence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [dashRes, platsRes, servRes, affRes] = await Promise.all([
        statistiquesApi.getDashboard(),
        statistiquesApi.getPlatsPopulaires(10),
        statistiquesApi.getPerformanceServeurs(),
        statistiquesApi.getAffluence(),
      ]);
      setDashboard(dashRes.data);
      setPlatsPop(platsRes.data);
      setServeurs(servRes.data);
      setAffluence(affRes.data);
    } catch (err) {
      showToast.error('Erreur de chargement');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const maxAffluence = Math.max(...affluence.map((x: any) => x.commandes), 1);

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}>
      {/* Carte resume principal */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Chiffre d'affaires du jour</Text>
        <Text style={styles.heroValue}>{formatPrixDevise(dashboard?.chiffreAffairesJour || 0, devise, 0)}</Text>
      </View>

      {/* Stats en grille 2x2 */}
      <View style={styles.statsGrid}>
        <View style={styles.statsGridItem}>
          <StatCard title="Commandes" value={dashboard?.commandesJour || 0} icon="📋" color={Colors.primary} />
        </View>
        <View style={styles.statsGridItem}>
          <StatCard title="Tables" value={dashboard?.totalTables || 0} icon="🪑" color={Colors.accent} />
        </View>
        <View style={styles.statsGridItem}>
          <StatCard title="Serveurs" value={dashboard?.serveursActifs || 0} icon="👤" color={Colors.warning} />
        </View>
        <View style={styles.statsGridItem}>
          <StatCard title="Prix moyen" value={`${(dashboard?.panierMoyen || 0).toFixed(0)} ${devise}`} icon="🏷" color={Colors.info} />
        </View>
      </View>

      {/* Section: Top Plats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏆 Top 5 Plats</Text>
        {platsPop.slice(0, 5).map((p, i) => (
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
        {serveurs.slice(0, 5).map((s, i) => {
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero
  heroCard: {
    backgroundColor: Colors.primary,
    margin: 12, borderRadius: 20, padding: 24, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  heroLabel: { color: Colors.textWhite, fontSize: 13, opacity: 0.8, fontWeight: '600' },
  heroValue: { color: Colors.textWhite, fontSize: 36, fontWeight: '800', marginTop: 4 },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  statsGridItem: { width: '46%', margin: '2%' },

  // Sections
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },

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
});
