import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Colors } from '../theme/colors';
import { notificationsApi } from '../services/api';
import { showToast } from '../services/toast';

export default function NotificationsScreen() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifs = async () => {
    try {
      const { data } = await notificationsApi.getAll();
      setNotifs(Array.isArray(data) ? data : []);
    } catch (err) {
      setNotifs([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadNotifs(); }, []);

  const onRefresh = async () => { setRefreshing(true); await loadNotifs(); setRefreshing(false); };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationsApi.markAsRead(id);
      loadNotifs();
    } catch (e) { showToast.error('Erreur'); }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      showToast.success('Tout marqué comme lu');
      loadNotifs();
    } catch (e) { showToast.error('Erreur'); }
  };

  const nonLuCount = notifs.filter((n) => !n.lu).length;

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {nonLuCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllAsRead}>
          <Text style={styles.markAllText}>Tout marquer comme lu ({nonLuCount})</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifs}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.lu && styles.cardUnread]}
            onPress={() => handleMarkAsRead(item.id)}
          >
            <View style={[styles.dot, !item.lu && styles.dotUnread]} />
            <View style={styles.content}>
              <Text style={[styles.message, !item.lu && styles.messageUnread]}>{item.message}</Text>
              <Text style={styles.date}>
                {new Date(item.dateNotification).toLocaleString('fr-FR')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>Aucune notification</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  markAllBtn: { backgroundColor: Colors.primary + '12', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  markAllText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  list: { padding: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  cardUnread: { backgroundColor: Colors.primary + '08', borderLeftWidth: 3, borderLeftColor: Colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border, marginRight: 12 },
  dotUnread: { backgroundColor: Colors.primary },
  content: { flex: 1 },
  message: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  messageUnread: { fontWeight: '600' },
  date: { fontSize: 12, color: Colors.textLight, marginTop: 4 },
  empty: { alignItems: 'center', padding: 50 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: Colors.textLight, fontSize: 16 },
});
