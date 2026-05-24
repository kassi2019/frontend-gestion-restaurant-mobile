import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface PasswordInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: any;
}

export default function PasswordInput({ value, onChangeText, placeholder, style }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        style={styles.input}
        placeholder={placeholder || 'Mot de passe'}
        placeholderTextColor={Colors.textLight}
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChangeText}
      />
      <TouchableOpacity style={styles.eye} onPress={() => setVisible(!visible)}>
        <Text style={styles.eyeText}>{visible ? '🙈' : '👁'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 46,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: '100%',
  },
  eye: {
    padding: 6,
    marginLeft: 4,
  },
  eyeText: {
    fontSize: 18,
  },
});
