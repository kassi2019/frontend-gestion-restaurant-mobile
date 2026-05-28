import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ToastConfigParams } from 'react-native-toast-message';
import { Colors } from '../theme/colors';

const shadow3D = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.25,
  shadowRadius: 16,
  elevation: 12,
};

export const toastConfig = {
  success: ({ text1, text2 }: ToastConfigParams<any>) => (
    <View style={[styles.container, styles.successBorder, shadow3D]}>
      <View style={styles.iconBox}>
        <Text style={styles.icon}>✅</Text>
      </View>
      <View style={styles.textBox}>
        <Text style={styles.title}>{text1 || 'Succès'}</Text>
        {text2 ? <Text style={styles.subtitle}>{text2}</Text> : null}
      </View>
    </View>
  ),

  error: ({ text1, text2 }: ToastConfigParams<any>) => (
    <View style={[styles.container, styles.errorBorder, shadow3D]}>
      <View style={[styles.iconBox, { backgroundColor: '#F4433625' }]}>
        <Text style={styles.icon}>❌</Text>
      </View>
      <View style={styles.textBox}>
        <Text style={styles.title}>{text1 || 'Erreur'}</Text>
        {text2 ? <Text style={styles.subtitle}>{text2}</Text> : null}
      </View>
    </View>
  ),

  info: ({ text1, text2 }: ToastConfigParams<any>) => (
    <View style={[styles.container, styles.infoBorder, shadow3D]}>
      <View style={[styles.iconBox, { backgroundColor: '#FF980025' }]}>
        <Text style={styles.icon}>🔔</Text>
      </View>
      <View style={styles.textBox}>
        <Text style={styles.title}>{text1 || 'Attention'}</Text>
        {text2 ? <Text style={styles.subtitle}>{text2}</Text> : null}
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    width: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
    borderLeftWidth: 5,
  },
  successBorder: { borderLeftColor: '#4CAF50' },
  errorBorder: { borderLeftColor: '#F44336' },
  infoBorder: { borderLeftColor: '#FF9800' },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#4CAF5025',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 20 },
  textBox: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '500',
  },
});
