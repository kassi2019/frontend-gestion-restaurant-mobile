import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { RootState, AppDispatch } from '../store';
import { updateUser } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import { authApi } from '../services/api';
import { showToast } from '../services/toast';
import PasswordInput from '../components/PasswordInput';

const API_URL = 'http://192.168.1.7:3000';

export default function ProfileScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const [photo, setPhoto] = useState<string | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [loadingPwd, setLoadingPwd] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission refusée', 'Autorisez l\'accès à la galerie dans les paramètres.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleUpdatePhoto = async () => {
    if (!photo) return;
    setLoadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('image', { uri: photo, type: 'image/jpeg', name: 'profile.jpg' } as any);
      const res = await authApi.uploadPhoto(formData);
      showToast.success('Photo de profil mise à jour');
      dispatch(updateUser({ photo: res.data?.photo }));
      setPhoto(null);
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      return Alert.alert('Erreur', 'Remplissez tous les champs');
    }
    if (newPassword.length < 4) {
      return Alert.alert('Erreur', 'Le mot de passe doit avoir au moins 4 caractères');
    }
    setLoadingPwd(true);
    try {
      await authApi.changePassword({ oldPassword, newPassword });
      showToast.success('Mot de passe modifié avec succès');
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Erreur lors du changement');
    } finally {
      setLoadingPwd(false);
    }
  };

  const avatarUri = user?.photo
    ? (user.photo.startsWith('http') ? user.photo : API_URL + user.photo)
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{user?.nom?.charAt(0)?.toUpperCase() || '?'}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
          <Text style={styles.photoBtnText}>📷 Choisir une photo</Text>
        </TouchableOpacity>
        {photo && (
          <TouchableOpacity style={styles.savePhotoBtn} onPress={handleUpdatePhoto} disabled={loadingPhoto}>
            {loadingPhoto ? <ActivityIndicator color={Colors.textWhite} /> : <Text style={styles.savePhotoText}>Enregistrer la photo</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nom</Text>
          <Text style={styles.infoValue}>{user?.nom}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Téléphone</Text>
          <Text style={styles.infoValue}>{user?.telephone}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Rôle</Text>
          <Text style={styles.infoValue}>{user?.role}</Text>
        </View>
      </View>

      {/* Restaurant Settings (Admin only) */}
      {user?.role === 'ADMIN' && (
        <TouchableOpacity
          style={styles.restaurantBtn}
          onPress={() => navigation.navigate('RestaurantSettings')}
        >
          <Text style={styles.restaurantBtnText}>🏪 Paramètres du restaurant</Text>
          <Text style={styles.restaurantBtnArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Change Password */}
      <View style={styles.pwdCard}>
        <Text style={styles.sectionTitle}>Changer le mot de passe</Text>
        <PasswordInput value={oldPassword} onChangeText={setOldPassword} placeholder="Ancien mot de passe" />
        <PasswordInput value={newPassword} onChangeText={setNewPassword} placeholder="Nouveau mot de passe" />
        <TouchableOpacity style={[styles.pwdBtn, loadingPwd && { opacity: 0.6 }]} onPress={handleChangePassword} disabled={loadingPwd}>
          {loadingPwd ? <ActivityIndicator color={Colors.textWhite} /> : <Text style={styles.pwdBtnText}>Modifier le mot de passe</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 40, fontWeight: '700', color: Colors.primary },
  photoBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.primary },
  photoBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  savePhotoBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.primary },
  savePhotoText: { color: Colors.textWhite, fontWeight: '700', fontSize: 14 },
  infoCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 14, color: Colors.textLight },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  restaurantBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restaurantBtnText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  restaurantBtnArrow: { fontSize: 24, color: Colors.textLight },
  pwdCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  input: { backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  pwdBtn: { backgroundColor: Colors.primary, borderRadius: 14, height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  pwdBtnText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
});
