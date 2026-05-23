import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors } from '../theme/colors';

interface Action {
  label: string;
  icon: string;
  onPress: () => void;
  danger?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: Action[];
  onClose: () => void;
}

export default function ActionSheet({ visible, title, subtitle, actions, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.actionBtn, action.danger && styles.actionBtnDanger]}
              onPress={action.onPress}
            >
              <Text style={[styles.actionText, action.danger && styles.actionTextDanger]}>
                {action.icon} {action.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', paddingHorizontal: 30 },
  sheet: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textLight, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  actionBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, backgroundColor: Colors.inputBg, marginBottom: 8 },
  actionBtnDanger: { backgroundColor: Colors.danger + '12' },
  actionText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  actionTextDanger: { color: Colors.danger },
  closeBtn: { marginTop: 8, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  closeText: { color: Colors.textLight, fontWeight: '600', fontSize: 15 },
});
