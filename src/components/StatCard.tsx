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
    borderRadius: 16,
    padding: 16,
    margin: 6,
    flex: 1,
    minWidth: 150,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  icon: {
    fontSize: 20,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '500',
  },
});
