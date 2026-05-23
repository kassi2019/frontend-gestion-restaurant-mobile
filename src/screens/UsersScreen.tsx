import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../theme/colors';
import { usersApi } from '../services/api';
import { showToast } from '../services/toast';
import ActionSheet from '../components/ActionSheet';
import ModalPicker from '../components/ModalPicker';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', MANAGER: 'Manager', SERVEUR: 'Serveur',
  CUISINE: 'Cuisine', BAR: 'Bar', CAISSIER: 'Caissier',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: Colors.danger, MANAGER: Colors.warning, SERVEUR: Colors.primary,
  CUISINE: Colors.accent, BAR: Colors.info, CAISSIER: Colors.success,
};

const STATUT_LABELS: Record<string, string> = {
  ACTIF: 'Actif', INACTIF: 'Inactif', CONGE: 'Congé', SUSPENDU: 'Suspendu',
};

const STATUT_COLORS: Record<string, string> = {
  ACTIF: Colors.success, INACTIF: Colors.textLight, CONGE: Colors.warning, SUSPENDU: Colors.danger,
};

const ROLES = ['Tous', 'ADMIN', 'MANAGER', 'SERVEUR', 'CUISINE', 'BAR', 'CAISSIER'];
const STATUTS = ['ACTIF', 'INACTIF', 'CONGE', 'SUSPENDU'];

export default function UsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRole, setSelectedRole] = useState('Tous');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showStatutModal, setShowStatutModal] = useState(false);

  const loadUsers = async () => {
    try {
      const { data } = selectedRole === 'Tous'
        ? await usersApi.getAll()
        : await usersApi.findByRole(selectedRole);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, [selectedRole]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleChangeStatut = async (statut: string) => {
    if (!selectedUser) return;
    try {
      await usersApi.updateStatut(selectedUser.id, statut);
      setShowStatutModal(false);
      showToast.success(`${selectedUser.nom} → ${STATUT_LABELS[statut]}`);
      loadUsers();
    } catch (err) {
      showToast.error('Impossible de changer le statut');
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Role filter */}
      <FlatList
        horizontal
        data={ROLES}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, selectedRole === item && styles.filterChipActive]}
            onPress={() => { setSelectedRole(item); setLoading(true); }}
          >
            <Text style={[styles.filterText, selectedRole === item && styles.filterTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Users list */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => { setSelectedUser(item); setShowActionModal(true); }}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.nom.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.nom}</Text>
              <Text style={styles.phone}>{item.telephone}</Text>
            </View>
            <View style={styles.badges}>
              <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.role] + '18' }]}>
                <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] }]}>{ROLE_LABELS[item.role] || item.role}</Text>
              </View>
              <View style={[styles.statutBadge, { backgroundColor: STATUT_COLORS[item.statut] + '18' }]}>
                <Text style={[styles.statutText, { color: STATUT_COLORS[item.statut] }]}>{STATUT_LABELS[item.statut] || item.statut}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>Aucun utilisateur trouvé</Text>
          </View>
        }
      />

      {/* Action Sheet */}
      <ActionSheet
        visible={showActionModal}
        title={selectedUser?.nom}
        subtitle={`${ROLE_LABELS[selectedUser?.role] || ''} • ${selectedUser?.telephone || ''}`}
        actions={[
          { icon: '🔄', label: 'Changer statut', onPress: () => { setShowActionModal(false); setShowStatutModal(true); } },
        ]}
        onClose={() => setShowActionModal(false)}
      />

      {/* Statut Modal */}
      <ModalPicker
        visible={showStatutModal}
        title={`${selectedUser?.nom} - Changer statut`}
        options={STATUTS.map((s) => ({ label: STATUT_LABELS[s], value: s }))}
        selectedValue={selectedUser?.statut || ''}
        onSelect={handleChangeStatut}
        onClose={() => setShowStatutModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterList: { paddingHorizontal: 12, paddingVertical: 12 },
  filterChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 4, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  filterTextActive: { color: Colors.textWhite, fontWeight: '700' },
  list: { padding: 12 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: Colors.text },
  phone: { fontSize: 13, color: Colors.textLight, marginTop: 2 },
  badges: { alignItems: 'flex-end', gap: 6 },
  roleBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  roleText: { fontSize: 11, fontWeight: '700' },
  statutBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  statutText: { fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 50 },
  emptyIcon: { fontSize: 50, marginBottom: 10 },
  emptyText: { color: Colors.textLight, fontSize: 16 },
});
