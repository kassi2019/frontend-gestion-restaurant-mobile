import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, ScrollView, TextInput,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Colors } from '../theme/colors';
import { formatPrixDevise, selectDevise } from '../store/slices/authSlice';
import { commandesApi, tablesApi, menuApi, usersApi } from '../services/api';
import { showToast } from '../services/toast';
import { getSocket } from '../services/socket';
import * as Print from 'expo-print';

type TabType = 'arrivees' | 'validees' | 'payees';

export default function ReceptionnisteScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const devise = useSelector(selectDevise);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('arrivees');
  const [commandes, setCommandes] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [serveurs, setServeurs] = useState<any[]>([]);
  // Date du jour au format YYYY-MM-DD
  const aujourdhui = new Date().toISOString().split('T')[0];

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(aujourdhui);

  // Modal ticket
  const [showTickets, setShowTickets] = useState(false);
  const [ticketCmd, setTicketCmd] = useState<any>(null);

  // Modal assignation serveur
  const [showAssign, setShowAssign] = useState(false);
  const [assignCmdId, setAssignCmdId] = useState<number | null>(null);
  const [assignServeurId, setAssignServeurId] = useState<number>(0);

  const loadData = useCallback(async () => {
    try {
      const [cmdRes, tRes, mRes, uRes] = await Promise.all([
        commandesApi.getAll(),
        tablesApi.getAll(),
        menuApi.getMenus(),
        usersApi.findByRole('SERVEUR'),
      ]);
      setCommandes(Array.isArray(cmdRes.data) ? cmdRes.data : []);
      setTables(Array.isArray(tRes.data) ? tRes.data : []);
      setMenus(Array.isArray(mRes.data) ? mRes.data : []);
      const serveurList = (Array.isArray(uRes.data) ? uRes.data : [])
        .filter((s: any) => s.statut === 'ACTIF');
      setServeurs(serveurList);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Socket temps réel
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      const refresh = () => loadData();
      socket.on('nouvelle_commande', refresh);
      socket.on('commande_status_change', refresh);
      return () => {
        socket.off('nouvelle_commande', refresh);
        socket.off('commande_status_change', refresh);
      };
    }
  }, [loadData]);

  // Filtrer par recherche et date
  const filteredCommandes = commandes.filter((c: any) => {
    if (!c) return false;
    // Filtre par numéro de commande
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const numCmd = `CMD-${String(c.id || 0).padStart(4, '0')}`.toLowerCase();
      const matchNum = numCmd.includes(term) || String(c.id).includes(term);
      if (!matchNum) return false;
    }
    // Filtre par date
    if (filterDate) {
      const d = new Date(c.dateCommande);
      const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (dStr !== filterDate) return false;
    }
    return true;
  });

  // Filtrer par onglet (avec filtre null)
  const arrivees = filteredCommandes.filter((c: any) => c.statut === 'EN_ATTENTE');
  const validees = filteredCommandes.filter((c: any) => c.statut === 'VALIDEE');
  const payees = filteredCommandes.filter((c: any) => c.statut === 'PAYEE');

  // Charge par serveur : commandes du jour EN_ATTENTE ou VALIDEE
  const serveursAvecCharge = useMemo(() => {
    return serveurs.map(s => {
      const charge = commandes.filter((c: any) => {
        if (!c || c.serveurId !== s.id) return false;
        if (c.statut !== 'EN_ATTENTE' && c.statut !== 'VALIDEE') return false;
        // Filtrer par date du jour
        const d = new Date(c.dateCommande);
        const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        return dStr === aujourdhui;
      }).length;
      return { ...s, charge };
    }).sort((a, b) => a.charge - b.charge);
  }, [serveurs, commandes, aujourdhui]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getTableNumero = (tableId: number) => {
    if (!tableId) return '?';
    return tables.find(t => t.id === tableId)?.numero || '?';
  };
  const getServeurNom = (serveurId: number) => {
    if (!serveurId) return null;
    return serveurs.find(s => s.id === serveurId)?.nom || null;
  };

  // Assigner serveur
  const openAssign = (cmdId: number, currentServeurId?: number) => {
    setAssignCmdId(cmdId);
    setAssignServeurId(currentServeurId || (serveurs[0]?.id || 0));
    setShowAssign(true);
  };

  const confirmAssign = async () => {
    if (!assignCmdId || !assignServeurId) return;
    try {
      await commandesApi.assignServeur(assignCmdId, assignServeurId);
      showToast.success('Serveur assigné');
      setShowAssign(false);
      loadData();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Erreur');
    }
  };

  // Valider → VALIDEE → 4 tickets
  const handleValider = async (cmd: any) => {
    try {
      // Serveur obligatoire sauf pour les commandes à emporter
      const isEmporter = cmd.typeCommande === 'A_EMPORTER' || cmd.table?.zone?.toUpperCase() === 'COMPTOIR' || cmd.table?.numero?.toUpperCase() === 'T00';
      if (!cmd.serveurId && !isEmporter) {
        showToast.error('Assigner un serveur avant de valider');
        return;
      }
      await commandesApi.updateStatut(cmd.id, 'VALIDEE');
      showToast.success('Commande validée !');

      // Afficher les 4 tickets
      setTicketCmd({ ...cmd, statut: 'VALIDEE' });
      setShowTickets(true);
      loadData();
    } catch (err: any) {
      showToast.error(err.response?.data?.message || 'Erreur validation');
    }
  };

  // Tickets : filtrer les détails par destination
  const getDetailsCuisine = (cmd: any) => {
    if (!cmd || !cmd.details) return [];
    return cmd.details.filter((d: any) =>
      ['CUISINE', 'DESSERT'].includes(d.menu?.categorie?.destination)
    );
  };

  const getDetailsBar = (cmd: any) => {
    if (!cmd || !cmd.details) return [];
    return cmd.details.filter((d: any) =>
      d.menu?.categorie?.destination === 'BAR'
    );
  };

  const statutColor = (s: string) => {
    switch (s) {
      case 'EN_ATTENTE': return '#FF9800';
      case 'VALIDEE': return '#2196F3';
      case 'PAYEE': return '#4CAF50';
      default: return '#999';
    }
  };

  const statutLabel = (s: string) => {
    switch (s) {
      case 'EN_ATTENTE': return 'En attente';
      case 'VALIDEE': return 'Validée';
      case 'PAYEE': return 'Payée';
      default: return s;
    }
  };

  // Imprimer un ticket individuel (mobile via expo-print)
  const imprimerTicket = async (cmd: any, type: 'cuisine' | 'bar' | 'serveur' | 'caisse') => {
    const tableNumero = getTableNumero(cmd.tableId);
    const serveurNom = getServeurNom(cmd.serveurId) || '—';
    const dateStr = new Date(cmd.dateCommande).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const cmdRef = 'CMD-' + String(cmd.id).padStart(4, '0');
    const total = Number(cmd.montantTotal || 0).toFixed(2);
    let articles: any[] = [], titre = '', avecPrix = false, avecTotal = false;
    switch (type) { case 'cuisine': titre = '🍳 CUISINE'; articles = getDetailsCuisine(cmd); break; case 'bar': titre = '🍸 BAR'; articles = getDetailsBar(cmd); break; case 'serveur': titre = '🧾 SERVEUR'; articles = cmd.details || []; avecPrix = true; avecTotal = true; break; case 'caisse': titre = '💰 CAISSE'; articles = cmd.details || []; avecPrix = true; avecTotal = true; break; }
    const pts = '<div style="border-top:2px dashed #aaa;margin:12px 0"></div>';
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + titre + '</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Courier New",monospace;padding:20px;max-width:300px;margin:0 auto;color:#222}h1{font-size:16px;text-align:center;margin-bottom:4px}h2{font-size:12px;text-align:center;color:#888;margin-bottom:10px;font-weight:400}h3{font-size:14px;text-align:center;margin-bottom:2px}.info{font-size:11px;text-align:center;color:#888;margin-bottom:2px}.footer{text-align:center;font-size:10px;color:#aaa;margin-top:16px}</style></head><body><h1>RestoPro</h1><h2>Gestion Restaurant</h2>' + pts + '<h3>' + titre + '</h3><p class="info">Table: ' + tableNumero + '</p><p class="info">' + cmdRef + ' · ' + dateStr + '</p>' + (type === 'serveur' || type === 'caisse' ? '<p class="info">Serveur: ' + serveurNom + '</p>' : '') + pts + articles.map((d: any) => avecPrix ? '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span>' + d.quantite + 'x ' + ((d.menu?.nom) || 'Plat') + '</span><span style="font-weight:600">' + (Number(d.prix || 0) * d.quantite).toFixed(2) + ' ' + devise + '</span></div>' : '<div style="font-size:13px;padding:3px 0">' + d.quantite + 'x ' + ((d.menu?.nom) || 'Plat') + '</div>').join('') + (articles.length === 0 ? '<p style="text-align:center;color:#aaa;font-style:italic;font-size:12px">Aucun article</p>' : '') + (avecTotal ? pts + '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:15px;font-weight:900"><span>TOTAL</span><span>' + total + ' ' + devise + '</span></div>' : '') + (type === 'caisse' ? '<p style="text-align:center;font-size:10px;font-weight:700;background:#FFF3E0;padding:4px 8px;border-radius:6px;margin-top:8px">Réf: ' + cmdRef + '</p>' : '') + pts + '<p class="footer">RestoPro © ' + new Date().getFullYear() + '<br>Merci de votre visite</p></body></html>';
    try { await Print.printAsync({ html }); } catch {}
  };

  // Imprimer les 4 tickets d'un coup (mobile via expo-print)
  const imprimerTout = async (cmd: any) => {
    const tableNumero = getTableNumero(cmd.tableId);
    const serveurNom = getServeurNom(cmd.serveurId) || '—';
    const dateStr = new Date(cmd.dateCommande).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const cmdRef = 'CMD-' + String(cmd.id).padStart(4, '0');
    const total = Number(cmd.montantTotal || 0).toFixed(2);
    const articlesCuisine = getDetailsCuisine(cmd);
    const articlesBar = getDetailsBar(cmd);
    const articles = cmd.details || [];
    const ligne = '<div style="border-top:1px dashed #000;margin:6px 0"></div>';
    const coupe = '<div style="text-align:center;padding:8px 0;font-size:10px;letter-spacing:8px">- - - - ✂ - - - -</div>';
    const bloc = (t: string, items: any[], avecPrix: boolean, avecTotal: boolean, ref?: boolean) =>
      '<h3 style="text-align:center;font-size:13px;margin:4px 0">' + t + '</h3><p style="text-align:center;font-size:9px;color:#555">' + cmdRef + ' · ' + dateStr + '</p>' + ligne +
      (items.map((d: any) => avecPrix
        ? '<div style="display:flex;justify-content:space-between;font-size:11px;padding:1px 0"><span>' + d.quantite + 'x ' + ((d.menu?.nom) || 'Plat') + '</span><span>' + (Number(d.prix || 0) * d.quantite).toFixed(2) + ' ' + devise + '</span></div>'
        : '<div style="font-size:11px;padding:1px 0">' + d.quantite + 'x ' + ((d.menu?.nom) || 'Plat') + '</div>'
      ).join('') || '<p style="text-align:center;color:#999;font-size:10px;font-style:italic">Aucun article</p>') +
      (avecTotal ? ligne + '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:900;padding:2px 0"><span>TOTAL</span><span>' + total + ' ' + devise + '</span></div>' : '') +
      (ref ? '<p style="text-align:center;font-size:9px;font-weight:700;margin-top:4px">Réf: ' + cmdRef + '</p>' : '');
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commande ' + cmdRef + '</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Courier New",monospace;padding:10px;max-width:280px;margin:0 auto;color:#000;font-size:11px}h1{text-align:center;font-size:15px;margin-bottom:2px}</style></head><body><h1>RestoPro</h1><p style="text-align:center;font-size:9px;color:#555;margin-bottom:4px">Gestion Restaurant</p><p style="text-align:center;font-size:9px;color:#555">Table: ' + tableNumero + ' · Serveur: ' + serveurNom + '</p>' + ligne + bloc('🍳 CUISINE', articlesCuisine, false, false) + coupe + bloc('🍸 BAR', articlesBar, false, false) + coupe + bloc('🧾 SERVEUR', articles, true, true) + coupe + bloc('💰 CAISSE', articles, true, true, true) + ligne + '<p style="text-align:center;font-size:9px;color:#aaa;margin-top:4px">RestoPro © ' + new Date().getFullYear() + '</p><p style="text-align:center;font-size:9px;color:#aaa">Merci de votre visite</p></body></html>';
    try { await Print.printAsync({ html }); } catch {}
  };

  const renderCommande = ({ item }: { item: any }) => {
    if (!item) return null;
    const serveurNom = getServeurNom(item.serveurId);
    const isEnAttente = item.statut === 'EN_ATTENTE';
    const isEmporter = item.typeCommande === 'A_EMPORTER' || item.table?.zone?.toUpperCase() === 'COMPTOIR' || item.table?.numero?.toUpperCase() === 'T00';
    const isExpanded = expandedIds.has(item.id);

    return (
      <View style={[styles.cmdCard, { borderLeftColor: statutColor(item.statut), borderLeftWidth: 5 }]}>
        {/* En-tête commande — cliquable pour déplier */}
        <TouchableOpacity style={styles.cmdHeaderTouch} onPress={() => toggleExpand(item.id)} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cmdTitle}>
              Table {getTableNumero(item.tableId)} · #{String(item.id || 0).padStart(4, '0')}
            </Text>
            <Text style={styles.cmdTime}>
              {item.dateCommande ? new Date(item.dateCommande).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
              {isEmporter ? ' · 🛍️ Comptoir' : serveurNom ? ` · 👤 ${serveurNom}` : ' · ⚠️ Sans serveur'}
            </Text>
          </View>
          <View style={[styles.statutBadge, { backgroundColor: statutColor(item.statut) + '20' }]}>
            <Text style={[styles.statutBadgeText, { color: statutColor(item.statut) }]}>
              {statutLabel(item.statut)}
            </Text>
          </View>
          {!isEnAttente && (
            <TouchableOpacity onPress={(e) => { e.stopPropagation; imprimerTout(item); }} style={styles.printBtn}>
              <Text style={{ fontSize: 14 }}>🖨</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.arrow}>{isExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {/* Total toujours visible */}
        <Text style={styles.cmdTotal}>
          Total : {formatPrixDevise(item.montantTotal, devise)}
        </Text>

        {/* Détails plats — visible uniquement si déplié */}
        {isExpanded && (
          <View style={styles.detailsList}>
            {(item.details || []).map((d: any) => (
              <View key={d.id} style={styles.detailRow}>
                <Text style={styles.detailQte}>{d.quantite}x</Text>
                <Text style={styles.detailNom}>{d.menu?.nom || 'Plat'}</Text>
                <Text style={styles.detailPrix}>
                  {formatPrixDevise(Number(d.prix) * d.quantite, devise)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions (EN_ATTENTE uniquement) */}
        {isEnAttente && (
          <View style={styles.actions}>
            {!isEmporter && (
              <TouchableOpacity
                style={styles.actionAssign}
                onPress={() => openAssign(item.id, item.serveurId)}
              >
                <Text style={styles.actionAssignText}>
                  👤 {item.serveurId ? 'Changer serveur' : 'Assigner serveur'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionValider, !item.serveurId && !isEmporter && { opacity: 0.5 }]}
              onPress={() => handleValider(item)}
            >
              <Text style={styles.actionValiderText}>✅ Valider{isEmporter ? ' (comptoir)' : ''}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const tabs: { key: TabType; label: string; icon: string; count: number; color: string }[] = [
    { key: 'arrivees', label: 'Arrivées', icon: '🔔', count: arrivees.length, color: '#FF9800' },
    { key: 'validees', label: 'Validées', icon: '✅', count: validees.length, color: '#2196F3' },
    { key: 'payees', label: 'Payées', icon: '💰', count: payees.length, color: '#4CAF50' },
  ];

  // Si recherche active → montrer tous les résultats (tous statuts confondus)
  // Sinon → filtrer par l'onglet actif
  const isSearching = searchTerm.trim() !== '' || filterDate !== '';
  const currentData = isSearching
    ? filteredCommandes
    : (activeTab === 'arrivees' ? arrivees : activeTab === 'validees' ? validees : payees);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📋 Réception</Text>
        <Text style={styles.subtitle}>Gestion des commandes</Text>
      </View>

      {/* Charge des serveurs */}
      <View style={styles.chargeSection}>
        <Text style={styles.chargeSectionTitle}>👤 Charge serveurs</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {serveursAvecCharge.map(s => (
            <View key={s.id} style={[styles.chargeBlock, s.charge >= 5 && styles.chargeBlockHigh]}>
              <Text style={styles.chargeBlockName}>{s.nom}</Text>
              <Text style={[styles.chargeBlockCount, s.charge >= 5 && styles.chargeBlockCountHigh]}>
                {s.charge} {s.charge <= 1 ? 'table' : 'tables'}
              </Text>
            </View>
          ))}
          {serveursAvecCharge.length === 0 && (
            <Text style={styles.chargeEmpty}>Aucun serveur actif</Text>
          )}
        </ScrollView>
      </View>

      {/* Barre de recherche (filtre unique pour les 3 onglets) */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 N° commande..."
            placeholderTextColor={Colors.textLight}
            value={searchTerm}
            onChangeText={setSearchTerm}
            keyboardType="default"
          />
          {searchTerm !== '' && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="📅 Date"
            placeholderTextColor={Colors.textLight}
            value={filterDate}
            onChangeText={(t) => setFilterDate(t || aujourdhui)}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          {filterDate !== aujourdhui && (
            <TouchableOpacity onPress={() => setFilterDate(aujourdhui)}>
              <Text style={styles.searchClear}>↺</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Onglets */}
      <View style={styles.tabsRow}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => {
              setActiveTab(tab.key);
              setSearchTerm('');
              setFilterDate('');
            }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.icon} {tab.label} ({tab.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste commandes */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} />
          }
          renderItem={renderCommande}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {activeTab === 'arrivees' ? '🎉 Aucune commande en attente' :
               activeTab === 'validees' ? 'Aucune commande validée' :
               'Aucune commande payée'}
            </Text>
          }
        />
      )}


      {/* Modal 4 Tickets */}
      <Modal visible={showTickets} transparent animationType="fade">
        <View style={styles.ticketOverlay}>
          <ScrollView style={styles.ticketScroll} contentContainerStyle={styles.ticketContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.ticketTitle, { marginBottom: 0 }]}>🧾 Tickets — #{String(ticketCmd?.id || 0).padStart(4, '0')}</Text>
              <TouchableOpacity onPress={() => imprimerTout(ticketCmd)} style={styles.printAllBtn}>
                <Text style={styles.printAllBtnText}>🖨 Imprimer tout</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.ticketSub}>
              Table {ticketCmd ? getTableNumero(ticketCmd.tableId) : '?'} ·{' '}
              {ticketCmd ? getServeurNom(ticketCmd.serveurId) || 'Sans serveur' : ''}
            </Text>

            {/* Ticket CUISINE */}
            <View style={styles.ticketBlock}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.ticketHeader, { marginBottom: 0 }]}>🍳 CUISINE</Text>
                <TouchableOpacity onPress={() => imprimerTicket(ticketCmd, 'cuisine')} style={styles.printSmallBtn}>
                  <Text style={{ fontSize: 12 }}>🖨</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.ticketTableLine}>Table {ticketCmd ? getTableNumero(ticketCmd.tableId) : '?'}</Text>
              {(getDetailsCuisine(ticketCmd).length > 0
                ? getDetailsCuisine(ticketCmd)
                : ticketCmd?.details || []
              ).map((d: any, i: number) => (
                <Text key={i} style={styles.ticketItem}>
                  {d.quantite}x {d.menu?.nom || 'Plat'}
                </Text>
              ))}
            </View>

            {/* Ticket BAR */}
            <View style={styles.ticketBlock}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.ticketHeader, { marginBottom: 0 }]}>🍸 BAR</Text>
                <TouchableOpacity onPress={() => imprimerTicket(ticketCmd, 'bar')} style={styles.printSmallBtn}>
                  <Text style={{ fontSize: 12 }}>🖨</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.ticketTableLine}>Table {ticketCmd ? getTableNumero(ticketCmd.tableId) : '?'}</Text>
              {(getDetailsBar(ticketCmd).length > 0
                ? getDetailsBar(ticketCmd)
                : []
              ).map((d: any, i: number) => (
                <Text key={i} style={styles.ticketItem}>
                  {d.quantite}x {d.menu?.nom || 'Plat'}
                </Text>
              ))}
              {getDetailsBar(ticketCmd).length === 0 && (
                <Text style={styles.ticketEmpty}>Aucune boisson</Text>
              )}
            </View>

            {/* Ticket SERVEUR */}
            <View style={styles.ticketBlock}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.ticketHeader, { marginBottom: 0 }]}>🧾 SERVEUR — {ticketCmd ? getServeurNom(ticketCmd.serveurId) || '?' : ''}</Text>
                <TouchableOpacity onPress={() => imprimerTicket(ticketCmd, 'serveur')} style={styles.printSmallBtn}>
                  <Text style={{ fontSize: 12 }}>🖨</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.ticketTableLine}>Table {ticketCmd ? getTableNumero(ticketCmd.tableId) : '?'}</Text>
              {(ticketCmd?.details || []).map((d: any, i: number) => (
                <View key={i} style={styles.ticketItemRow}>
                  <Text style={styles.ticketItem}>{d.quantite}x {d.menu?.nom || 'Plat'}</Text>
                  <Text style={styles.ticketItemPrix}>
                    {formatPrixDevise(Number(d.prix) * d.quantite, devise)}
                  </Text>
                </View>
              ))}
              <View style={styles.ticketSeparator} />
              <View style={styles.ticketItemRow}>
                <Text style={styles.ticketTotalLabel}>TOTAL</Text>
                <Text style={styles.ticketTotalValue}>
                  {formatPrixDevise(ticketCmd?.montantTotal || 0, devise)}
                </Text>
              </View>
            </View>

            {/* Ticket CAISSE */}
            <View style={[styles.ticketBlock, { backgroundColor: '#FFF8E1', borderColor: '#FFC107' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.ticketHeader, { marginBottom: 0 }]}>💰 CAISSE</Text>
                <TouchableOpacity onPress={() => imprimerTicket(ticketCmd, 'caisse')} style={styles.printSmallBtn}>
                  <Text style={{ fontSize: 12 }}>🖨</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.ticketTableLine}>
                Table {ticketCmd ? getTableNumero(ticketCmd.tableId) : '?'} · #{String(ticketCmd?.id || 0).padStart(4, '0')}
              </Text>
              <Text style={styles.ticketTableLine}>Serveur : {ticketCmd ? getServeurNom(ticketCmd.serveurId) || '?' : '?'}</Text>
              {(ticketCmd?.details || []).map((d: any, i: number) => (
                <View key={i} style={styles.ticketItemRow}>
                  <Text style={styles.ticketItem}>{d.quantite}x {d.menu?.nom || 'Plat'}</Text>
                  <Text style={styles.ticketItemPrix}>
                    {formatPrixDevise(Number(d.prix) * d.quantite, devise)}
                  </Text>
                </View>
              ))}
              <View style={styles.ticketSeparator} />
              <View style={styles.ticketItemRow}>
                <Text style={styles.ticketTotalLabel}>TOTAL À PAYER</Text>
                <Text style={[styles.ticketTotalValue, { color: '#E65100' }]}>
                  {formatPrixDevise(ticketCmd?.montantTotal || 0, devise)}
                </Text>
              </View>
              <Text style={styles.ticketRef}>
                Réf : CMD-{String(ticketCmd?.id || 0).padStart(4, '0')}
              </Text>
            </View>

            <TouchableOpacity style={styles.ticketClose} onPress={() => setShowTickets(false)}>
              <Text style={styles.ticketCloseText}>Fermer</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal assignation serveur */}
      <Modal visible={showAssign} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>👤 Assigner un serveur</Text>
            <Text style={styles.modalSub}>Commande #{String(assignCmdId || 0).padStart(4, '0')}</Text>

            <ScrollView style={{ maxHeight: 300 }}>
              {serveursAvecCharge.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.serveurOption, assignServeurId === s.id && styles.serveurOptionActive]}
                  onPress={() => setAssignServeurId(s.id)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{s.nom.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serveurOptionName}>{s.nom}</Text>
                  </View>
                  <View style={[styles.chargeBadge, s.charge >= 5 && styles.chargeBadgeHigh]}>
                    <Text style={[styles.chargeBadgeText, s.charge >= 5 && styles.chargeBadgeTextHigh]}>
                      🪑 {s.charge}
                    </Text>
                  </View>
                  {assignServeurId === s.id && <Text style={{ fontSize: 16, marginLeft: 6 }}>✅</Text>}
                </TouchableOpacity>
              ))}
              {serveurs.length === 0 && (
                <Text style={styles.empty}>Aucun serveur actif</Text>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmAssign}>
              <Text style={styles.modalConfirmText}>✅ Confirmer l'assignation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAssign(false)}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 30, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textLight, marginTop: 2 },

  // Charge serveurs (en haut)
  chargeSection: {
    marginTop: 14, marginHorizontal: 12,
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  chargeSectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  chargeBlock: {
    backgroundColor: '#E8F5E9', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    marginRight: 10, alignItems: 'center', minWidth: 85,
  },
  chargeBlockHigh: { backgroundColor: '#FFF3E0' },
  chargeBlockName: { fontSize: 11, fontWeight: '600', color: Colors.text },
  chargeBlockCount: { fontSize: 14, fontWeight: '800', color: '#2E7D32', marginTop: 3 },
  chargeBlockCountHigh: { color: '#E65100' },
  chargeEmpty: { fontSize: 12, color: Colors.textLight, paddingVertical: 6 },

  chargeBadge: {
    backgroundColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
  },
  chargeBadgeHigh: { backgroundColor: '#FFF3E0' },
  chargeBadgeText: { fontSize: 12, fontWeight: '700', color: '#2E7D32' },
  chargeBadgeTextHigh: { color: '#E65100' },

  // Tabs
  tabsRow: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 14, marginBottom: 4, gap: 6 },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: Colors.textLight },
  tabTextActive: { color: Colors.textWhite },

  // Search
  searchRow: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 10, gap: 8 },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10,
  },
  searchInput: { flex: 1, height: 36, fontSize: 12, color: Colors.text },
  searchClear: { fontSize: 14, color: Colors.textLight, paddingLeft: 6 },

  // Liste
  list: { padding: 12, paddingBottom: 20 },
  cmdCard: { backgroundColor: Colors.surface, borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  cmdHeaderTouch: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  arrow: { fontSize: 12, color: Colors.textLight, marginLeft: 6 },
  printBtn: { paddingHorizontal: 6, paddingVertical: 4 },

  printAllBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  printAllBtnText: { color: Colors.textWhite, fontWeight: '700', fontSize: 12 },
  printSmallBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  cmdTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cmdTime: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  statutBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statutBadgeText: { fontSize: 11, fontWeight: '700' },

  detailsList: { borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 12, paddingTop: 8 },
  detailRow: { flexDirection: 'row', paddingVertical: 3 },
  detailQte: { fontWeight: '600', width: 30, fontSize: 13, color: Colors.text },
  detailNom: { flex: 1, fontSize: 13, color: Colors.text },
  detailPrix: { fontWeight: '600', fontSize: 13, color: Colors.primary },

  cmdTotal: {
    textAlign: 'right', fontWeight: '800', fontSize: 15, color: Colors.text,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4,
  },

  // Actions
  actions: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  actionAssign: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border,
  },
  actionAssignText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  actionValider: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.success,
  },
  actionValiderText: { fontSize: 13, fontWeight: '700', color: Colors.textWhite },

  // Modal assignation
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: Colors.textLight, marginBottom: 16 },

  serveurOption: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 12, marginBottom: 6, backgroundColor: Colors.inputBg,
    borderWidth: 1, borderColor: Colors.border,
  },
  serveurOptionActive: { backgroundColor: Colors.primary + '18', borderColor: Colors.primary },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  serveurOptionName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },

  modalConfirmBtn: {
    backgroundColor: Colors.success, borderRadius: 14, padding: 14,
    alignItems: 'center', marginTop: 12,
  },
  modalConfirmText: { color: Colors.textWhite, fontWeight: '800', fontSize: 15 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  cancelText: { color: Colors.textLight, fontSize: 14 },

  // Tickets modal
  ticketOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center' },
  ticketScroll: { maxHeight: '85%', marginHorizontal: 12 },
  ticketContent: { backgroundColor: Colors.surface, borderRadius: 20, padding: 16 },
  ticketTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center', color: Colors.text },
  ticketSub: { fontSize: 13, color: Colors.textLight, textAlign: 'center', marginBottom: 16 },

  ticketBlock: {
    backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  ticketHeader: { fontWeight: '800', fontSize: 14, color: Colors.text, marginBottom: 4 },
  ticketTableLine: { fontSize: 11, color: Colors.textLight, marginBottom: 6 },
  ticketItem: { fontSize: 13, paddingVertical: 1, color: Colors.text },
  ticketItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 },
  ticketItemPrix: { fontSize: 13, fontWeight: '600', color: Colors.text },
  ticketEmpty: { fontSize: 12, color: Colors.textLight, fontStyle: 'italic' },
  ticketSeparator: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  ticketTotalLabel: { fontSize: 14, fontWeight: '800', color: Colors.text },
  ticketTotalValue: { fontSize: 16, fontWeight: '900', color: Colors.primary },
  ticketRef: {
    fontSize: 12, fontWeight: '700', color: '#E65100',
    textAlign: 'center', marginTop: 6, backgroundColor: '#FFF3E0',
    paddingVertical: 4, borderRadius: 6,
  },
  ticketClose: {
    marginTop: 16, paddingVertical: 14, alignItems: 'center',
    backgroundColor: Colors.inputBg, borderRadius: 14,
  },
  ticketCloseText: { fontWeight: '600', color: Colors.text, fontSize: 15 },

  empty: { textAlign: 'center', color: Colors.textLight, paddingVertical: 40, fontSize: 14 },
});
