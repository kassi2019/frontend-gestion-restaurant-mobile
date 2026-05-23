import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface Column {
  key: string;
  title: string;
  flex?: number;
  render?: (item: any) => React.ReactNode;
}

interface Props {
  columns: Column[];
  data: any[];
  emptyText?: string;
}

export default function DataTable({ columns, data, emptyText = 'Aucune donnée' }: Props) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {columns.map((col) => (
          <Text
            key={col.key}
            style={[styles.headerCell, { flex: col.flex || 1 }]}
          >
            {col.title}
          </Text>
        ))}
      </View>

      {/* Rows */}
      <FlatList
        data={data}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={({ item, index }) => (
          <View style={[styles.row, index % 2 === 0 && styles.rowEven]}>
            {columns.map((col) => (
              <View key={col.key} style={[styles.cell, { flex: col.flex || 1 }]}>
                {col.render ? col.render(item) : (
                  <Text style={styles.cellText}>{item[col.key]}</Text>
                )}
              </View>
            ))}
          </View>
        )}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    backgroundColor: Colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  headerCell: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowEven: {
    backgroundColor: Colors.inputBg,
  },
  cell: {
    justifyContent: 'center',
  },
  cellText: {
    color: Colors.text,
    fontSize: 13,
  },
  empty: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    color: Colors.textLight,
    fontSize: 15,
  },
});
