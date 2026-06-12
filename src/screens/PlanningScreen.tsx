import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { planningApi, usersApi } from '../services/api';
import { showToast } from '../services/toast';
import ActionSheet from '../components/ActionSheet';
import CalendarPicker, { toDateStr, formatDisplay } from '../components/CalendarPicker';

import useResponsive from '../hooks/useResponsive';

export default function PlanningScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const { sp } = useResponsive();
  const [plannings, setPlannings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showCreateDatePicker, setShowCreateDatePicker] = useState(false);
  const [showCreateDateFinPicker, setShowCreateDateFinPicker] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [createFilterRole, setCreateFilterRole] = useState('');
  const [showFilterRole, setShowFilterRole] = useState(false);
  const [showFilterAgent, setShowFilterAgent] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [selectedPlanning, setSelectedPlanning] = useState<any>(null);
  const [serveurs, setServeurs] = useState<any[]>([]);
  const [form, setForm] = useState({ jour: '', dateFin: '', heureDebut: '08:00', heureFin: '17:00', utilisateurId: 0 });
  const [joursSelectionnes, setJoursSelectionnes] = useState<number[]>([1,2,3,4,5,6,0]); // 0=Dim,1=Lun...6=Sam, tous cochés par défaut
  const [editForm, setEditForm] = useState({ id: 0, jour: '', heureDebut: '', heureFin: '' });
  const [filterDate, setFilterDate] = useState(toDateStr(new Date()));
  const [filterUserId, setFilterUserId] = useState(0);
  const [filterRole, setFilterRole] = useState('');
  const [showFilterDatePicker, setShowFilterDatePicker] = useState(false);
  const [allServeurs, setAllServeurs] = useState<any[]>([]);

  const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin', MANAGER: 'Manager', RECEPTIONNISTE: 'Réception',
    SERVEUR: 'Serveur', CUISINE: 'Cuisine', BAR: 'Bar', CAISSIER: 'Caissier',
  };
  const ROLE_COLORS: Record<string, string> = {
    ADMIN: '#E74C3C', MANAGER: '#3498DB', RECEPTIONNISTE: '#7C3AED', SERVEUR: '#27AE60',
    CUISINE: '#F39C12', BAR: '#E67E22', CAISSIER: '#9B59B6',
  };

  const rolesDisponibles = useMemo(() => {
    const roles = new Set<string>();
    allServeurs.forEach((u) => { if (u.role) roles.add(u.role); });
    return Array.from(roles);
  }, [allServeurs]);

  const agentsFiltres = useMemo(() => {
    if (!filterRole) return allServeurs;
    return allServeurs.filter((u) => u.role === filterRole);
  }, [allServeurs, filterRole]);

  const agentsCreateFiltres = useMemo(() => {
    if (!createFilterRole) return serveurs;
    return serveurs.filter((u) => u.role === createFilterRole);
  }, [serveurs, createFilterRole]);

  const rolesCreateDisponibles = useMemo(() => {
    const roles = new Set<string>();
    serveurs.forEach((u) => { if (u.role) roles.add(u.role); });
    return Array.from(roles);
  }, [serveurs]);

  const normalizeDate = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  };

  const filteredPlannings = useMemo(() => {
    let list = plannings;
    if (filterDate) {
      list = list.filter((p) => normalizeDate(p.jour) === filterDate);
    }
    if (isManager && filterUserId > 0) {
      list = list.filter((p) => p.utilisateur?.id === filterUserId || p.utilisateurId === filterUserId);
    } else if (isManager && filterRole) {
      list = list.filter((p) => p.utilisateur?.role === filterRole);
    }
    return list;
  }, [plannings, filterDate, filterUserId, filterRole, isManager]);

  useEffect(() => { loadPlannings(); loadServeursForFilter(); }, []);

  const loadServeursForFilter = async () => {
    if (!isManager) return;
    try {
      const { data } = await usersApi.getAll();
      setAllServeurs(Array.isArray(data) ? data : []);
    } catch (e) { setAllServeurs([]); }
  };

  const loadPlannings = async () => {
    try {
      const { data } = isManager
        ? await planningApi.getAll()
        : await planningApi.getMine();
      setPlannings(Array.isArray(data) ? data : []);
    } catch (err) {
      setPlannings([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlannings();
    setRefreshing(false);
  };

  const openCreateModal = async () => {
    if (isManager) {
      try {
        const { data } = await usersApi.getAll();
        setServeurs(Array.isArray(data) ? data : []);
      } catch (e) { setServeurs([]); }
    }
    setCreateFilterRole('');
    setForm({ jour: filterDate, dateFin: '', heureDebut: '08:00', heureFin: '17:00', utilisateurId: isManager ? 0 : user!.id });
    // Pré-remplir jours selon repos utilisateur
    const ut = isManager && form.utilisateurId ? serveurs.find(s => s.id === form.utilisateurId) : user;
    const repos = (ut as any)?.joursRepos;
    if (repos) {
      const reposArray = repos.split(',').map(Number).filter((n: number) => !isNaN(n));
      setJoursSelectionnes([0,1,2,3,4,5,6].filter(d => !reposArray.includes(d)));
    } else { setJoursSelectionnes([0,1,2,3,4,5,6]); }
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!form.jour) return Alert.alert('Erreur', 'La date est requise (YYYY-MM-DD)');
    const uid = isManager ? form.utilisateurId : user!.id;
    if (!uid) return Alert.alert('Erreur', 'Sélectionnez un agent');
    try {
      await planningApi.create({
        utilisateurId: uid,
        jour: form.jour,
        heureDebut: form.heureDebut,
        heureFin: form.heureFin,
      });
      setForm({ jour: '', dateFin: '', heureDebut: '08:00', heureFin: '17:00', utilisateurId: 0 });
      showToast.success('Planning créé');
      loadPlannings();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Impossible de créer le planning');
    }
  };

  const JOURS_NOMS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const handleCreerTout = async () => {
    if (!form.jour || !form.dateFin) { showToast.error('Dates début et fin requises'); return; }
    const uid = isManager ? form.utilisateurId : user!.id;
    if (!uid) { showToast.error('Sélectionnez une personne'); return; }
    // Sauvegarder les jours de repos dans le profil
    const repos = [0,1,2,3,4,5,6].filter(d => !joursSelectionnes.includes(d)).join(',');
    try { await usersApi.update(uid, { joursRepos: repos } as any); } catch {}
    const debut = new Date(form.jour + 'T00:00:00');
    const fin = new Date(form.dateFin + 'T00:00:00');
    if (fin < debut) { showToast.error('Date fin < date début'); return; }
    let ok = 0;
    const current = new Date(debut);
    while (current <= fin) {
      const js = current.getDay();
      if (joursSelectionnes.includes(js)) {
        try {
          await planningApi.create({ utilisateurId: uid, jour: toDateStr(current), heureDebut: form.heureDebut, heureFin: form.heureFin });
          ok++;
        } catch {}
      }
      current.setDate(current.getDate() + 1);
    }
    showToast.success(`${ok} planning(s) créé(s)`);
    setShowCreateModal(false);
    loadPlannings();
  };

  const handleEdit = async () => {
    if (!editForm.jour) return Alert.alert('Erreur', 'La date est requise');
    try {
      await planningApi.update(editForm.id, {
        jour: editForm.jour,
        heureDebut: editForm.heureDebut,
        heureFin: editForm.heureFin,
      });
      setShowEditModal(false);
      showToast.success('Planning modifié');
      loadPlannings();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Impossible de modifier le planning');
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert('Confirmer', 'Supprimer ce planning ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await planningApi.delete(item.id);
            showToast.success('Planning supprimé');
            loadPlannings();
          } catch (e) { showToast.error('Suppression échouée'); }
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const toTimeStr = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
      <FlatList
        data={filteredPlannings}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.filterBar}>
            {/* Filtre date */}
            <TouchableOpacity style={styles.filterDateBtn} onPress={() => setShowFilterDatePicker(true)}>
              <Text style={styles.filterDateIcon}>📅</Text>
              <Text style={styles.filterDateText}>
                {filterDate ? formatDisplay(filterDate) : 'Toutes les dates'}
              </Text>
            </TouchableOpacity>

            {/* Filtres dropdown (admin/manager) */}
            {isManager && allServeurs.length > 0 && (
              <View style={styles.filterSection}>
                <View style={styles.filterSelectRow}>
                  {/* Sélecteur Rôle */}
                  <TouchableOpacity style={styles.filterSelect} onPress={() => setShowFilterRole(!showFilterRole)}>
                    <Text style={styles.filterSelectLabel}>Rôle</Text>
                    <Text style={styles.filterSelectValue}>{filterRole ? ROLE_LABELS[filterRole] : 'Tous'}</Text>
                    <Text style={styles.filterSelectArrow}>▼</Text>
                  </TouchableOpacity>

                  {/* Sélecteur Agent */}
                  <TouchableOpacity style={styles.filterSelect} onPress={() => setShowFilterAgent(!showFilterAgent)}>
                    <Text style={styles.filterSelectLabel}>Agent</Text>
                    <Text style={styles.filterSelectValue}>
                      {filterUserId > 0 ? allServeurs.find(a => a.id === filterUserId)?.nom || 'Agent' : 'Tous'}
                    </Text>
                    <Text style={styles.filterSelectArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Modal Role */}
                {showFilterRole && (
                  <Modal transparent animationType="fade">
                    <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowFilterRole(false)} activeOpacity={1}>
                      <View style={styles.dropdownList}>
                        <TouchableOpacity
                          style={[styles.dropdownItem, filterRole === '' && styles.dropdownItemActive]}
                          onPress={() => { setFilterRole(''); setFilterUserId(0); setShowFilterRole(false); }}
                        >
                          <Text style={[styles.dropdownItemText, filterRole === '' && styles.dropdownItemTextActive]}>Tous les rôles</Text>
                        </TouchableOpacity>
                        {rolesDisponibles.map((role) => (
                          <TouchableOpacity
                            key={role}
                            style={[styles.dropdownItem, filterRole === role && styles.dropdownItemActive]}
                            onPress={() => { setFilterRole(filterRole === role ? '' : role); setFilterUserId(0); setShowFilterRole(false); }}
                          >
                            <Text style={[styles.dropdownItemText, filterRole === role && styles.dropdownItemTextActive]}>
                              {ROLE_LABELS[role] || role}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </TouchableOpacity>
                  </Modal>
                )}

                {/* Modal Agent */}
                {showFilterAgent && (
                  <Modal transparent animationType="fade">
                    <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setShowFilterAgent(false)} activeOpacity={1}>
                      <View style={styles.dropdownList}>
                        <TouchableOpacity
                          style={[styles.dropdownItem, filterUserId === 0 && styles.dropdownItemActive]}
                          onPress={() => { setFilterUserId(0); setShowFilterAgent(false); }}
                        >
                          <Text style={[styles.dropdownItemText, filterUserId === 0 && styles.dropdownItemTextActive]}>Tous les agents</Text>
                        </TouchableOpacity>
                        {(filterRole ? agentsFiltres : allServeurs).map((a) => (
                          <TouchableOpacity
                            key={a.id}
                            style={[styles.dropdownItem, filterUserId === a.id && styles.dropdownItemActive]}
                            onPress={() => { setFilterUserId(filterUserId === a.id ? 0 : a.id); setShowFilterAgent(false); }}
                          >
                            <Text style={[styles.dropdownItemText, filterUserId === a.id && styles.dropdownItemTextActive]}>
                              {a.nom} — {ROLE_LABELS[a.role] || a.role}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </TouchableOpacity>
                  </Modal>
                )}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => { setSelectedPlanning(item); if (isManager) setShowActionModal(true); }}
            activeOpacity={isManager ? 0.7 : 1}
          >
            <View style={styles.dateBox}>
              <Text style={styles.dateText}>{formatDate(item.jour)}</Text>
            </View>
            <View style={styles.timeRow}>
              <View style={styles.timeBox}>
                <Text style={styles.timeLabel}>Début</Text>
                <Text style={styles.timeValue}>{formatTime(item.heureDebut)}</Text>
              </View>
              <View style={styles.timeDivider}><View style={styles.dividerLine} /></View>
              <View style={styles.timeBox}>
                <Text style={styles.timeLabel}>Fin</Text>
                <Text style={styles.timeValue}>{formatTime(item.heureFin)}</Text>
              </View>
            </View>
            <View style={[styles.statutBadge, { backgroundColor: item.statut === 'ACTIF' ? Colors.success + '15' : Colors.danger + '15' }]}>
              <Text style={[styles.statutText, { color: item.statut === 'ACTIF' ? Colors.success : Colors.danger }]}>
                {item.statut === 'ACTIF' ? 'Actif' : item.statut === 'ABSENT' ? 'Absent' : 'Congé'}
              </Text>
            </View>
            {isManager && item.utilisateur && (
              <View style={styles.serveurInfo}>
                <Text style={styles.serveurName}>{item.utilisateur.nom}</Text>
                <Text style={styles.serveurRole}>{ROLE_LABELS[item.utilisateur.role] || item.utilisateur.role}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>Aucun planning trouvé</Text>
          </View>
        }
      />

      {isManager && (
        <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Action Sheet */}
      <ActionSheet
        visible={showActionModal}
        title="Planning"
        subtitle={selectedPlanning ? formatDate(selectedPlanning.jour) : ''}
        actions={[
          {
            icon: '✏️', label: 'Modifier',
            onPress: () => {
              setShowActionModal(false);
              setEditForm({
                id: selectedPlanning?.id || 0,
                jour: toDateStr(selectedPlanning?.jour),
                heureDebut: toTimeStr(selectedPlanning?.heureDebut),
                heureFin: toTimeStr(selectedPlanning?.heureFin),
              });
              setShowEditModal(true);
            },
          },
          { icon: '🗑', label: 'Supprimer', danger: true, onPress: () => { setShowActionModal(false); handleDelete(selectedPlanning); } },
        ]}
        onClose={() => setShowActionModal(false)}
      />

      {/* Create Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Nouveau Planning</Text>
              <Text style={styles.fieldLabel}>Date</Text>
              <TouchableOpacity style={styles.dateField} onPress={() => setShowCreateDatePicker(true)}>
                <Text style={form.jour ? styles.dateFieldText : styles.dateFieldPlaceholder}>
                  {form.jour ? formatDisplay(form.jour) : 'Appuyez pour choisir une date'}
                </Text>
                <Text style={styles.dateFieldIcon}>📅</Text>
              </TouchableOpacity>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.fieldLabel}>Heure début</Text>
                  <TextInput style={styles.field} placeholder="08:00" value={form.heureDebut} onChangeText={(t) => setForm({ ...form, heureDebut: t })} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.fieldLabel}>Heure fin</Text>
                  <TextInput style={styles.field} placeholder="17:00" value={form.heureFin} onChangeText={(t) => setForm({ ...form, heureFin: t })} />
                </View>
              </View>
              {isManager && serveurs.length > 0 && (
                <>
                  {/* Select Rôle */}
                  <Text style={styles.fieldLabel}>Rôle</Text>
                  <TouchableOpacity
                    style={styles.selectField}
                    onPress={() => { setShowCreateRole(!showCreateRole); setShowCreateAgent(false); }}
                  >
                    <Text style={createFilterRole ? styles.selectFieldText : styles.selectFieldPlaceholder}>
                      {createFilterRole ? ROLE_LABELS[createFilterRole] || createFilterRole : 'Sélectionnez un rôle'}
                    </Text>
                    <Text style={styles.selectArrow}>{showCreateRole ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {showCreateRole && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      <TouchableOpacity
                        style={[styles.dropdownItem, createFilterRole === '' && styles.dropdownItemSelected]}
                        onPress={() => { setCreateFilterRole(''); setForm({ ...form, utilisateurId: 0 }); setShowCreateRole(false); }}
                      >
                        <Text style={createFilterRole === '' ? styles.dropdownItemTextSelected : styles.dropdownItemText}>Tous</Text>
                      </TouchableOpacity>
                      {rolesCreateDisponibles.map((role) => (
                        <TouchableOpacity
                          key={role}
                          style={[styles.dropdownItem, createFilterRole === role && styles.dropdownItemSelected]}
                          onPress={() => { setCreateFilterRole(role); setForm({ ...form, utilisateurId: 0 }); setShowCreateRole(false); }}
                        >
                          <Text style={createFilterRole === role ? styles.dropdownItemTextSelected : styles.dropdownItemText}>
                            {ROLE_LABELS[role] || role}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Select Agent */}
                  <Text style={styles.fieldLabel}>Agent</Text>
                  <TouchableOpacity
                    style={styles.selectField}
                    onPress={() => { setShowCreateAgent(!showCreateAgent); setShowCreateRole(false); }}
                  >
                    <Text style={form.utilisateurId ? styles.selectFieldText : styles.selectFieldPlaceholder}>
                      {form.utilisateurId ? (serveurs.find(s => s.id === form.utilisateurId)?.nom || 'Sélectionné') : 'Sélectionnez un agent'}
                    </Text>
                    <Text style={styles.selectArrow}>{showCreateAgent ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {showCreateAgent && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                        {agentsCreateFiltres.map((a) => (
                          <TouchableOpacity
                            key={a.id}
                            style={[styles.dropdownItem, form.utilisateurId === a.id && styles.dropdownItemSelected]}
                            onPress={() => { setForm({ ...form, utilisateurId: a.id }); setShowCreateAgent(false); }}
                          >
                            <Text style={form.utilisateurId === a.id ? styles.dropdownItemTextSelected : styles.dropdownItemText}>{a.nom}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
              {/* Date fin + Jours + Créer tout */}
              <Text style={styles.fieldLabel}>Date fin (intervalle)</Text>
              <TouchableOpacity style={styles.dateField} onPress={() => setShowCreateDateFinPicker(true)}>
                <Text style={form.dateFin ? styles.dateFieldText : styles.dateFieldPlaceholder}>
                  {form.dateFin ? formatDisplay(form.dateFin) : 'Même date si vide'}
                </Text>
                <Text style={styles.dateFieldIcon}>📅</Text>
              </TouchableOpacity>
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Jours travaillés</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {JOURS_NOMS.map((nom, idx) => (
                  <TouchableOpacity key={idx}
                    style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: joursSelectionnes.includes(idx) ? Colors.primary : Colors.inputBg, borderWidth: 1, borderColor: joursSelectionnes.includes(idx) ? Colors.primary : Colors.border }}
                    onPress={() => setJoursSelectionnes(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: joursSelectionnes.includes(idx) ? Colors.textWhite : Colors.textLight }}>{nom}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}><Text style={styles.saveText}>Créer</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.accent, marginLeft: 8 }]} onPress={handleCreerTout}><Text style={styles.saveText}>📆 Créer tout</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>



      {/* Create Date Picker */}
      <CalendarPicker
        visible={showCreateDatePicker}
        value={form.jour}
        onSelect={(dateStr) => setForm({ ...form, jour: dateStr })}
        onClose={() => setShowCreateDatePicker(false)}
      />
      <CalendarPicker
        visible={showCreateDateFinPicker}
        value={form.dateFin || form.jour}
        onSelect={(dateStr) => setForm({ ...form, dateFin: dateStr })}
        onClose={() => setShowCreateDateFinPicker(false)}
      />

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier le Planning</Text>
            <Text style={styles.fieldLabel}>Date</Text>
            <TouchableOpacity style={styles.dateField} onPress={() => setShowEditDatePicker(true)}>
              <Text style={editForm.jour ? styles.dateFieldText : styles.dateFieldPlaceholder}>
                {editForm.jour ? formatDisplay(editForm.jour) : 'Appuyez pour choisir une date'}
              </Text>
              <Text style={styles.dateFieldIcon}>📅</Text>
            </TouchableOpacity>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>Heure début</Text>
                <TextInput style={styles.field} placeholder="08:00" value={editForm.heureDebut} onChangeText={(t) => setEditForm({ ...editForm, heureDebut: t })} />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.fieldLabel}>Heure fin</Text>
                <TextInput style={styles.field} placeholder="17:00" value={editForm.heureFin} onChangeText={(t) => setEditForm({ ...editForm, heureFin: t })} />
              </View>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleEdit}><Text style={styles.saveText}>Enregistrer</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Date Picker */}
      <CalendarPicker
        visible={showEditDatePicker}
        value={editForm.jour}
        onSelect={(dateStr) => setEditForm({ ...editForm, jour: dateStr })}
        onClose={() => setShowEditDatePicker(false)}
      />

      {/* Filter Date Picker */}
      <CalendarPicker
        visible={showFilterDatePicker}
        value={filterDate}
        onSelect={(dateStr) => setFilterDate(dateStr)}
        onClose={() => setShowFilterDatePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, paddingBottom: 80 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    overflow: 'visible',
  },
  dateBox: { marginBottom: 12 },
  dateText: { fontSize: 16, fontWeight: '700', color: Colors.text, textTransform: 'capitalize' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  timeBox: { flex: 1, backgroundColor: Colors.inputBg, borderRadius: 12, padding: 12, alignItems: 'center' },
  timeLabel: { fontSize: 11, color: Colors.textLight, fontWeight: '500', marginBottom: 4 },
  timeValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  timeDivider: { paddingHorizontal: 12, alignItems: 'center' },
  dividerLine: { width: 20, height: 2, backgroundColor: Colors.border },
  statutBadge: { borderRadius: 12, paddingVertical: 6, alignItems: 'center' },
  statutText: { fontWeight: '700', fontSize: 13 },
  serveurInfo: { alignItems: 'center', marginTop: 8 },
  serveurName: { fontSize: 13, fontWeight: '600', color: Colors.secondary },
  serveurRole: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
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
  dateField: { backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateFieldText: { fontSize: 15, color: Colors.text, textTransform: 'capitalize', flex: 1 },
  dateFieldPlaceholder: { fontSize: 15, color: Colors.textLight, flex: 1 },
  dateFieldIcon: { fontSize: 18 },
  selectField: { backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectFieldText: { fontSize: 15, color: Colors.text },
  selectFieldPlaceholder: { fontSize: 15, color: Colors.textLight },
  selectArrow: { fontSize: 12, color: Colors.textLight, marginLeft: 8 },
  row: { flexDirection: 'row' },
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
  filterBar: { marginBottom: 4 },
  filterDateBtn: {
    backgroundColor: Colors.surface, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  filterDateIcon: { fontSize: 16, marginRight: 10 },
  filterDateText: { fontSize: 15, fontWeight: '600', color: Colors.text, textTransform: 'capitalize', flex: 1 },
  filterSection: { marginTop: 10 },
  filterSelectRow: { flexDirection: 'row', gap: 8 },
  filterSelect: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterSelectLabel: { fontSize: 10, color: Colors.textLight, marginRight: 6 },
  filterSelectValue: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  filterSelectArrow: { fontSize: 10, color: Colors.textLight },
  dropdownOverlay: {
    flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center',
    paddingHorizontal: 30,
  },
  dropdownList: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 8,
    maxHeight: 300,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
  },
  dropdownItem: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10 },
  dropdownItemActive: { backgroundColor: Colors.primary + '15' },
  dropdownItemSelected: { backgroundColor: Colors.primary + '15' },
  dropdownItemText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  dropdownItemTextActive: { color: Colors.primary, fontWeight: '700' },
  dropdownItemTextSelected: { color: Colors.primary, fontWeight: '700' },
  filterSectionTitle: { fontSize: 12, fontWeight: '600', color: Colors.textLight, marginBottom: 6 },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  roleChip: {
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  roleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleChipText: { fontSize: 13, color: Colors.textLight },
  roleChipTextActive: { fontSize: 13, color: Colors.textWhite, fontWeight: '600' },
  agentChip: {
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  agentChipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  agentChipText: { fontSize: 12, color: Colors.textLight },
  agentChipTextActive: { fontSize: 12, color: Colors.textWhite, fontWeight: '600' },
  modalRoleChip: {
    borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border,
    marginTop: 4, marginRight: 6, alignSelf: 'flex-start',
  },
  modalRoleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modalRoleChipText: { fontSize: 12, color: Colors.textLight },
  modalRoleChipTextActive: { fontSize: 12, color: Colors.textWhite, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 50 },
  emptyIcon: { fontSize: 50, marginBottom: 10 },
  emptyText: { color: Colors.textLight, fontSize: 16 },
});
