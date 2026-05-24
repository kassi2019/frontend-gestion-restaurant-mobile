import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { Colors } from '../theme/colors';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface CalendarPickerProps {
  visible: boolean;
  value: string;
  onSelect: (dateStr: string) => void;
  onClose: () => void;
}

function toDateStr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const first = new Date(year, month, 1).getDay();
  return first === 0 ? 6 : first - 1;
}

export { toDateStr, formatDisplay };

export default function CalendarPicker({ visible, value, onSelect, onClose }: CalendarPickerProps) {
  const today = new Date();
  const initialDate = value ? new Date(value + 'T00:00:00') : today;
  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth());
  const [selected, setSelected] = useState(value);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = toDateStr(today);

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toDateStr(new Date(year, month, d)));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const handleSelect = (dateStr: string) => {
    setSelected(dateStr);
    onSelect(dateStr);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={prevMonth} style={styles.arrow}>
              <Text style={styles.arrowText}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {MONTHS[month]} {year}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.arrow}>
              <Text style={styles.arrowText}>{'>'}</Text>
            </TouchableOpacity>
          </View>

          {/* Day names */}
          <View style={styles.dayRow}>
            {DAYS.map((d) => (
              <View key={d} style={styles.dayCell}>
                <Text style={styles.dayName}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          {Array.from({ length: cells.length / 7 }, (_, r) => (
            <View key={r} style={styles.dayRow}>
              {cells.slice(r * 7, r * 7 + 7).map((dateStr, i) => {
                if (!dateStr) return <View key={i} style={styles.dayCell} />;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selected;
                const dayNum = parseInt(dateStr.split('-')[2], 10);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.dayCell,
                      styles.dayBtn,
                      isToday && styles.todayCell,
                      isSelected && styles.selectedCell,
                    ]}
                    onPress={() => handleSelect(dateStr)}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        isToday && styles.todayText,
                        isSelected && styles.selectedText,
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Footer */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  dayRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  dayBtn: {
    borderRadius: 20,
  },
  todayCell: {
    backgroundColor: Colors.primary + '18',
  },
  selectedCell: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
  },
  dayNum: {
    fontSize: 15,
    color: Colors.text,
  },
  todayText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  selectedText: {
    color: Colors.textWhite,
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.textLight,
    fontWeight: '600',
    fontSize: 15,
  },
});
