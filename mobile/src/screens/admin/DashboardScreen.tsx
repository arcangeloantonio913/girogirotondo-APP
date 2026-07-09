import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };

const LOGOS: Record<string, any> = {
  'girogirotondo':   require('../../../assets/logo-girogirotondo.png'),
  'il-magico-mondo': require('../../../assets/logo-magico-mondo.png'),
};
type Sede = { id: string; name: string; color?: string };

const CARDS = [
  { id: 'users',         icon: 'people-outline',         color: C.primary,      bg: C.tintBlue,   title: 'Gestione Utenti', tab: 'Utenti' },
  { id: 'presenze',      icon: 'clipboard-outline',      color: C.accentOrange, bg: C.tintOrange, title: 'Presenze',        tab: 'Presenze' },
  { id: 'classi',        icon: 'book-outline',           color: C.babyBlue,     bg: C.tintBlue,   title: 'Classi',          tab: 'Classi' },
  { id: 'mensa',         icon: 'restaurant-outline',     color: C.accentGreen,  bg: C.tintGreen,  title: 'Menu Mensa',      tab: 'Mensa' },
  { id: 'avvisi',        icon: 'megaphone-outline',      color: C.accentPink,   bg: C.tintPink,   title: 'Avvisi',          tab: 'Avvisi' },
  { id: 'appuntamenti',  icon: 'calendar-outline',       color: C.primary,      bg: C.tintBlue,   title: 'Appuntamenti',    tab: 'Appuntamenti' },
  { id: 'modulistica',   icon: 'document-text-outline',  color: C.accentOrange, bg: C.tintOrange, title: 'Modulistica',     tab: 'Modulistica' },
  { id: 'profilo',       icon: 'person-outline',         color: C.babyBlue,     bg: C.tintBlue,   title: 'Il mio Profilo',  tab: 'Profilo' },
];

export default function AdminDashboard({ navigation }: any) {
  const { user, sede, updateSede, logout, isSuperAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sedeAttiva = sede || user?.sede_id || 'girogirotondo';
  const [stats, setStats] = useState({ users: 0, students: 0, classes: 0 });
  const [sedi, setSedi] = useState<Sede[]>([]);

  useEffect(() => {
    api.get('/api/sedi')
      .then(r => setSedi(r.data ?? []))
      .catch(() => setSedi([]));   // fail-closed
  }, []);
  const sedeCorrente = sedi.find(x => x.id === sedeAttiva);

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/students'), api.get('/classes')])
      .then(([uR, sR, cR]) => setStats({ 
        users: uR.data?.length || 0, 
        students: sR.data?.length || 0, 
        classes: cR.data?.length || 0 
      }))
      .catch(() => {});
  }, [sede]);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      
      {/* ── Top bar ── */}
            <View style={s.topBar}>
        {/* Sinistra: spazio */}
        <View style={{ width: 40 }} />

        {/* Centro: logo + sede */}
        <View style={s.topCenter}>
          <View style={{ width: 30, height: 30, borderRadius: 15, overflow: 'hidden',
                         backgroundColor: sedeCorrente?.color ?? C.muted,
                         alignItems: 'center', justifyContent: 'center' }}>
            {LOGOS[sedeAttiva] ? (
              <Image source={LOGOS[sedeAttiva]} style={{ width: 30, height: 30 }} resizeMode="cover" />
            ) : (
              <Text style={{ color: C.white, fontWeight: '700' }}>
                {(sedeCorrente?.name ?? '?').charAt(0)}
              </Text>
            )}
          </View>
          <Text style={s.topSede}>{sedeCorrente?.name ?? ''}</Text>
        </View>

        {/* Destra: hamburger */}
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={s.menuBtn}>
          <Ionicons name="menu" size={26} color={C.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Header saluto */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Benvenuto/a,</Text>
            <Text style={s.name}>{user?.name}</Text>
            <View style={[s.badge, { backgroundColor: C.babyBlue }]}>
              <Text style={s.badgeText}>Amministratore</Text>
            </View>
          </View>
        </View>

        {/* Sede switcher (solo superadmin) */}
        {isSuperAdmin && (
          <View style={s.sedeRow}>
            {sedi.map(s_ => (
              <TouchableOpacity key={s_.id} onPress={() => updateSede(s_.id)}
                style={[s.sedeBtn, sede === s_.id && { backgroundColor: (s_.color ?? C.primary) + '20', borderColor: s_.color ?? C.primary }]}>
                <Text style={[s.sedeBtnText, { color: sede === s_.id ? (s_.color ?? C.primary) : C.muted }]}>{s_.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { label: 'Utenti',  value: stats.users,    color: C.primary },
            { label: 'Bambini', value: stats.students,  color: C.accentPink },
            { label: 'Classi',  value: stats.classes,   color: C.accentGreen },
          ].map((st, i) => (
            <View key={i} style={[s.statCard, { borderTopColor: st.color, borderTopWidth: 3 }]}>
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Cards */}
        {CARDS.map(card => (
          <TouchableOpacity key={card.id} onPress={() => navigation.navigate(card.tab)}
            style={s.card} activeOpacity={0.9}>
            <View style={[s.iconBox, { backgroundColor: card.bg }]}>
              <Ionicons name={card.icon as any} size={24} color={card.color} />
            </View>
            <Text style={s.cardTitle}>{card.title}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
            <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} navigation={navigation} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting:{ fontSize: 13, color: C.muted, fontWeight: '500' },
  name:   { fontSize: 24, fontWeight: '800', color: C.text, marginTop: 2 },
  badge:  { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  badgeText:{ color: C.white, fontSize: 11, fontWeight: '700' },
  topBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.divider },
  topCenter: { alignItems: 'center', flex: 1 },
  topLogo:   { width: 36, height: 36, borderRadius: 18 },
  topSede:   { fontSize: 10, fontWeight: '700', color: C.muted, marginTop: 2 },
  menuBtn:   { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  sedeRow:{ flexDirection: 'row', gap: 10, marginBottom: 16 },
  sedeBtn:{ flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  sedeBtnText:{ fontSize: 12, fontWeight: '700' },
  statsRow:{ flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:{ flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statValue:{ fontSize: 24, fontWeight: '900' },
  statLabel:{ fontSize: 11, color: C.muted, marginTop: 2, fontWeight: '600' },
  card:   { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, borderWidth: 1, borderColor: C.border },
  iconBox:{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle:{ flex: 1, fontSize: 15, fontWeight: '800', color: C.text },
  white:  C.white,
});
