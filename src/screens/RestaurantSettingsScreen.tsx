import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { updateUser } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import { restaurantApi } from '../services/api';
import { showToast } from '../services/toast';

export default function RestaurantSettingsScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();

  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [devise, setDevise] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.restaurantId) {
      restaurantApi.getInfo(user.restaurantId).then(({ data }) => {
        setNom(data.nom || '');
        setAdresse(data.adresse || '');
        setTelephone(data.telephone || '');
        setDevise(data.devise || '€');
      }).catch(() => showToast.error('Impossible de charger les infos du restaurant'));
    }
  }, [user?.restaurantId]);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Informations du restaurant</Text>

        <Text style={styles.label}>Nom</Text>
        <TextInput
          style={styles.input}
          value={nom}
          onChangeText={setNom}
          placeholder="Nom du restaurant"
          placeholderTextColor={Colors.textLight}
        />

        <Text style={styles.label}>Adresse</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={adresse}
          onChangeText={setAdresse}
          placeholder="Adresse"
          placeholderTextColor={Colors.textLight}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Téléphone</Text>
        <TextInput
          style={styles.input}
          value={telephone}
          onChangeText={setTelephone}
          placeholder="Ex: +243990000000"
          placeholderTextColor={Colors.textLight}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Devise</Text>
        <TextInput
          style={styles.input}
          value={devise}
          onChangeText={setDevise}
          placeholder="Ex: €, FC, $"
          placeholderTextColor={Colors.textLight}
          maxLength={10}
        />

        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textWhite} />
          ) : (
            <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textarea: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
});
