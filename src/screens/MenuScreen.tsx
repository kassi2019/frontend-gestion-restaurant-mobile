import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { formatPrixDevise, selectDevise } from '../store/slices/authSlice';
import { Colors } from '../theme/colors';
import { menuApi } from '../services/api';
import { showToast } from '../services/toast';

import { SERVER_URL } from '../config';
import ModalPicker from '../components/ModalPicker';
import ActionSheet from '../components/ActionSheet';
import useResponsive from '../hooks/useResponsive';

export default function MenuScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const devise = useSelector(selectDevise);
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const formatMontant = (val: string) => {
    if (!val) return '';
    const raw = val.replace(/,/g, '');
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const parseMontant = (val: string) => val.replace(/,/g, '');
  const { columns, sp } = useResponsive();
  const [categories, setCategories] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState<any>(null);
  const [selectedMenu, setSelectedMenu] = useState<any>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showCatPickerAdd, setShowCatPickerAdd] = useState(false);
  const [showCatPickerEdit, setShowCatPickerEdit] = useState(false);
  const [newMenu, setNewMenu] = useState({ nom: '', prix: '', categorieId: 0 });
  const [editMenuState, setEditMenuState] = useState({ id: 0, nom: '', prix: '', categorieId: 0 });
  const [newCat, setNewCat] = useState({ nom: '', ordreService: '1', destination: 'CUISINE' });
  const [menuImage, setMenuImage] = useState<string | null>(null);
  const [editMenuImage, setEditMenuImage] = useState<string | null>(null);
  // Variantes
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantMenuId, setVariantMenuId] = useState<number>(0);
  const [variantMenuName, setVariantMenuName] = useState('');
  const [variantMenuVariants, setVariantMenuVariants] = useState<any[]>([]);
  const [newVariant, setNewVariant] = useState({ nom: '', prix: '' });
  const [variantLoading, setVariantLoading] = useState(false);
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(new Set());

  const handleImportCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/*' });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const formData = new FormData();
      formData.append('file', { uri: file.uri, name: file.name, type: 'text/csv' } as any);

      const { data } = await menuApi.importCsv(formData);
      showToast.success(data.message || 'Import réussi');
      loadData();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Erreur import');
    }
  };

  const toggleVariants = (menuId: number) => {
    setExpandedVariants(prev => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  };
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerImageUri, setViewerImageUri] = useState('');

  const loadData = async () => {
    try {
      const [catRes, menuRes] = await Promise.all([
        menuApi.getCategories(),
        menuApi.getMenus(),
      ]);
      setCategories(catRes.data);
      setMenus(menuRes.data);
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const pickImage = async (forEdit: boolean) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[DEBUG] pickImage permission:', status);
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Autorisez l\'accès à la galerie dans les paramètres du téléphone.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      console.log('[DEBUG] pickImage result:', JSON.stringify(result));
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        console.log('[DEBUG] image URI:', uri);
        if (forEdit) setEditMenuImage(uri);
        else setMenuImage(uri);
      }
    } catch (err: any) {
      console.error('[DEBUG] pickImage erreur:', err?.message || err);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la galerie: ' + (err?.message || 'erreur inconnue'));
    }
  };

  const handleAddMenu = async () => {
    if (!newMenu.nom || !newMenu.prix) return Alert.alert('Erreur', 'Remplissez tous les champs');
    try {
      const res = await menuApi.createMenu({
        nom: newMenu.nom,
        prix: parseFloat(parseMontant(newMenu.prix)),
        categorieId: newMenu.categorieId || categories[0]?.id,
      });
      if (menuImage) {
        const formData = new FormData();
        formData.append('image', { uri: menuImage, type: 'image/jpeg', name: 'menu.jpg' } as any);
        await menuApi.uploadImage(res.data.id, formData);
      }
      setNewMenu({ nom: '', prix: '', categorieId: 0 });
      setMenuImage(null);
      showToast.success(`Plat "${newMenu.nom}" créé`);
      loadData();
    } catch (err) {
      showToast.error('Impossible d\'ajouter le plat');
    }
  };

  const handleEditMenu = async () => {
    if (!editMenuState.nom || !editMenuState.prix) return Alert.alert('Erreur', 'Remplissez tous les champs');
    try {
      await menuApi.updateMenu(editMenuState.id, {
        nom: editMenuState.nom,
        prix: parseFloat(parseMontant(editMenuState.prix)),
        categorieId: editMenuState.categorieId || undefined,
      });
      if (editMenuImage) {
        const formData = new FormData();
        formData.append('image', { uri: editMenuImage, type: 'image/jpeg', name: 'menu.jpg' } as any);
        await menuApi.uploadImage(editMenuState.id, formData);
      }
      setShowEditModal(false);
      setEditMenuImage(null);
      showToast.success(`Plat "${editMenuState.nom}" modifié`);
      loadData();
    } catch (err) {
      showToast.error('Impossible de modifier le plat');
    }
  };

  // ---- Variantes ----
  const openVariants = (menu: any) => {
    setVariantMenuId(menu.id);
    setVariantMenuName(menu.nom);
    setVariantMenuVariants(menu.variants || []);
    setNewVariant({ nom: '', prix: '' });
    setShowVariantModal(true);
  };

  const handleAddVariant = async () => {
    if (!newVariant.nom || !newVariant.prix) { showToast.error('Nom et prix requis'); return; }
    setVariantLoading(true);
    try {
      await menuApi.addVariant(variantMenuId, { nom: newVariant.nom, prix: parseFloat(newVariant.prix) });
      showToast.success('Variante ajoutée');
      setNewVariant({ nom: '', prix: '' });
      const { data } = await menuApi.getVariants(variantMenuId);
      setVariantMenuVariants(data || []);
      loadData();
    } catch (err: any) { showToast.error(err.response?.data?.message || 'Erreur'); }
    finally { setVariantLoading(false); }
  };

  const handleDeleteVariant = async (variantId: number) => {
    Alert.alert('Supprimer', 'Supprimer cette variante ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await menuApi.deleteVariant(variantId);
          showToast.success('Variante supprimée');
          setVariantMenuVariants(prev => prev.filter(v => v.id !== variantId));
          loadData();
        } catch {}
      }},
    ]);
  };

  const handleDeleteMenu = (item: any) => {
    Alert.alert('Supprimer', `Supprimer "${item.nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await menuApi.deleteMenu(item.id);
            showToast.success(`Plat "${item.nom}" supprimé`);
            loadData();
          } catch (e) { showToast.error('Suppression échouée'); }
        },
      },
    ]);
  };

  const handleAddCat = async () => {
    if (!newCat.nom) return Alert.alert('Erreur', 'Nom de catégorie requis');
    try {
      await menuApi.createCategorie({
        nom: newCat.nom,
        ordreService: parseInt(newCat.ordreService),
        destination: newCat.destination,
      });
      setNewCat({ nom: '', ordreService: '1', destination: 'CUISINE' });
      showToast.success(`Catégorie "${newCat.nom}" créée`);
      loadData();
    } catch (err) {
      showToast.error('Impossible d\'ajouter la catégorie');
    }
  };

  const catOptions = categories.map((c) => ({ label: c.nom, value: c.id.toString() }));
  const destOptions = [
    { label: 'Cuisine', value: 'CUISINE' },
    { label: 'Bar', value: 'BAR' },
    { label: 'Dessert', value: 'DESSERT' },
  ];

  const getCatName = (catId: number) => categories.find((c) => c.id === catId)?.nom || 'Inconnue';

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Categories filter */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={[{ id: 0, nom: 'Tous' }, ...categories]}
          keyExtractor={(item) => item.id.toString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, selectedCat?.id === item.id && styles.filterChipActive]}
              onPress={() => setSelectedCat(item.id === 0 ? null : item)}
            >
              <Text style={[styles.filterText, selectedCat?.id === item.id && styles.filterTextActive]}>
                {item.nom}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Toolbar Admin */}
      {isManager && (
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={() => { setNewMenu({ nom: '', prix: '', categorieId: categories[0]?.id || 0 }); setShowAddModal(true); }}>
            <Text style={styles.toolbarBtnIcon}>➕</Text>
            <Text style={styles.toolbarBtnText}>Ajouter un plat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolbarBtn, styles.toolbarBtnOutline]} onPress={() => setShowCatModal(true)}>
            <Text style={styles.toolbarBtnIconGray}>📂</Text>
            <Text style={styles.toolbarBtnTextGray}>Catégorie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolbarBtn, styles.toolbarBtnImport]} onPress={handleImportCsv}>
            <Text style={styles.toolbarBtnIconGreen}>📥</Text>
            <Text style={styles.toolbarBtnTextGreen}>Importer CSV</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Menu list */}
      <FlatList
        data={selectedCat ? menus.filter((m) => m.categorieId === selectedCat.id) : menus}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        renderItem={({ item }) => {
          const hasVariants = item.variants?.length > 0;
          const isExpanded = expandedVariants.has(item.id);
          return (
          <View>
            <TouchableOpacity
              style={styles.menuCard}
              onPress={() => { setSelectedMenu(item); if (isManager) setShowActionModal(true); }}
              activeOpacity={isManager ? 0.7 : 1}
            >
              {item.image ? (
                <TouchableOpacity onPress={() => { setViewerImageUri(SERVER_URL + item.image); setShowImageViewer(true); }}>
                  <Image source={{ uri: SERVER_URL + item.image }} style={styles.menuThumb} />
                </TouchableOpacity>
              ) : (
                <View style={styles.menuThumbPlaceholder}><Text style={styles.menuThumbPlaceholderText}>🍽</Text></View>
              )}
              <View style={styles.menuInfo}>
                <View style={styles.menuNameRow}>
                  <Text style={styles.menuName} numberOfLines={2}>{item.nom}</Text>
                  {hasVariants && (
                    <View style={styles.variantBadge}>
                      <Text style={styles.variantBadgeText}>{item.variants.length}</Text>
                    </View>
                  )}
                  <View style={[styles.availDot, { backgroundColor: item.disponibilite ? Colors.success : Colors.danger }]} />
                </View>
                <Text style={styles.menuCat}>{getCatName(item.categorieId)} • {item.tempsPreparation} min</Text>
              </View>
              <View style={styles.menuRight}>
                <Text style={styles.menuPrice}>{formatPrixDevise(item.prix, devise)}</Text>
                {hasVariants && (
                  <TouchableOpacity onPress={() => toggleVariants(item.id)} style={styles.expandArrow}>
                    <Text style={styles.expandArrowText}>{isExpanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>

            {/* Variantes déroulantes */}
            {hasVariants && isExpanded && (
              <View style={styles.variantDropdown}>
                {item.variants.map((v: any) => (
                  <View key={v.id} style={styles.variantDropdownItem}>
                    <Text style={styles.variantDropdownName}>{v.nom}</Text>
                    <Text style={styles.variantDropdownPrice}>{formatPrixDevise(v.prix, devise)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🍽</Text>
            <Text style={styles.emptyText}>Aucun plat trouvé</Text>
          </View>
        }
      />


      {/* Action Sheet */}
      <ActionSheet
        visible={showActionModal}
        title={selectedMenu?.nom}
        subtitle={`${formatPrixDevise(selectedMenu?.prix || 0, devise)} • ${getCatName(selectedMenu?.categorieId)}`}
        actions={[
          {
            icon: selectedMenu?.disponibilite ? '👁' : '👁‍🗨',
            label: selectedMenu?.disponibilite ? 'Désactiver' : 'Activer',
            onPress: () => {
              setShowActionModal(false);
              menuApi.toggleDisponibilite(selectedMenu?.id).then(() => { showToast.success('Disponibilité modifiée'); loadData(); });
            },
          },
          {
            icon: selectedMenu?.disponibleDemain === 0 ? '✅' : '❌',
            label: selectedMenu?.disponibleDemain === 0 ? 'Pas disponible' : 'Disponible',
            onPress: () => {
              setShowActionModal(false);
              menuApi.toggleDisponibleDemain(selectedMenu?.id).then(() => { showToast.success(selectedMenu?.disponibleDemain === 0 ? 'Marqué pas disponible' : 'Marqué disponible'); loadData(); });
            },
          },
          {
            icon: '📋', label: 'Variantes',
            onPress: () => {
              setShowActionModal(false);
              openVariants(selectedMenu);
            },
          },
          {
            icon: '✏️', label: 'Modifier',
            onPress: () => {
              setShowActionModal(false);
              setEditMenuState({ id: selectedMenu?.id || 0, nom: selectedMenu?.nom || '', prix: String(selectedMenu?.prix || ''), categorieId: selectedMenu?.categorieId || 0 });
              setShowEditModal(true);
            },
          },
          { icon: '🗑', label: 'Supprimer', danger: true, onPress: () => { setShowActionModal(false); handleDeleteMenu(selectedMenu); } },
        ]}
        onClose={() => setShowActionModal(false)}
      />

      {/* Add Menu Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ajouter un Plat</Text>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Nom du plat</Text>
              <TextInput style={styles.field} placeholder="Ex: Poulet DG" value={newMenu.nom} onChangeText={(t) => setNewMenu({ ...newMenu, nom: t })} />
              <Text style={styles.fieldLabel}>{`Prix (${devise})`}</Text>
              <TextInput
                style={styles.field}
                placeholder="Ex: 12.50"
                keyboardType="decimal-pad"
                value={newMenu.prix}
                onChangeText={(t) => setNewMenu({ ...newMenu, prix: t.replace(/,/g, '') })}
                onBlur={() => setNewMenu({ ...newMenu, prix: formatMontant(newMenu.prix) })}
                onFocus={() => setNewMenu({ ...newMenu, prix: parseMontant(newMenu.prix) })}
              />
              <Text style={styles.fieldLabel}>Catégorie</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setShowCatPickerAdd(true)}
              >
                <Text style={newMenu.categorieId ? styles.selectText : styles.selectPlaceholder}>
                  {newMenu.categorieId ? categories.find(c => c.id === newMenu.categorieId)?.nom : 'Sélectionner une catégorie'}
                </Text>
                <Text style={styles.selectArrow}>▼</Text>
              </TouchableOpacity>
              <Text style={styles.fieldLabel}>Image</Text>
              <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage(false)}>
                {menuImage ? (
                  <Image source={{ uri: menuImage }} style={styles.imagePreview} />
                ) : (
                  <Text style={styles.imageBtnText}>📷 Choisir une photo</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
            <View style={{ marginTop: 24 }}>
              <TouchableOpacity style={styles.fullSaveBtn} onPress={handleAddMenu}><Text style={styles.saveText}>Ajouter le plat</Text></TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center', marginTop: 8 }} onPress={() => setShowAddModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ModalPicker
        visible={showCatPickerAdd}
        title="Catégorie"
        options={catOptions}
        selectedValue={newMenu.categorieId.toString()}
        onSelect={(val) => { setNewMenu({ ...newMenu, categorieId: parseInt(val) }); setShowCatPickerAdd(false); }}
        onClose={() => setShowCatPickerAdd(false)}
      />

      {/* Edit Menu Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier le Plat</Text>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Nom du plat</Text>
              <TextInput style={styles.field} placeholder="Ex: Poulet DG" value={editMenuState.nom} onChangeText={(t) => setEditMenuState({ ...editMenuState, nom: t })} />
              <Text style={styles.fieldLabel}>{`Prix (${devise})`}</Text>
              <TextInput
                style={styles.field}
                placeholder="Ex: 12.50"
                keyboardType="decimal-pad"
                value={editMenuState.prix}
                onChangeText={(t) => setEditMenuState({ ...editMenuState, prix: t.replace(/,/g, '') })}
                onBlur={() => setEditMenuState({ ...editMenuState, prix: formatMontant(editMenuState.prix) })}
                onFocus={() => setEditMenuState({ ...editMenuState, prix: parseMontant(editMenuState.prix) })}
              />
              <Text style={styles.fieldLabel}>Catégorie</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setShowCatPickerEdit(true)}
              >
                <Text style={editMenuState.categorieId ? styles.selectText : styles.selectPlaceholder}>
                  {editMenuState.categorieId ? categories.find(c => c.id === editMenuState.categorieId)?.nom : 'Sélectionner une catégorie'}
                </Text>
                <Text style={styles.selectArrow}>▼</Text>
              </TouchableOpacity>
              <Text style={styles.fieldLabel}>Image</Text>
              <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage(true)}>
                {editMenuImage ? (
                  <Image source={{ uri: editMenuImage }} style={styles.imagePreview} />
                ) : (
                  <Text style={styles.imageBtnText}>📷 Choisir une photo</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
            <View style={{ marginTop: 24 }}>
              <TouchableOpacity style={styles.fullSaveBtn} onPress={handleEditMenu}><Text style={styles.saveText}>Enregistrer</Text></TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center', marginTop: 8 }} onPress={() => setShowEditModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ModalPicker
        visible={showCatPickerEdit}
        title="Catégorie"
        options={catOptions}
        selectedValue={editMenuState.categorieId.toString()}
        onSelect={(val) => { setEditMenuState({ ...editMenuState, categorieId: parseInt(val) }); setShowCatPickerEdit(false); }}
        onClose={() => setShowCatPickerEdit(false)}
      />

      {/* Add Category Modal */}
      <Modal visible={showCatModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouvelle Catégorie</Text>
            <Text style={styles.fieldLabel}>Nom</Text>
            <TextInput style={styles.field} placeholder="Ex: Entrées" value={newCat.nom} onChangeText={(t) => setNewCat({ ...newCat, nom: t })} />
            <Text style={styles.fieldLabel}>Ordre de service</Text>
            <TextInput style={styles.field} placeholder="1, 2, 3..." keyboardType="numeric" value={newCat.ordreService} onChangeText={(t) => setNewCat({ ...newCat, ordreService: t })} />
            <Text style={styles.fieldLabel}>Destination</Text>
            <View style={styles.chipRow}>
              {destOptions.map((opt) => (
                <TouchableOpacity key={opt.value} style={[styles.optChip, newCat.destination === opt.value && styles.optChipActive]} onPress={() => setNewCat({ ...newCat, destination: opt.value })}>
                  <Text style={newCat.destination === opt.value ? styles.optChipTextActive : styles.optChipText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCatModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddCat}><Text style={styles.saveText}>Créer</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal visible={showImageViewer} transparent animationType="fade">
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setShowImageViewer(false)}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </TouchableOpacity>
          <Image source={{ uri: viewerImageUri }} style={styles.viewerImage} resizeMode="contain" />
        </View>
      </Modal>

      {/* Variantes Modal */}
      <Modal visible={showVariantModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 Variantes — {variantMenuName}</Text>
              <TouchableOpacity onPress={() => setShowVariantModal(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Variantes existantes */}
            {variantMenuVariants.length > 0 ? (
              variantMenuVariants.map((v: any) => (
                <View key={v.id} style={styles.variantItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.variantName}>{v.nom}</Text>
                    <Text style={styles.variantPrice}>{formatPrixDevise(v.prix, devise)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteVariant(v.id)} style={styles.variantDeleteBtn}>
                    <Text style={styles.variantDeleteText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={{ color: Colors.textLight, textAlign: 'center', paddingVertical: 20 }}>Aucune variante</Text>
            )}

            {/* Ajouter une variante */}
            <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16, marginTop: 8 }}>
              <Text style={{ fontWeight: '700', color: Colors.text, marginBottom: 12 }}>+ Ajouter une variante</Text>
              <TextInput
                style={styles.field}
                placeholder="Nom (ex: Avec alcool)"
                value={newVariant.nom}
                onChangeText={(t) => setNewVariant({ ...newVariant, nom: t })}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={styles.field}
                placeholder={`Prix (${devise})`}
                keyboardType="decimal-pad"
                value={newVariant.prix}
                onChangeText={(t) => setNewVariant({ ...newVariant, prix: t })}
                placeholderTextColor={Colors.textLight}
              />
              <TouchableOpacity
                style={[styles.fullSaveBtn, variantLoading && { opacity: 0.6 }]}
                onPress={handleAddVariant}
                disabled={variantLoading}
              >
                {variantLoading ? (
                  <ActivityIndicator color={Colors.textWhite} />
                ) : (
                  <Text style={styles.saveText}>Ajouter la variante</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  filterList: { paddingHorizontal: 8 },
  filterChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 4, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  filterTextActive: { color: Colors.textWhite, fontWeight: '700' },
  addBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.success, marginRight: 8 },
  addBtnText: { color: Colors.textWhite, fontWeight: '700', fontSize: 13 },
  toolbar: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8,
  },
  toolbarBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, gap: 4,
  },
  toolbarBtnOutline: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  toolbarBtnImport: {
    backgroundColor: '#16A34A15', borderWidth: 1, borderColor: '#16A34A30',
  },
  toolbarBtnIcon: { fontSize: 14, color: Colors.textWhite },
  toolbarBtnIconGray: { fontSize: 14 },
  toolbarBtnIconGreen: { fontSize: 14 },
  toolbarBtnText: { fontSize: 11, fontWeight: '700', color: Colors.textWhite },
  toolbarBtnTextGray: { fontSize: 11, fontWeight: '600', color: Colors.text },
  toolbarBtnTextGreen: { fontSize: 11, fontWeight: '600', color: '#16A34A' },
  list: { padding: 12, paddingBottom: 80 },
  menuCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 10, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  menuThumb: { width: 50, height: 50, borderRadius: 10, marginRight: 10 },
  menuInfo: { flex: 1 },
  menuNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  menuCat: { fontSize: 12, color: Colors.textLight, marginTop: 4 },
  menuRight: { alignItems: 'flex-end', marginLeft: 12 },
  menuPrice: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  fab: {
    position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: Colors.textWhite, fontSize: 28, fontWeight: '300', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '85%' },
  modalScroll: { flexShrink: 1 },
  modalScrollContent: { paddingBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 20, textAlign: 'center' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.secondary, marginBottom: 6, marginTop: 12 },
  field: { backgroundColor: Colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  selectField: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: 15, color: Colors.text },
  selectPlaceholder: { fontSize: 15, color: Colors.textLight },
  selectArrow: { fontSize: 12, color: Colors.textLight },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  optChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, marginTop: 8, marginRight: 8, alignSelf: 'flex-start' },
  optChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optChipText: { fontSize: 13, color: Colors.textLight },
  optChipTextActive: { fontSize: 13, color: Colors.textWhite, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
  cancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { color: Colors.textLight, fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, backgroundColor: Colors.primary, alignItems: 'center' },
  saveText: { color: Colors.textWhite, fontWeight: '700', fontSize: 15 },
  fullSaveBtn: { borderRadius: 14, paddingVertical: 14, backgroundColor: Colors.primary, alignItems: 'center', width: '100%' },
  imageBtn: {
    backgroundColor: Colors.inputBg, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, borderStyle: 'dashed',
    height: 100, justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  imageBtnText: { color: Colors.textLight, fontSize: 14 },
  imagePreview: { width: '100%', height: '100%', borderRadius: 12 },
  empty: { alignItems: 'center', padding: 50 },
  emptyIcon: { fontSize: 50, marginBottom: 10 },
  emptyText: { color: Colors.textLight, fontSize: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalClose: { padding: 8 },
  modalCloseText: { fontSize: 20, color: Colors.textLight, fontWeight: '600' },
  menuThumbPlaceholder: { width: 50, height: 50, borderRadius: 10, marginRight: 10, backgroundColor: Colors.inputBg, justifyContent: 'center', alignItems: 'center' },
  menuThumbPlaceholderText: { fontSize: 22 },
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  viewerCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  viewerCloseText: { color: Colors.textWhite, fontSize: 20, fontWeight: '700' },
  viewerImage: { width: '100%', height: '70%' },
  // Variantes
  variantItem: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    backgroundColor: Colors.inputBg, borderRadius: 12, marginBottom: 6,
  },
  variantName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  variantPrice: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  variantDeleteBtn: { padding: 8 },
  variantDeleteText: { fontSize: 18 },
  // Variantes inline
  variantBadge: {
    backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2,
    marginRight: 6,
  },
  variantBadgeText: { color: Colors.textWhite, fontSize: 10, fontWeight: '800' },
  expandArrow: { padding: 6 },
  expandArrowText: { fontSize: 12, color: Colors.textLight },
  variantDropdown: {
    backgroundColor: Colors.inputBg, marginHorizontal: 12, marginTop: -6, marginBottom: 8,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border, borderTopWidth: 0,
  },
  variantDropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  variantDropdownName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  variantDropdownPrice: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
