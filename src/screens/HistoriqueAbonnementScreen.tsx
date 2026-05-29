import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { authApi } from '../services/api';

export default function HistoriqueAbonnementScreen() {
  const route = useRoute<any>();
  const { restaurantId, restaurantNom } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (restaurantId) {
      setLoading(true);
      authApi.getHistorique(restaurantId)
        .then(({ data }) => setData(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [restaurantId]);

  const format = (d: string) => {
    try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
  };

  const formatDateTime = (d: string) => {
    try { return new Date(d).toLocaleString('fr-FR'); } catch { return d; }
  };

  return (
    <ScrollView style={styles.container}>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : data ? (
        <>
          {/* Infos actuelles */}
          <View style={styles.card}>
            <Text style={styles.restoName}>{data.restaurant.nom}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Abonnement actuel :</Text>
              <Text style={styles.value}>
                {data.restaurant.typeAbonnement === 'TRIAL' ? '🆓 Période d\'essai' :
                 data.restaurant.typeAbonnement === 'MENSUEL' ? '📅 Mensuel' :
                 data.restaurant.typeAbonnement === 'ANNUEL' ? '📆 Annuel' :
                 data.restaurant.typeAbonnement}
              </Text>
            </View>
            {data.restaurant.dateFinAbonnement && (
              <View style={styles.row}>
                <Text style={styles.label}>Expire le :</Text>
                <Text style={styles.value}>{formatDateTime(data.restaurant.dateFinAbonnement)}</Text>
              </View>
            )}
          </View>

          {/* Historique */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📜 Historique</Text>
            {data.historique.length === 0 ? (
              <Text style={styles.empty}>Aucun historique</Text>
            ) : (
              data.historique.map((h: any, i: number) => (
                <View key={h.id} style={styles.histItem}>
                  <View style={styles.histDot} />
                  {i < data.historique.length - 1 && <View style={styles.histLine} />}
                  <View style={styles.histContent}>
                    <Text style={styles.histDate}>{format(h.dateCreation)}</Text>
                    <Text style={styles.histType}>
                      {h.typeAbonnement === 'TRIAL' ? '🆓 Trial' :
                       h.typeAbonnement === 'MENSUEL' ? '📅 Mensuel' :
                       h.typeAbonnement === 'ANNUEL' ? '📆 Annuel' : h.typeAbonnement}
                      {' · '}{h.dureeJours} jours
                    </Text>
                    <Text style={styles.histDetail}>
                      Du {formatDateTime(h.dateDebut)} au {formatDateTime(h.dateFin)}
                    </Text>
                    {h.codeUtilise && (
                      <Text style={styles.histCode}>Code : {h.codeUtilise}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      ) : (
        <Text style={styles.empty}>Aucune donnée</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16,
  },
  restoName: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14, color: Colors.textLight },
  value: { fontSize: 14, fontWeight: '600', color: Colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  empty: { textAlign: 'center', color: Colors.textLight, marginTop: 40, fontSize: 14 },
  // Timeline
  histItem: { flexDirection: 'row', marginBottom: 4 },
  histDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary,
    marginTop: 4, marginRight: 12,
  },
  histLine: {
    position: 'absolute', left: 5, top: 16, bottom: 0,
    width: 2, backgroundColor: Colors.border,
  },
  histContent: { flex: 1, paddingBottom: 16 },
  histDate: { fontSize: 12, color: Colors.textLight, marginBottom: 2 },
  histType: { fontSize: 14, fontWeight: '700', color: Colors.text },
  histDetail: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  histCode: { fontSize: 12, color: Colors.primary, fontFamily: 'monospace', marginTop: 2 },
});
