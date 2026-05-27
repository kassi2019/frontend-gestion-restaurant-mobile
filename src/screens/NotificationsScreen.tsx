import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { notificationsApi } from '../services/api';
import { showToast } from '../services/toast';
import CalendarPicker, { toDateStr, formatDisplay } from '../components/CalendarPicker';

export default function NotificationsScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterDate, setFilterDate] = useState(toDateStr(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadNotifs = async (date: string) => {
    try {
      const { data } = await notificationsApi.getAll(date);
      setNotifs(Array.isArray(data) ? data : []);
    } catch (err) {
      setNotifs([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadNotifs(filterDate); }, []);

  const onRefresh = async () => { setRefreshing(true); await loadNotifs(filterDate); setRefreshing(false); };

  const handleFilterDate = (dateStr: string) => {
    setFilterDate(dateStr);
    setShowDatePicker(false);
    setLoading(true);
    loadNotifs(dateStr);
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationsApi.markAsRead(id);
      loadNotifs(filterDate);
    } catch (e) { showToast.error('Erreur'); }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      showToast.success('Tout marqué comme lu');
      loadNotifs(filterDate);
    } catch (e) { showToast.error('Erreur'); }
  };

  const nonLuCount = notifs.filter((n) => !n.lu).length;

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Filtre date */}
      <TouchableOpacity style={styles.dateFilter} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.dateFilterIcon}>📅</Text>
        <Text style={styles.dateFilterText}>{formatDisplay(filterDate)}</Text>
        <Text style={styles.dateFilterArrow}>▼</Text>
      </TouchableOpacity>

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
              {isAdminOrManager && item.utilisateur && (
                <Text style={styles.userName}>{item.utilisateur.nom}</Text>
              )}
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

      <CalendarPicker
        visible={showDatePicker}
        value={filterDate}
        onSelect={handleFilterDate}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dateFilter: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, margin: 12, marginBottom: 0,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  dateFilterIcon: { fontSize: 16, marginRight: 10 },
  dateFilterText: { fontSize: 15, fontWeight: '600', color: Colors.text, textTransform: 'capitalize', flex: 1 },
  dateFilterArrow: { fontSize: 12, color: Colors.textLight },
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
  userName: { fontSize: 12, color: Colors.secondary, fontWeight: '600', marginTop: 2 },
  date: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  empty: { alignItems: 'center', padding: 50 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: Colors.textLight, fontSize: 16 },
});
