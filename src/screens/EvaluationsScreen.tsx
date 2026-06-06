import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/colors';
import { evaluationsApi } from '../services/api';

export default function EvaluationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [moyennes, setMoyennes] = useState<any>(null);

  const load = async () => {
    try {
      const [eRes, mRes] = await Promise.all([evaluationsApi.getAll(), evaluationsApi.getMoyennes()]);
      setEvaluations(eRes.data || []);
      setMoyennes(mRes.data);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

  return (
    <View style={styles.container}>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View> : (
        <FlatList
          data={evaluations}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
          ListHeaderComponent={() => (
            <View>
              {moyennes && moyennes.nbAvis > 0 && (
                <View style={styles.headerCard}>
                  <Text style={styles.headerTitle}>⭐ Avis clients</Text>
                  <Text style={styles.headerCount}>{moyennes.nbAvis} avis</Text>
                  <View style={styles.moyennesRow}>
                    <View style={styles.moyenneItem}>
                      <Text style={styles.moyenneLabel}>Service</Text>
                      <Text style={styles.moyenneNote}>{moyennes.noteService}</Text>
                      <Text style={styles.moyenneStars}>{stars(moyennes.noteService)}</Text>
                    </View>
                    <View style={styles.moyenneItem}>
                      <Text style={styles.moyenneLabel}>Cuisine</Text>
                      <Text style={styles.moyenneNote}>{moyennes.noteCuisine}</Text>
                      <Text style={styles.moyenneStars}>{stars(moyennes.noteCuisine)}</Text>
                    </View>
                    <View style={styles.moyenneItem}>
                      <Text style={styles.moyenneLabel}>Ambiance</Text>
                      <Text style={styles.moyenneNote}>{moyennes.noteAmbiance}</Text>
                      <Text style={styles.moyenneStars}>{stars(moyennes.noteAmbiance)}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTel}>{item.telephone}</Text>
                <Text style={styles.cardDate}>{new Date(item.dateCreation).toLocaleDateString('fr-FR')}</Text>
              </View>
              <View style={styles.notes}>
                <Text style={styles.noteRow}>🍽 Service : {stars(item.noteService)}</Text>
                <Text style={styles.noteRow}>👨‍🍳 Cuisine : {stars(item.noteCuisine)}</Text>
                <Text style={styles.noteRow}>🏪 Ambiance : {stars(item.noteAmbiance)}</Text>
              </View>
              {item.commentaire ? <Text style={styles.comment}>💬 {item.commentaire}</Text> : null}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucun avis pour le moment</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, paddingBottom: 40 },
  headerCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  headerCount: { fontSize: 13, color: Colors.textLight, textAlign: 'center', marginBottom: 16 },
  moyennesRow: { flexDirection: 'row', justifyContent: 'space-around' },
  moyenneItem: { alignItems: 'center' },
  moyenneLabel: { fontSize: 12, color: Colors.textLight, marginBottom: 4 },
  moyenneNote: { fontSize: 28, fontWeight: '800', color: Colors.primary },
  moyenneStars: { fontSize: 14, color: '#FFB300', marginTop: 2 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardDate: { fontSize: 11, color: Colors.textLight },
  notes: { marginBottom: 6 },
  noteRow: { fontSize: 13, paddingVertical: 2, color: Colors.text },
  comment: { fontSize: 13, color: Colors.textLight, fontStyle: 'italic', marginTop: 4 },
  empty: { textAlign: 'center', color: Colors.textLight, fontSize: 14, padding: 40 },
});
