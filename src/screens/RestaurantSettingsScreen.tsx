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
  Modal,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { updateUser } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import { restaurantApi, paiementApi, authApi, zonesApi, tablesApi } from '../services/api';
import { showToast } from '../services/toast';
import CalendarPicker, { toDateStr, formatDisplay } from '../components/CalendarPicker';

const MENUS = [
  { key: 'infos',   icon: '🏪', label: 'Info du restaurant' },
  { key: 'zones',   icon: '🏷️', label: 'Zones tarifaires' },
  { key: 'abonnement', icon: '⭐', label: 'Abonnement' },
  { key: 'cloture', icon: '🔒', label: 'Clôture Globale' },
];

export default function RestaurantSettingsScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const isAdmin = user?.role === 'ADMIN';

  // Menu actif
  const [activeMenu, setActiveMenu] = useState('infos');

  // Infos restaurant
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [devise, setDevise] = useState('');
  const [modeGestion, setModeGestion] = useState('RECEPTION');
  const [loading, setLoading] = useState(false);

  // Clôture globale
  const [statutResto, setStatutResto] = useState<string>('OUVERT');
  const [dateReouverture, setDateReouverture] = useState(toDateStr(new Date()));
  const [heureReouverture, setHeureReouverture] = useState('08:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [clotureLoading, setClotureLoading] = useState(false);

  // Abonnement
  const [aboLoading, setAboLoading] = useState(false);
  const [aboStatus, setAboStatus] = useState<any>(null);
  const [aboCode, setAboCode] = useState('');
  const [aboActivationLoading, setAboActivationLoading] = useState(false);

  // Zones
  const [zones, setZones] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [zoneForm, setZoneForm] = useState({ nom: '', coefficient: '1.0' });

  useEffect(() => {
    if (user?.restaurantId) {
      restaurantApi.getInfo(user.restaurantId).then(({ data }) => {
        setNom(data.nom || '');
        setAdresse(data.adresse || '');
        setTelephone(data.telephone || '');
        setDevise(data.devise || '');
        setModeGestion(data.modeGestion || 'RECEPTION');
        setStatutResto(data.statut || 'OUVERT');
        if (data.dateReouverture) {
          const d = new Date(data.dateReouverture);
          setDateReouverture(toDateStr(d));
          setHeureReouverture(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
        }
      }).catch(() => showToast.error('Impossible de charger les infos du restaurant'));
    }
  }, [user?.restaurantId]);

  // Charger le statut d'abonnement quand le menu abonnement est actif
  useEffect(() => {
    if (activeMenu === 'zones') {
      zonesApi.getAll().then(r => setZones(r.data || [])).catch(() => {});
      tablesApi.getAll().then(r => setTables(r.data || [])).catch(() => {});
    }
    if (activeMenu === 'abonnement') {
      setAboLoading(true);
      authApi.getAbonnement()
        .then(({ data }) => setAboStatus(data))
        .catch(() => showToast.error('Impossible de charger le statut d\'abonnement'))
        .finally(() => setAboLoading(false));
    }
  }, [activeMenu]);

  const handleActiverAbonnement = async () => {
    if (!aboCode.trim()) {
      showToast.error('Veuillez entrer un code d\'activation');
      return;
    }
    setAboActivationLoading(true);
    try {
      const { data } = await authApi.activerCode({ telephone: user!.telephone, code: aboCode.trim() });
      showToast.success(data.message || 'Abonnement activé !');
      setAboCode('');
      // Recharger le statut
      const { data: statusData } = await authApi.getAbonnement();
      setAboStatus(statusData);
      // Mettre à jour le user dans le store
      dispatch(updateUser({
        typeAbonnement: statusData.typeAbonnement,
        dateFinAbonnement: statusData.dateFinAbonnement,
      }));
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Code invalide');
    } finally {
      setAboActivationLoading(false);
    }
  };

  const handleSave = async () => {
    if (!nom.trim() || !adresse.trim()) {
      showToast.error('Le nom et l\'adresse sont requis');
      return;
    }
    if (!user?.restaurantId) return;
    setLoading(true);
    try {
      const { data } = await restaurantApi.update(user.restaurantId, {
        nom: nom.trim(),
        adresse: adresse.trim(),
        telephone: telephone.trim(),
        devise: devise.trim(),
        modeGestion,
      });
      dispatch(updateUser({
        restaurantNom: data.nom,
        devise: data.devise,
        restaurantTelephone: data.telephone,
      }));
      showToast.success('Restaurant mis à jour');
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleClotureGlobale = () => {
    if (!dateReouverture || !heureReouverture) {
      showToast.error('Veuillez saisir une date et heure de réouverture');
      return;
    }
    const dateReouv = `${dateReouverture}T${heureReouverture}:00`;
    // Vérifier que la date est valide
    if (isNaN(new Date(dateReouv).getTime())) {
      showToast.error('Date de réouverture invalide');
      return;
    }
    Alert.alert(
      'Fermer le restaurant',
      `Le restaurant sera fermé jusqu'au ${formatDisplay(dateReouverture)} à ${heureReouverture}.\n\nLes clients ne pourront plus commander.\n\nConfirmer ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Fermer le restaurant',
          style: 'destructive',
          onPress: async () => {
            setClotureLoading(true);
            try {
              await paiementApi.cloturerCaisseGlobale(dateReouv);
              setStatutResto('FERME');
              showToast.success('Restaurant fermé. Réouverture le ' + formatDisplay(dateReouverture) + ' à ' + heureReouverture);
            } catch (err: any) {
              showToast.error(err.response?.data?.message || 'Erreur lors de la fermeture');
            } finally {
              setClotureLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveZone = async () => {
    if (!zoneForm.nom) { showToast.error('Nom requis'); return; }
    const c = parseFloat(zoneForm.coefficient) || 1.0;
    try {
      if (editingZone) { await zonesApi.update(editingZone.id, { nom: zoneForm.nom, coefficient: c }); showToast.success('Zone modifiée'); }
      else { await zonesApi.create({ nom: zoneForm.nom, coefficient: c }); showToast.success('Zone créée'); }
      setShowZoneForm(false); zonesApi.getAll().then(r => setZones(r.data || [])).catch(() => {});
    } catch { showToast.error('Erreur'); }
  };

  const handleReouverture = () => {
    Alert.alert(
      'Réouvrir le restaurant',
      'Le restaurant sera réouvert immédiatement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réouvrir',
          onPress: async () => {
            try {
              await restaurantApi.update(user!.restaurantId, { statut: 'OUVERT' } as any);
              setStatutResto('OUVERT');
              showToast.success('Restaurant réouvert');
            } catch (err: any) {
              showToast.error('Erreur lors de la réouverture');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Menu latéral ou en haut */}
      <View style={styles.menuBar}>
        {MENUS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.menuItem, activeMenu === m.key && styles.menuItemActive]}
            onPress={() => setActiveMenu(m.key)}
          >
            <Text style={styles.menuIcon}>{m.icon}</Text>
            <Text style={[styles.menuLabel, activeMenu === m.key && styles.menuLabelActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenu du menu actif */}
      <ScrollView style={styles.content}>
        {/* ========== INFORMATIONS RESTAURANT ========== */}
        {activeMenu === 'infos' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🏪 Informations du restaurant</Text>

            <Text style={styles.label}>Nom</Text>
            <TextInput style={styles.input} value={nom} onChangeText={setNom} placeholder="Nom du restaurant" placeholderTextColor={Colors.textLight} />

            <Text style={styles.label}>Adresse</Text>
            <TextInput style={[styles.input, styles.textarea]} value={adresse} onChangeText={setAdresse} placeholder="Adresse" placeholderTextColor={Colors.textLight} multiline numberOfLines={3} />

            <Text style={styles.label}>Téléphone</Text>
            <TextInput style={styles.input} value={telephone} onChangeText={setTelephone} placeholder="Ex: +243990000000" placeholderTextColor={Colors.textLight} keyboardType="phone-pad" />

            <Text style={styles.label}>Devise (€, Fcfa, $)</Text>
            <TextInput style={styles.input} value={devise} onChangeText={setDevise} placeholder="Ex: €, FC, $" placeholderTextColor={Colors.textLight} maxLength={10} />

            <Text style={styles.label}>Mode de gestion des commandes</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TouchableOpacity
                style={[styles.modeBtn, modeGestion === 'RECEPTION' && styles.modeBtnActive]}
                onPress={() => setModeGestion('RECEPTION')}
              >
                <Text style={[styles.modeBtnText, modeGestion === 'RECEPTION' && styles.modeBtnTextActive]}>📋 Centralisé</Text>
                <Text style={styles.modeBtnDesc}>La réception valide les commandes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, modeGestion === 'SERVEUR' && styles.modeBtnActive]}
                onPress={() => setModeGestion('SERVEUR')}
              >
                <Text style={[styles.modeBtnText, modeGestion === 'SERVEUR' && styles.modeBtnTextActive]}>👤 Serveur</Text>
                <Text style={styles.modeBtnDesc}>Les serveurs valident leurs commandes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, modeGestion === 'CAISSE' && styles.modeBtnActive]}
                onPress={() => setModeGestion('CAISSE')}
              >
                <Text style={[styles.modeBtnText, modeGestion === 'CAISSE' && styles.modeBtnTextActive]}>🏪 Caisse</Text>
                <Text style={styles.modeBtnDesc}>Saisie et encaissement direct</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.textWhite} /> : <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ========== ZONES ========== */}
        {activeMenu === 'zones' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🏷️ Zones tarifaires</Text>
            {zones.map(zone => (
              <View key={zone.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: Colors.text }}>{zone.nom}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textLight }}>x{Number(zone.coefficient).toFixed(1)} · {zone.tables?.length || 0} table(s)</Text>
                </View>
                <TouchableOpacity onPress={() => { setEditingZone(zone); setZoneForm({ nom: zone.nom, coefficient: String(zone.coefficient) }); setShowZoneForm(true); }}
                  style={{ padding: 6 }}><Text>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { Alert.alert('Supprimer ?', '', [{ text: 'Annuler' }, { text: 'Supprimer', style: 'destructive', onPress: async () => { await zonesApi.delete(zone.id); zonesApi.getAll().then(r => setZones(r.data || [])).catch(() => {}); } }]); }}
                  style={{ padding: 6 }}><Text>🗑</Text></TouchableOpacity>
              </View>
            ))}
            {zones.length === 0 && <Text style={{ color: Colors.textLight, fontSize: 13, textAlign: 'center', padding: 20 }}>Aucune zone. Créez des zones (VIP, VVIP...).</Text>}
            <TouchableOpacity style={[styles.saveBtn, { marginTop: 16 }]} onPress={() => { setEditingZone(null); setZoneForm({ nom: '', coefficient: '1.0' }); setShowZoneForm(true); }}>
              <Text style={styles.saveBtnText}>+ Ajouter une zone</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ========== ABONNEMENT ========== */}
        {activeMenu === 'abonnement' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>⭐ Abonnement</Text>

            {!isAdmin ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>🔐 Réservé à l'administrateur</Text>
              </View>
            ) : aboLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
            ) : aboStatus ? (
              <>
                {/* Statut */}
                <View style={[styles.statusBadge, { backgroundColor: aboStatus.estActif ? Colors.success + '15' : Colors.danger + '15' }]}>
                  <Text style={[styles.statusText, { color: aboStatus.estActif ? Colors.success : Colors.danger }]}>
                    {aboStatus.estActif ? '✅ Abonnement ACTIF' : '❌ Abonnement EXPIRÉ'}
                  </Text>
                </View>

                <View style={styles.aboInfoRow}>
                  <Text style={styles.aboLabel}>Type</Text>
                  <Text style={styles.aboValue}>
                    {aboStatus.typeAbonnement === 'TRIAL' ? '🆓 Période d\'essai' :
                     aboStatus.typeAbonnement === 'MENSUEL' ? '📅 Mensuel' :
                     aboStatus.typeAbonnement === 'ANNUEL' ? '📆 Annuel' : aboStatus.typeAbonnement}
                  </Text>
                </View>

                <View style={styles.aboInfoRow}>
                  <Text style={styles.aboLabel}>Expire le</Text>
                  <Text style={styles.aboValue}>
                    {aboStatus.dateFinAbonnement
                      ? new Date(aboStatus.dateFinAbonnement).toLocaleDateString('fr-FR')
                      : '—'}
                  </Text>
                </View>

                <View style={styles.aboInfoRow}>
                  <Text style={styles.aboLabel}>Jours restants</Text>
                  <Text style={[styles.aboValue, { color: aboStatus.joursRestants <= 7 ? Colors.danger : Colors.success, fontWeight: '800' }]}>
                    {aboStatus.joursRestants} jour(s)
                  </Text>
                </View>

                {/* Saisie code */}
                <View style={styles.aboActivation}>
                  <Text style={styles.aboActivationTitle}>🔑 Activer un code</Text>
                  <TextInput
                    style={styles.input}
                    value={aboCode}
                    onChangeText={setAboCode}
                    placeholder="RESTO-XXXX-XXXX"
                    placeholderTextColor={Colors.textLight}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[styles.saveBtn, aboActivationLoading && { opacity: 0.6 }]}
                    onPress={handleActiverAbonnement}
                    disabled={aboActivationLoading}
                  >
                    {aboActivationLoading ? (
                      <ActivityIndicator color={Colors.textWhite} />
                    ) : (
                      <Text style={styles.saveBtnText}>Activer l'abonnement</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        )}

        {/* ========== CLÔTURE GLOBALE ========== */}
        {activeMenu === 'cloture' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🔒 Clôture Globale</Text>

            {!isAdmin ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>🔐 Réservé à l'administrateur</Text>
              </View>
            ) : (
              <>
                <View style={[styles.statusBadge, { backgroundColor: statutResto === 'FERME' ? Colors.danger + '15' : Colors.success + '15' }]}>
                  <Text style={[styles.statusText, { color: statutResto === 'FERME' ? Colors.danger : Colors.success }]}>
                    {statutResto === 'FERME' ? '🔴 Restaurant FERMÉ' : '🟢 Restaurant OUVERT'}
                  </Text>
                </View>

                {statutResto === 'FERME' ? (
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.success }]} onPress={handleReouverture}>
                    <Text style={styles.saveBtnText}>🟢 Réouvrir le restaurant maintenant</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <Text style={styles.infoBoxText}>
                      La clôture globale ferme le restaurant. Plus aucune commande ne pourra être passée jusqu'à la date de réouverture.
                    </Text>

                    <Text style={styles.label}>Date de réouverture</Text>
                    <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                      <Text style={styles.dateBtnText}>📅 {formatDisplay(dateReouverture)}</Text>
                    </TouchableOpacity>

                    <Text style={styles.label}>Heure de réouverture</Text>
                    <TextInput
                      style={styles.input}
                      value={heureReouverture}
                      onChangeText={setHeureReouverture}
                      placeholder="08:00"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="numbers-and-punctuation"
                    />

                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: Colors.danger }, clotureLoading && { opacity: 0.6 }]}
                      onPress={handleClotureGlobale}
                      disabled={clotureLoading}
                    >
                      {clotureLoading ? (
                        <ActivityIndicator color={Colors.textWhite} />
                      ) : (
                        <Text style={styles.saveBtnText}>🔒 Fermer le restaurant</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <CalendarPicker visible={showDatePicker} value={dateReouverture} onSelect={(d) => { setDateReouverture(d); setShowDatePicker(false); }} onClose={() => setShowDatePicker(false)} />

      {/* Modal Zone */}
      <Modal visible={showZoneForm} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 }}>{editingZone ? 'Modifier' : 'Nouvelle'} zone</Text>
            <TextInput style={{ height: 46, backgroundColor: Colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, marginBottom: 10, fontSize: 14, color: Colors.text }} placeholder="Nom (ex: VIP)" value={zoneForm.nom} onChangeText={t => setZoneForm({...zoneForm, nom: t})} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 }}>Coefficient</Text>
            <TextInput style={{ height: 46, backgroundColor: Colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, marginBottom: 10, fontSize: 14, color: Colors.text }} placeholder="1.0" keyboardType="numeric" value={zoneForm.coefficient} onChangeText={t => setZoneForm({...zoneForm, coefficient: t})} />
            <Text style={{ fontSize: 12, color: Colors.textLight, marginBottom: 16 }}>1.0 = prix normal · 1.2 = +20% · 1.5 = +50%</Text>
            <TouchableOpacity style={{ backgroundColor: Colors.primary, borderRadius: 14, padding: 14, alignItems: 'center' }} onPress={handleSaveZone}>
              <Text style={{ color: Colors.textWhite, fontWeight: '800', fontSize: 15 }}>Enregistrer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center', marginTop: 6 }} onPress={() => setShowZoneForm(false)}>
              <Text style={{ color: Colors.textLight, fontSize: 14 }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  // Menu bar
  menuBar: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 8,
  },
  menuItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 14,
    backgroundColor: Colors.inputBg, gap: 6,
  },
  menuItemActive: { backgroundColor: Colors.primary },
  menuIcon: { fontSize: 16 },
  menuLabel: { fontSize: 12, fontWeight: '600', color: Colors.textLight },
  menuLabelActive: { color: Colors.textWhite },
  // Content
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46,
    fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  textarea: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, height: 48,
    justifyContent: 'center', alignItems: 'center', marginTop: 24,
  },
  saveBtnText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
  // Clôture
  statusBadge: { borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
  statusText: { fontSize: 16, fontWeight: '800' },
  dateBtn: {
    backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46,
    justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  dateBtnText: { fontSize: 15, color: Colors.text, fontWeight: '600' },
  infoBox: {
    backgroundColor: Colors.warning + '15', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: Colors.warning + '30', marginBottom: 16,
  },
  infoBoxText: {
    fontSize: 13, color: Colors.textLight, lineHeight: 18, marginBottom: 16,
    backgroundColor: Colors.inputBg, borderRadius: 10, padding: 12,
  },
  infoText: { fontSize: 14, color: Colors.warning, fontWeight: '600', textAlign: 'center' },
  // Abonnement
  aboInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  aboLabel: { fontSize: 14, color: Colors.textLight, fontWeight: '500' },
  aboValue: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  aboActivation: {
    marginTop: 20, paddingTop: 16,
    borderTopWidth: 2, borderTopColor: Colors.primary + '30',
  },
  aboActivationTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  modeBtn: {
    flex: 1, backgroundColor: Colors.inputBg, borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', minWidth: 100,
  },
  modeBtnActive: { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 3, textAlign: 'center' },
  modeBtnTextActive: { color: Colors.primary },
  modeBtnDesc: { fontSize: 9, color: Colors.textLight, textAlign: 'center' },
});
