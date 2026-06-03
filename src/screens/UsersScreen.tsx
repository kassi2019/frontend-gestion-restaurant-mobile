import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { usersApi, authApi, menuApi } from '../services/api';
import { showToast } from '../services/toast';
import ActionSheet from '../components/ActionSheet';
import ModalPicker from '../components/ModalPicker';
import PasswordInput from '../components/PasswordInput';
import useResponsive from '../hooks/useResponsive';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', MANAGER: 'Manager', RECEPTIONNISTE: 'Réception',
  SERVEUR: 'Serveur', CUISINE: 'Cuisine', BAR: 'Bar', CAISSIER: 'Caissier',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: Colors.danger, MANAGER: Colors.warning, RECEPTIONNISTE: Colors.accent,
  SERVEUR: Colors.primary, CUISINE: Colors.accent, BAR: Colors.info, CAISSIER: Colors.success,
};

const STATUT_LABELS: Record<string, string> = {
  ACTIF: 'Actif', INACTIF: 'Inactif', CONGE: 'Congé', SUSPENDU: 'Suspendu',
};

const STATUT_COLORS: Record<string, string> = {
  ACTIF: Colors.success, INACTIF: Colors.textLight, CONGE: Colors.warning, SUSPENDU: Colors.danger,
};

const ROLES = ['Tous', 'ADMIN', 'MANAGER', 'RECEPTIONNISTE', 'SERVEUR', 'CUISINE', 'BAR', 'CAISSIER'];
const STATUTS = ['ACTIF', 'INACTIF', 'CONGE', 'SUSPENDU'];
const ROLE_OPTIONS = ['ADMIN', 'MANAGER', 'RECEPTIONNISTE', 'SERVEUR', 'CUISINE', 'BAR', 'CAISSIER'];

export default function UsersScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const { sp } = useResponsive();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRole, setSelectedRole] = useState('Tous');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showStatutModal, setShowStatutModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRoleCreatePicker, setShowRoleCreatePicker] = useState(false);
  const [showRoleEditPicker, setShowRoleEditPicker] = useState(false);
  const [createForm, setCreateForm] = useState({ nom: '', telephone: '', mot_de_passe: '', role: 'SERVEUR' });
  const [editForm, setEditForm] = useState({ id: 0, nom: '', telephone: '', role: '', mot_de_passe: '' });
  const [showModulesModal, setShowModulesModal] = useState(false);
  const [availableModules, setAvailableModules] = useState<any[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<number>>(new Set());
  const [editingUserModules, setEditingUserModules] = useState<any>(null);

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

  const openModulesEdit = async (u: any) => {
    setEditingUserModules(u);
    try {
      let { data } = await authApi.getModules();
      // SUPER_ADMIN uniquement peut voir/assigner "Générer codes"
      if (user?.role !== 'SUPER_ADMIN') {
        data = (data || []).filter((m: any) => m.route !== '/super/codes');
      }
      setAvailableModules(data || []);
      // Précharger les modules existants (userModules chargés par l'API)
      const mods: number[] = u.userModules?.map((um: any) => um.module?.id).filter(Boolean) || [];
      setSelectedModuleIds(new Set(mods));
    } catch {}
    setShowModulesModal(true);
  };

  const handleSaveModules = async () => {
    if (!editingUserModules) return;
    try {
      await authApi.updateUserModules(editingUserModules.id, Array.from(selectedModuleIds));
      showToast.success('Modules mis à jour');
      setShowModulesModal(false);
      loadUsers();
    } catch { showToast.error('Erreur'); }
  };

  const handleCreate = async () => {
    if (!createForm.nom || !createForm.telephone || !createForm.mot_de_passe) {
      return Alert.alert('Erreur', 'Remplissez tous les champs');
    }
    try {
      await authApi.register({
        nom: createForm.nom,
        telephone: createForm.telephone,
        mot_de_passe: createForm.mot_de_passe,
        role: createForm.role,
        restaurantId: user!.restaurantId,
        moduleIds: Array.from(selectedModuleIds),
      });
      setCreateForm({ nom: '', telephone: '', mot_de_passe: '', role: 'SERVEUR' });
      showToast.success(`Utilisateur "${createForm.nom}" créé`);
      loadUsers();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Impossible de créer l\'utilisateur');
    }
  };

  const handleEdit = async () => {
    if (!editForm.nom) return Alert.alert('Erreur', 'Le nom est requis');
    try {
      const payload: any = { nom: editForm.nom, telephone: editForm.telephone, role: editForm.role };
      if (editForm.mot_de_passe) payload.mot_de_passe = editForm.mot_de_passe;
      await usersApi.update(editForm.id, payload);
      setShowEditModal(false);
      showToast.success(`Utilisateur "${editForm.nom}" modifié`);
      loadUsers();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Impossible de modifier l\'utilisateur');
    }
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
            onPress={() => { if (isManager) { setSelectedUser(item); setShowActionModal(true); } }}
            activeOpacity={isManager ? 0.7 : 1}
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

      {isManager && (
        <TouchableOpacity style={styles.fab} onPress={async () => { setCreateForm({ nom: '', telephone: '', mot_de_passe: '', role: 'SERVEUR' }); setSelectedModuleIds(new Set()); try { const { data } = await authApi.getModules(); setAvailableModules(data || []); } catch {} setShowCreateModal(true); }}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Action Sheet */}
      <ActionSheet
        visible={showActionModal}
        title={selectedUser?.nom}
        subtitle={`${ROLE_LABELS[selectedUser?.role] || ''} • ${selectedUser?.telephone || ''}`}
        actions={[
          {
            icon: '🧩', label: 'Modules',
            onPress: () => {
              setShowActionModal(false);
              setTimeout(() => openModulesEdit(selectedUser), 300);
            },
          },
          {
            icon: '✏️', label: 'Modifier',
            onPress: () => {
              setShowActionModal(false);
              setEditForm({ id: selectedUser.id, nom: selectedUser.nom, telephone: selectedUser.telephone, role: selectedUser.role, mot_de_passe: '' });
              setShowEditModal(true);
            },
          },
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

      {/* Create User Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: '80%' }}>
            <Text style={styles.modalTitle}>Nouvel Utilisateur</Text>
            <Text style={styles.fieldLabel}>Nom</Text>
            <TextInput style={styles.field} placeholder="Ex: Jean Dupont" value={createForm.nom} onChangeText={(t) => setCreateForm({ ...createForm, nom: t })} />
            <Text style={styles.fieldLabel}>Téléphone</Text>
            <TextInput style={styles.field} placeholder="Ex: 0101010101" keyboardType="phone-pad" value={createForm.telephone} onChangeText={(t) => setCreateForm({ ...createForm, telephone: t })} />
            <Text style={styles.fieldLabel}>Mot de passe</Text>
            <PasswordInput value={createForm.mot_de_passe} onChangeText={(t) => setCreateForm({ ...createForm, mot_de_passe: t })} placeholder="Mot de passe" />
            <Text style={styles.fieldLabel}>Rôle</Text>
            <TouchableOpacity
              style={styles.selectField}
              onPress={() => setShowRoleCreatePicker(true)}
            >
              <Text style={styles.selectFieldText}>{ROLE_LABELS[createForm.role]}</Text>
              <Text style={styles.selectFieldIcon}>▼</Text>
            </TouchableOpacity>
            {/* Modules */}
            {availableModules.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>🧩 Modules</Text>
                <View style={styles.moduleGrid}>
                  {availableModules.map((m: any) => {
                    const checked = selectedModuleIds.has(m.id);
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.moduleChip, checked && styles.moduleChipActive]}
                        onPress={() => {
                          setSelectedModuleIds(prev => {
                            const next = new Set(prev);
                            if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
                            return next;
                          });
                        }}
                      >
                        <Text style={styles.moduleChipIcon}>{m.icon}</Text>
                        <Text style={[styles.moduleChipText, checked && styles.moduleChipTextActive]} numberOfLines={1}>{m.nom}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}><Text style={styles.saveText}>Créer</Text></TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
        <ModalPicker
          visible={showRoleCreatePicker}
          title="Choisir un rôle"
          options={ROLE_OPTIONS.map((role) => ({ label: ROLE_LABELS[role], value: role }))}
          selectedValue={createForm.role}
          onSelect={(value) => setCreateForm({ ...createForm, role: value })}
          onClose={() => setShowRoleCreatePicker(false)}
        />
      </Modal>

      {/* Edit User Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier l'Utilisateur</Text>
            <Text style={styles.fieldLabel}>Nom</Text>
            <TextInput style={styles.field} placeholder="Nom" value={editForm.nom} onChangeText={(t) => setEditForm({ ...editForm, nom: t })} />
            <Text style={styles.fieldLabel}>Téléphone</Text>
            <TextInput style={styles.field} placeholder="Téléphone" keyboardType="phone-pad" value={editForm.telephone} onChangeText={(t) => setEditForm({ ...editForm, telephone: t })} />
            <Text style={styles.fieldLabel}>Rôle</Text>
            <TouchableOpacity
              style={styles.selectField}
              onPress={() => setShowRoleEditPicker(true)}
            >
              <Text style={styles.selectFieldText}>{ROLE_LABELS[editForm.role] || editForm.role}</Text>
              <Text style={styles.selectFieldIcon}>▼</Text>
            </TouchableOpacity>
            <Text style={styles.fieldLabel}>Nouveau mot de passe (optionnel)</Text>
            <PasswordInput value={editForm.mot_de_passe} onChangeText={(t) => setEditForm({ ...editForm, mot_de_passe: t })} placeholder="Laisser vide pour ne pas changer" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleEdit}><Text style={styles.saveText}>Enregistrer</Text></TouchableOpacity>
            </View>
          </View>
        </View>
        <ModalPicker
          visible={showRoleEditPicker}
          title="Choisir un rôle"
          options={ROLE_OPTIONS.map((role) => ({ label: ROLE_LABELS[role], value: role }))}
          selectedValue={editForm.role}
          onSelect={(value) => setEditForm({ ...editForm, role: value })}
          onClose={() => setShowRoleEditPicker(false)}
        />
      </Modal>

      {/* Modal Modules */}
      <Modal visible={showModulesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🧩 Modules — {editingUserModules?.nom}</Text>
              <TouchableOpacity onPress={() => setShowModulesModal(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.moduleGrid}>
              {availableModules.map((m: any) => {
                const checked = selectedModuleIds.has(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.moduleChip, checked && styles.moduleChipActive]}
                    onPress={() => {
                      setSelectedModuleIds(prev => {
                        const next = new Set(prev);
                        if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
                        return next;
                      });
                    }}
                  >
                    <Text style={styles.moduleChipIcon}>{m.icon}</Text>
                    <Text style={[styles.moduleChipText, checked && styles.moduleChipTextActive]} numberOfLines={1}>{m.nom}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ marginTop: 16 }}>
              <TouchableOpacity style={styles.fullBtn} onPress={handleSaveModules}>
                <Text style={styles.saveText}>Enregistrer les modules</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center', marginTop: 8 }} onPress={() => setShowModulesModal(false)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterList: { paddingHorizontal: 12, paddingVertical: 8 },
  filterChip: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginHorizontal: 3, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 11, color: Colors.textLight, fontWeight: '500' },
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
  fab: {
    position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: Colors.textWhite, fontSize: 28, fontWeight: '300', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 20, textAlign: 'center' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.secondary, marginBottom: 6, marginTop: 12 },
  field: { backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  selectField: { backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectFieldText: { fontSize: 15, color: Colors.text, flex: 1 },
  selectFieldIcon: { fontSize: 12, color: Colors.textLight, marginLeft: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  optChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, marginTop: 4, marginRight: 6, alignSelf: 'flex-start' },
  optChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optChipText: { fontSize: 13, color: Colors.textLight },
  optChipTextActive: { fontSize: 13, color: Colors.textWhite, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
  cancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { color: Colors.textLight, fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, backgroundColor: Colors.primary, alignItems: 'center' },
  saveText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 8 },
  moduleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border,
  },
  moduleChipActive: { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
  moduleChipIcon: { fontSize: 12 },
  moduleChipText: { fontSize: 11, color: Colors.textLight, fontWeight: '600' },
  moduleChipTextActive: { color: Colors.primary, fontWeight: '700' },
  fullBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
});
