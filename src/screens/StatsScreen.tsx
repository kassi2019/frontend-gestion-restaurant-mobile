import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, ScrollView, RefreshControl,
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

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}>
      {/* Stats header */}
      <View style={styles.statsRow}>
        <StatCard title="CA Jour" value={formatPrixDevise(dashboard?.chiffreAffairesJour || 0, devise, 0)} icon="💰" color={Colors.success} />
        <StatCard title="Commandes" value={dashboard?.commandesJour || 0} icon="📋" color={Colors.primary} />
      </View>
      <View style={styles.statsRow}>
        <StatCard title="Tables" value={dashboard?.totalTables || 0} icon="🪑" color={Colors.accent} />
        <StatCard title="Serveurs" value={dashboard?.serveursActifs || 0} icon="👤" color={Colors.warning} />
      </View>

      {/* Top plats */}
      <Text style={styles.sectionTitle}>Top 5 Plats</Text>
      {platsPop.slice(0, 5).map((p, i) => (
        <View key={i} style={styles.rankRow}>
          <Text style={styles.rankNum}>#{i + 1}</Text>
          <Text style={styles.rankName}>{p.nom}</Text>
          <Text style={styles.rankQty}>x{p.quantite}</Text>
          <Text style={styles.rankMontant}>{formatPrixDevise(p.montant, devise, 0)}</Text>
        </View>
      ))}

      {/* Performance serveurs */}
      <Text style={styles.sectionTitle}>Performance Serveurs</Text>
      {serveurs.map((s, i) => (
        <View key={i} style={styles.rankRow}>
          <Text style={styles.rankNum}>#{i + 1}</Text>
          <Text style={styles.rankName}>{s.nom}</Text>
          <Text style={styles.rankQty}>{s.commandes} cmd</Text>
          <Text style={styles.rankMontant}>{formatPrixDevise(s.chiffreAffaires, devise, 0)}</Text>
        </View>
      ))}

      {/* Affluence */}
      <Text style={styles.sectionTitle}>Heures d'Affluence</Text>
      <View style={styles.affluenceRow}>
        {affluence.map((a, i) => {
          const max = Math.max(...affluence.map((x: any) => x.commandes), 1);
          const h = Math.min((a.commandes / max) * 100, 100);
          return (
            <View key={i} style={styles.barCol}>
              <Text style={styles.barValue}>{a.commandes}</Text>
              <View style={[styles.barFill, { height: h }]} />
              <Text style={styles.barLabel}>{a.heure}</Text>
            </View>
          );
        })}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 8, marginTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, paddingHorizontal: 16, marginTop: 20, marginBottom: 10 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rankNum: { width: 30, fontWeight: '700', color: Colors.primary, fontSize: 14 },
  rankName: { flex: 1, fontSize: 14, color: Colors.text },
  rankQty: { fontSize: 14, fontWeight: '600', color: Colors.textLight, marginRight: 16 },
  rankMontant: { fontSize: 14, fontWeight: '700', color: Colors.success },
  affluenceRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, height: 140, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { fontSize: 10, color: Colors.textLight, marginBottom: 2 },
  barFill: { width: '80%', backgroundColor: Colors.primary, borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 10, color: Colors.textLight, marginTop: 4 },
});
