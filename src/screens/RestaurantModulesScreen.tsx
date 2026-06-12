import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { authApi } from '../services/api';
import { showToast } from '../services/toast';
import useResponsive from '../hooks/useResponsive';

export default function RestaurantModulesScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { sp } = useResponsive();
  const { restaurantId, restaurantNom } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allModules, setAllModules] = useState<any[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
  // Track original state to detect changes
  const [originalIds, setOriginalIds] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Super admin sees all modules via getModules()
      const [modulesRes, restaurantRes] = await Promise.all([
        authApi.getModules(),
        authApi.getRestaurantModules(restaurantId),
      ]);

      const modules = modulesRes.data || [];
      setAllModules(modules);

      // L'API renvoie modulesAttribues comme un tableau de Module (avec .id direct)
      const attribues = restaurantRes.data?.modulesAttribues || [];
      const ids = new Set<number>(attribues.map((a: any) => a.id).filter(Boolean));
      setAssignedIds(ids);
      setOriginalIds(new Set(ids));
      setHasChanges(false);
    } catch {
      showToast.error('Erreur de chargement des modules');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData]),
  );

  const toggleModule = (moduleId: number) => {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      // Check if different from original
      const changed = next.size !== originalIds.size
        || [...next].some((id) => !originalIds.has(id))
        || [...originalIds].some((id) => !next.has(id));
      setHasChanges(changed);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await authApi.updateRestaurantModules(restaurantId, Array.from(assignedIds));
      setOriginalIds(new Set(assignedIds));
      setHasChanges(false);
      showToast.success(`Modules mis à jour pour "${restaurantNom}"`);
    } catch {
      showToast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Group modules by category for better UX
  const moduleCategories = React.useMemo(() => {
    const cats: Record<string, any[]> = {};
    allModules.forEach((m: any) => {
      const cat = m.categorie || 'Général';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(m);
    });
    // Move 'Général' to the end
    const sorted = Object.entries(cats).sort(([a], [b]) => {
      if (a === 'Général') return 1;
      if (b === 'Général') return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [allModules]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement des modules...</Text>
      </View>
    );
  }

  const assignedCount = assignedIds.size;
  const totalCount = allModules.length;

  return (
    <View style={styles.container}>
      {/* Header summary */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryLeft}>
          <Text style={styles.restoName}>{restaurantNom}</Text>
          <Text style={styles.summaryText}>
            {assignedCount}/{totalCount} modules attribués
          </Text>
        </View>
        {hasChanges && (
          <View style={styles.changeBadge}>
            <Text style={styles.changeBadgeText}>Modifié</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} colors={[Colors.primary]} />
        }
      >
        {/* Quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => {
              const allIds = new Set(allModules.map((m: any) => m.id));
              setAssignedIds(allIds);
              setHasChanges(
                allIds.size !== originalIds.size
                || [...allIds].some((id) => !originalIds.has(id))
              );
            }}
          >
            <Text style={styles.quickBtnIcon}>✅</Text>
            <Text style={styles.quickBtnText}>Tout sélectionner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickBtnOutline]}
            onPress={() => {
              setAssignedIds(new Set());
              setHasChanges(originalIds.size > 0);
            }}
          >
            <Text style={styles.quickBtnIcon}>⬜</Text>
            <Text style={[styles.quickBtnText, styles.quickBtnOutlineText]}>Tout désélectionner</Text>
          </TouchableOpacity>
        </View>

        {/* Modules by category */}
        {moduleCategories.map(([categorie, modules]) => (
          <View key={categorie} style={styles.categoryBlock}>
            <Text style={styles.categoryTitle}>{categorie}</Text>
            <View style={styles.moduleGrid}>
              {modules.map((m: any) => {
                const checked = assignedIds.has(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.moduleChip,
                      checked && styles.moduleChipActive,
                    ]}
                    onPress={() => toggleModule(m.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.moduleChipLeft}>
                      <Text style={styles.moduleIcon}>{m.icon || '📌'}</Text>
                      <Text
                        style={[
                          styles.moduleName,
                          checked && styles.moduleNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {m.nom}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                      {checked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Save button */}
      {hasChanges && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => {
              setAssignedIds(new Set(originalIds));
              setHasChanges(false);
            }}
          >
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.textWhite} />
            ) : (
              <Text style={styles.saveText}>
                💾 Enregistrer ({assignedCount} modules)
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: 12, color: Colors.textLight, fontSize: 15 },
  // Summary bar
  summaryBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  summaryLeft: {},
  restoName: { fontSize: 18, fontWeight: '700', color: Colors.text },
  summaryText: { fontSize: 13, color: Colors.textLight, marginTop: 2 },
  changeBadge: {
    backgroundColor: Colors.warning + '20', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.warning + '40',
  },
  changeBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.warning },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  // Quick actions
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary + '10', borderRadius: 14,
    paddingVertical: 12, gap: 6, borderWidth: 1, borderColor: Colors.primary + '30',
  },
  quickBtnOutline: { backgroundColor: Colors.surface, borderColor: Colors.border },
  quickBtnIcon: { fontSize: 16 },
  quickBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  quickBtnOutlineText: { color: Colors.textLight },
  // Categories
  categoryBlock: { marginBottom: 20 },
  categoryTitle: {
    fontSize: 14, fontWeight: '700', color: Colors.secondary,
    marginBottom: 10, paddingLeft: 4, textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Module grid
  moduleGrid: { gap: 8 },
  moduleChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  moduleChipActive: {
    backgroundColor: Colors.primary + '08',
    borderColor: Colors.primary + '40',
  },
  moduleChipLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  moduleIcon: { fontSize: 20 },
  moduleName: { fontSize: 15, fontWeight: '600', color: Colors.text, flex: 1 },
  moduleNameActive: { color: Colors.primary },
  // Checkbox
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 8,
  },
  checkboxActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  checkmark: { color: Colors.textWhite, fontSize: 14, fontWeight: '800', marginTop: -1 },
  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface, paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
    flexDirection: 'row', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 10,
  },
  cancelBtn: {
    flex: 1, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: { color: Colors.textLight, fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 2, borderRadius: 14, paddingVertical: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
});
