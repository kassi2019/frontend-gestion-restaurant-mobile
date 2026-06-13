import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { authApi } from '../services/api';
import { showToast } from '../services/toast';
import PasswordInput from '../components/PasswordInput';

const TYPE_OPTIONS = [
  { label: 'Essai gratuit', value: 'TRIAL' },
  { label: 'Mensuel', value: 'MENSUEL' },
  { label: 'Trimestriel', value: 'TRIMESTRIEL' },
  { label: 'Annuel', value: 'ANNUEL' },
];

const DUREE_PRESETS = [
  { label: '30 j', value: '30' },
  { label: '90 j', value: '90' },
  { label: '1 an', value: '365' },
  { label: '2 ans', value: '730' },
];

export default function CreerRestaurantScreen() {
  const navigation = useNavigation<any>();
  const user = useSelector((s: RootState) => s.auth.user);

  // ── Restaurant ──
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [devise, setDevise] = useState('€');
  const [typeAbonnement, setTypeAbonnement] = useState('TRIAL');
  const [dureeJours, setDureeJours] = useState('30');

  // ── Admin ──
  const [adminNom, setAdminNom] = useState('');
  const [adminTelephone, setAdminTelephone] = useState('');
  const [adminMotDePasse, setAdminMotDePasse] = useState('');

  // ── Modules ──
  const [modules, setModules] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingModules, setLoadingModules] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') {
      navigation.goBack();
      return;
    }
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      const { data } = await authApi.getModules();
      const all = data || [];
      setModules(all);
      // Tout sélectionner par défaut
      setSelectedIds(new Set(all.map((m: any) => m.id)));
    } catch {
      showToast.error('Impossible de charger les modules');
    } finally {
      setLoadingModules(false);
    }
  };

  const toggleModule = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(modules.map(m => m.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleSubmit = async () => {
    // Validation
    if (!nom.trim()) return Alert.alert('Champ requis', 'Le nom du restaurant est obligatoire');
    if (!adresse.trim()) return Alert.alert('Champ requis', 'L\'adresse est obligatoire');
    if (!adminNom.trim()) return Alert.alert('Champ requis', 'Le nom de l\'admin est obligatoire');
    if (!adminTelephone.trim()) return Alert.alert('Champ requis', 'Le téléphone de l\'admin est obligatoire');
    if (!adminMotDePasse.trim()) return Alert.alert('Champ requis', 'Le mot de passe admin est obligatoire');
    if (adminMotDePasse.length < 4) return Alert.alert('Mot de passe', 'Minimum 4 caractères');
    if (selectedIds.size === 0) return Alert.alert('Modules', 'Sélectionnez au moins un module');

    setSaving(true);
    try {
      const { data } = await authApi.creerRestaurant({
        nom: nom.trim(),
        adresse: adresse.trim(),
        telephone: telephone.trim() || undefined,
        devise: devise.trim() || '€',
        typeAbonnement,
        dureeJours: parseInt(dureeJours),
        adminNom: adminNom.trim(),
        adminTelephone: adminTelephone.trim(),
        adminMotDePasse: adminMotDePasse,
        moduleIds: Array.from(selectedIds),
      });

      Alert.alert(
        '✅ Restaurant créé !',
        `Restaurant "${data.restaurant.nom}" créé.\n\nAdmin: ${data.admin.nom}\nTél: ${data.admin.telephone}\n\nL'admin peut maintenant se connecter.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erreur lors de la création';
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  // Grouper les modules par catégorie
  const moduleCategories = React.useMemo(() => {
    const cats: Record<string, any[]> = {};
    modules.forEach((m: any) => {
      const cat = m.categorie || 'Général';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(m);
    });
    return Object.entries(cats).sort(([a], [b]) => {
      if (a === 'Général') return 1;
      if (b === 'Général') return -1;
      return a.localeCompare(b);
    });
  }, [modules]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── SECTION RESTAURANT ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🏪 Informations du restaurant</Text>

        <Text style={styles.label}>Nom *</Text>
        <TextInput
          style={styles.input}
          value={nom}
          onChangeText={setNom}
          placeholder="Ex: Chez Pedro"
          placeholderTextColor={Colors.textLight}
        />

        <Text style={styles.label}>Adresse *</Text>
        <TextInput
          style={styles.input}
          value={adresse}
          onChangeText={setAdresse}
          placeholder="Ex: 123 Avenue Kinshasa"
          placeholderTextColor={Colors.textLight}
          multiline
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={styles.input}
              value={telephone}
              onChangeText={setTelephone}
              placeholder="+243..."
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Devise</Text>
            <TextInput
              style={styles.input}
              value={devise}
              onChangeText={setDevise}
              placeholder="€"
              placeholderTextColor={Colors.textLight}
            />
          </View>
        </View>
      </View>

      {/* ── SECTION ABONNEMENT ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📅 Abonnement</Text>

        <Text style={styles.label}>Type</Text>
        <View style={styles.chipRow}>
          {TYPE_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[styles.chip, typeAbonnement === o.value && styles.chipActive]}
              onPress={() => setTypeAbonnement(o.value)}
            >
              <Text style={[styles.chipText, typeAbonnement === o.value && styles.chipTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Durée (jours)</Text>
        <View style={styles.chipRow}>
          {DUREE_PRESETS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[styles.chip, dureeJours === p.value && styles.chipActive]}
              onPress={() => setDureeJours(p.value)}
            >
              <Text style={[styles.chipText, dureeJours === p.value && styles.chipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={dureeJours}
          onChangeText={setDureeJours}
          keyboardType="numeric"
          placeholder="Nombre de jours personnalisé"
          placeholderTextColor={Colors.textLight}
        />
      </View>

      {/* ── SECTION ADMIN ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>👤 Administrateur du restaurant</Text>

        <Text style={styles.label}>Nom complet *</Text>
        <TextInput
          style={styles.input}
          value={adminNom}
          onChangeText={setAdminNom}
          placeholder="Ex: Pedro Kalala"
          placeholderTextColor={Colors.textLight}
        />

        <Text style={styles.label}>Téléphone *</Text>
        <TextInput
          style={styles.input}
          value={adminTelephone}
          onChangeText={setAdminTelephone}
          placeholder="+243 81 00 00 00"
          placeholderTextColor={Colors.textLight}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Mot de passe *</Text>
        <PasswordInput
          value={adminMotDePasse}
          onChangeText={setAdminMotDePasse}
          placeholder="Minimum 4 caractères"
        />
      </View>

      {/* ── SECTION MODULES ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🧩 Modules attribués</Text>

        {loadingModules ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          <>
            {/* Actions rapides */}
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickBtn} onPress={selectAll}>
                <Text style={styles.quickBtnText}>✅ Tout sélectionner</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.quickBtn, styles.quickBtnOutline]} onPress={deselectAll}>
                <Text style={[styles.quickBtnText, styles.quickBtnOutlineText]}>⬜ Tout désélectionner</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.moduleCount}>
              {selectedIds.size}/{modules.length} modules sélectionnés
            </Text>

            {moduleCategories.map(([categorie, mods]) => (
              <View key={categorie} style={styles.categoryBlock}>
                <Text style={styles.categoryTitle}>{categorie}</Text>
                {mods.map((m: any) => {
                  const checked = selectedIds.has(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.moduleChip, checked && styles.moduleChipActive]}
                      onPress={() => toggleModule(m.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.moduleIcon}>{m.icon || '📌'}</Text>
                      <Text style={[styles.moduleName, checked && styles.moduleNameActive]} numberOfLines={1}>
                        {m.nom}
                      </Text>
                      <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                        {checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </View>

      {/* ── BOUTON SUBMIT ── */}
      <TouchableOpacity
        style={[styles.submitBtn, saving && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={Colors.textWhite} />
        ) : (
          <Text style={styles.submitBtnText}>Créer le restaurant</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 16 },

  // Labels & Inputs
  label: { fontSize: 14, fontWeight: '600', color: Colors.secondary, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  // Chips (type abonnement, durée)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textLight },
  chipTextActive: { color: Colors.textWhite },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary + '10', borderRadius: 12,
    paddingVertical: 10, borderWidth: 1, borderColor: Colors.primary + '30',
  },
  quickBtnOutline: { backgroundColor: Colors.surface, borderColor: Colors.border },
  quickBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  quickBtnOutlineText: { color: Colors.textLight },
  moduleCount: { fontSize: 12, color: Colors.textLight, textAlign: 'center', marginBottom: 12 },

  // Module categories
  categoryBlock: { marginBottom: 16 },
  categoryTitle: {
    fontSize: 13, fontWeight: '700', color: Colors.secondary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  moduleChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 6, borderWidth: 1.5, borderColor: Colors.border,
  },
  moduleChipActive: {
    backgroundColor: Colors.primary + '08',
    borderColor: Colors.primary + '40',
  },
  moduleIcon: { fontSize: 18, marginRight: 10 },
  moduleName: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1 },
  moduleNameActive: { color: Colors.primary },

  // Checkbox
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: Colors.textWhite, fontSize: 13, fontWeight: '800' },

  // Submit
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginHorizontal: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnText: { color: Colors.textWhite, fontSize: 15, fontWeight: '700' },
});
