import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/slices/authSlice';
import { RootState, AppDispatch } from '../store';
import { Colors } from '../theme/colors';
import { authApi } from '../services/api';
import { showToast } from '../services/toast';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = () => {
    if (!telephone.trim() || !password.trim()) return;
    dispatch(login({ telephone: telephone.trim(), mot_de_passe: password }));
  };

  const handleForgotPassword = async () => {
    if (!forgotPhone.trim() || !forgotPassword.trim()) {
      return Alert.alert('Erreur', 'Remplissez tous les champs');
    }
    setForgotLoading(true);
    try {
      await authApi.forgotPassword({ telephone: forgotPhone.trim(), newPassword: forgotPassword });
      setShowForgotModal(false);
      setForgotPhone('');
      setForgotPassword('');
      Alert.alert('Succès', 'Mot de passe réinitialisé. Vous pouvez vous connecter avec votre nouveau mot de passe.');
    } catch (err: any) {
      Alert.alert('Erreur', err.response?.data?.message || 'Réinitialisation échouée');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={Colors.primaryDark} barStyle="light-content" />

      {/* Top decorative wave */}
      <View style={styles.topWave}>
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
        <View style={[styles.circle, styles.circle3]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <Animated.View
          style={[
            styles.card,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Logo / Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>🍽</Text>
            </View>
          </View>

          <Text style={styles.title}>RestoPro</Text>
          <Text style={styles.subtitle}>Gestion Restaurant Intelligente</Text>

          {/* Error message */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => dispatch(clearError())}>
                <Text style={styles.errorClose}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Phone input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Téléphone</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>📱</Text>
              <TextInput
                style={styles.input}
                placeholder="+243 XXX XXX XXX"
                placeholderTextColor={Colors.textLight}
                keyboardType="phone-pad"
                value={telephone}
                onChangeText={setTelephone}
              />
            </View>
          </View>

          {/* Password input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textLight}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          {/* Login button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textWhite} />
            ) : (
              <Text style={styles.buttonText}>Se Connecter</Text>
            )}
          </TouchableOpacity>

          {/* Forgot password */}
          <TouchableOpacity style={styles.forgotBtn} onPress={() => setShowForgotModal(true)}>
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Application sécurisée • Tous droits réservés
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal visible={showForgotModal} transparent animationType="fade">
        <View style={styles.forgotOverlay}>
          <View style={styles.forgotCard}>
            <Text style={styles.forgotTitle}>Réinitialiser le mot de passe</Text>
            <Text style={styles.forgotSubtitle}>Entrez votre numéro et un nouveau mot de passe</Text>
            <TextInput
              style={styles.forgotInput}
              placeholder="Téléphone"
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
              value={forgotPhone}
              onChangeText={setForgotPhone}
            />
            <TextInput
              style={styles.forgotInput}
              placeholder="Nouveau mot de passe"
              placeholderTextColor={Colors.textLight}
              secureTextEntry
              value={forgotPassword}
              onChangeText={setForgotPassword}
            />
            <TouchableOpacity
              style={[styles.forgotSubmit, forgotLoading && { opacity: 0.6 }]}
              onPress={handleForgotPassword}
              disabled={forgotLoading}
            >
              {forgotLoading ? (
                <ActivityIndicator color={Colors.textWhite} />
              ) : (
                <Text style={styles.forgotSubmitText}>Réinitialiser</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.forgotCancel} onPress={() => { setShowForgotModal(false); setForgotPhone(''); setForgotPassword(''); }}>
              <Text style={styles.forgotCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topWave: {
    backgroundColor: Colors.primary,
    height: 220,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
    position: 'relative',
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  circle1: {
    width: 200,
    height: 200,
    top: -60,
    right: -40,
  },
  circle2: {
    width: 150,
    height: 150,
    bottom: -30,
    left: -30,
  },
  circle3: {
    width: 80,
    height: 80,
    top: 40,
    left: width * 0.4,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -40,
  },
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: 24,
    borderRadius: 28,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: '#FDE8E8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: {
    color: Colors.danger,
    flex: 1,
    fontSize: 13,
  },
  errorClose: {
    fontSize: 16,
    color: Colors.danger,
    padding: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 15,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.textWhite,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerText: {
    textAlign: 'center',
    color: Colors.textLight,
    fontSize: 12,
    marginTop: 20,
  },
  forgotBtn: { alignItems: 'center', marginTop: 16 },
  forgotText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  forgotOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  forgotCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 },
  forgotTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 6 },
  forgotSubtitle: { fontSize: 13, color: Colors.textLight, textAlign: 'center', marginBottom: 20 },
  forgotInput: { backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  forgotSubmit: { backgroundColor: Colors.primary, borderRadius: 14, height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  forgotSubmitText: { color: Colors.textWhite, fontWeight: '700', fontSize: 16 },
  forgotCancel: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  forgotCancelText: { color: Colors.textLight, fontSize: 14 },
});
