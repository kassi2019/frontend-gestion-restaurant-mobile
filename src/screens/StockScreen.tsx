import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { menuApi } from '../services/api';
import { showToast } from '../services/toast';

export default function StockScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStock, setEditStock] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('Tous');

  const load = async () => {
    try {
      const { data } = await menuApi.getStocks();
      setMenus(data || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const handleUpdateStock = async (menuId: number) => {
    const stock = parseInt(editStock);
    if (isNaN(stock)) { showToast.error('Quantité invalide'); return; }
    try {
      await menuApi.updateStock(menuId, stock);
      showToast.success(stock === -1 ? 'Stock illimité' : stock === 0 ? 'Stock épuisé' : `Stock: ${stock}`);
      setEditingId(null);
      load();
    } catch { showToast.error('Erreur'); }
  };

  const handleSetUnlimited = async (menuId: number) => {
    try { await menuApi.updateStock(menuId, -1); showToast.success('Stock illimité'); load(); }
    catch { showToast.error('Erreur'); }
  };

  const categories = useMemo(() => {
    const cats = new Set(menus.map(m => m.categorie?.nom).filter(Boolean));
    return ['Tous', ...Array.from(cats)];
  }, [menus]);

  const filtered = useMemo(() => {
    return menus.filter(m => {
      if (selectedCat !== 'Tous' && m.categorie?.nom !== selectedCat) return false;
      if (search && !m.nom.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [menus, selectedCat, search]);

  const getStockColor = (s: number) => {
    if (s === -1) return Colors.textLight;
    if (s === 0) return Colors.danger;
    if (s <= 5) return Colors.warning;
    return Colors.success;
  };

  const getStockLabel = (s: number) => {
    if (s === -1) return 'Illimité';
    if (s === 0) return 'Épuisé';
    return `${s} restant(s)`;
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.locked}>
          <Text style={styles.lockedIcon}>🔐</Text>
          <Text style={styles.lockedText}>Réservé à l'administrateur</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Catégories */}
      <View style={styles.catRow}>
        {categories.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.catChip, selectedCat === item && styles.catChipActive]}
            onPress={() => setSelectedCat(item)}
          >
            <Text style={[styles.catText, selectedCat === item && styles.catTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Rechercher un menu..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textLight}
        />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: Colors.success + '15' }]}>
          <Text style={[styles.statValue, { color: Colors.success }]}>{menus.filter(m => m.stock > 0).length}</Text>
          <Text style={styles.statLabel}>En stock</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.danger + '15' }]}>
          <Text style={[styles.statValue, { color: Colors.danger }]}>{menus.filter(m => m.stock === 0).length}</Text>
          <Text style={styles.statLabel}>Épuisés</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.textLight + '15' }]}>
          <Text style={[styles.statValue, { color: Colors.textLight }]}>{menus.filter(m => m.stock === -1).length}</Text>
          <Text style={styles.statLabel}>Illimités</Text>
        </View>
      </View>

      {/* Liste */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.nom}</Text>
                <Text style={styles.cardCat}>{item.categorie?.nom || '—'}</Text>
                <View style={[styles.stockBadge, { backgroundColor: getStockColor(item.stock) + '15' }]}>
                  <Text style={[styles.stockBadgeText, { color: getStockColor(item.stock) }]}>
                    {getStockLabel(item.stock)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                {editingId === item.id ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.editInput}
                      keyboardType="numeric"
                      value={editStock}
                      onChangeText={setEditStock}
                      placeholder="Qté (-1=∞)"
                      placeholderTextColor={Colors.textLight}
                    />
                    <TouchableOpacity style={styles.editOkBtn} onPress={() => handleUpdateStock(item.id)}>
                      <Text style={styles.editOkText}>OK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingId(null)} style={styles.editCancelBtn}>
                      <Text style={styles.editCancelText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={styles.setBtn}
                      onPress={() => { setEditingId(item.id); setEditStock(String(item.stock)); }}
                    >
                      <Text style={styles.setBtnText}>Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.unlimitedBtn} onPress={() => handleSetUnlimited(item.id)}>
                      <Text style={styles.unlimitedBtnText}>∞</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>Aucun menu trouvé</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  locked: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lockedIcon: { fontSize: 50, marginBottom: 10 },
  lockedText: { fontSize: 16, color: Colors.warning, fontWeight: '600' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6, gap: 8 },
  catList: { paddingHorizontal: 12, paddingTop: 0, paddingBottom: 6, gap: 8 },
  catChip: {
    borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10,
    backgroundColor: '#E8E0D5', borderWidth: 1.5, borderColor: '#D0C8BC',
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catText: { fontSize: 14, color: '#555', fontWeight: '600' },
  catTextActive: { color: Colors.textWhite, fontWeight: '700' },
  searchRow: { paddingHorizontal: 12, paddingTop: 10 },
  searchInput: {
    backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  statsRow: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 10, gap: 8 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.textLight, marginTop: 2 },
  list: { padding: 12, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardInfo: { marginBottom: 8 },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardCat: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  stockBadge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  stockBadgeText: { fontSize: 12, fontWeight: '700' },
  cardActions: {},
  btnRow: { flexDirection: 'row', gap: 8 },
  setBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
  },
  setBtnText: { color: Colors.textWhite, fontWeight: '600', fontSize: 13 },
  unlimitedBtn: {
    backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  unlimitedBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textLight },
  editRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  editInput: {
    flex: 1, backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, borderWidth: 1, borderColor: Colors.primary,
  },
  editOkBtn: { backgroundColor: Colors.success, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  editOkText: { color: Colors.textWhite, fontWeight: '700' },
  editCancelBtn: { padding: 8 },
  editCancelText: { fontSize: 16, color: Colors.textLight },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 50, marginBottom: 10 },
  emptyText: { color: Colors.textLight, fontSize: 16 },
});
