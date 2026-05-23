import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
  visible: boolean;
  title: string;
  options: { label: string; value: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export default function ModalPicker({ visible, title, options, selectedValue, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.option, item.value === selectedValue && styles.optionSelected]}
                onPress={() => onSelect(item.value)}
              >
                <Text style={[styles.optionText, item.value === selectedValue && styles.optionTextSelected]}>
                  {item.label}
                </Text>
                {item.value === selectedValue && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    maxHeight: height * 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  optionSelected: {
    backgroundColor: Colors.primary + '12',
  },
  optionText: {
    fontSize: 15,
    color: Colors.text,
  },
  optionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  check: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  closeText: {
    color: Colors.textLight,
    fontWeight: '600',
    fontSize: 15,
  },
});
