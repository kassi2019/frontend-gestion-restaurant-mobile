import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { authApi } from '../services/api';

export default function DashboardAdminScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigation = useNavigation<any>();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await authApi.getDashboard();
      setData(data);
    } catch { /* */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

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
          <View style={styles.statsGrid}>
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
          </View>

          {/* Codes */}
          <View style={styles.card}>
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
          </View>

          {/* Liste restaurants */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🏪 Restaurants</Text>
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
  emptyText: { textAlign: 'center', color: Colors.textLight, marginTop: 40 },
});
