import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
}

export default function StatCard({ title, value, icon, color = Colors.primary }: Props) {
  return (
    <View style={[styles.card, { borderTopColor: color }]}>
      <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 10,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    fontSize: 14,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 1,
  },
  title: {
    fontSize: 9,
    color: Colors.textLight,
    fontWeight: '700',
  },
});
