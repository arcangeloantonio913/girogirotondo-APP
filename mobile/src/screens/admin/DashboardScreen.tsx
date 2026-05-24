import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import DashboardHeader from '../../components/layout/DashboardHeader';
import api from '../../lib/api';

const C = { bg: '#FFFDD0', white: '#FFFFFF', primary: '#4169E1', babyBlue: '#A7C7E7', babyPink: '#F4C2C2', babyGreen: '#98FB98', text: '#1A202C', muted: '#9CA3AF', gray: '#6B7280', border: '#F3F4F6' };

const SEDI = [
  { id: 'girogirotondo',    label: 'Girogirotondo',   color: C.primary },
  { id: 'il-magico-mondo',  label: 'Il Magico Mondo', color: '#FF69B4' },
];

const CARDS = [
  { id: 'users',         icon: 'people-outline',         color: C.primary,  bg: '#EBF0FF', title: 'Gestione Utenti', tab: 'Utenti' },
  { id: 'presenze',      icon: 'clipboard-outline',      color: '#FF9500',  bg: '#FFF7E6', title: 'Presenze',        tab: 'Presenze' },
  { id: 'classi',        icon: 'book-outline',           color: C.babyBlue, bg: '#EBF0FF', title: 'Classi',          tab: 'Classi' },
  { id: 'mensa',         icon: 'restaurant-outline',     color: '#32CD32',  bg: '#F0FFF0', title: 'Menu Mensa',      tab: 'Mensa' },
  { id: 'avvisi',        icon: 'megaphone-outline',      color: '#FF69B4',  bg: '#FFF0F7', title: 'Avvisi',          tab: 'Avvisi' },
  { id: 'appuntamenti',  icon: 'calendar-outline',       color: C.primary,  bg: '#EBF0FF', title: 'Appuntamenti',    tab: 'Appuntamenti' },
  { id: 'modulistica',   icon: 'document-text-outline',  color: '#FF9500',  bg: '#FFF7E6', title: 'Modulistica',     tab: 'Modulistica' },
  { id: 'profilo',       icon: 'person-outline',         color: C.babyBlue, bg: '#EBF0FF', title: 'Il mio Profilo',  tab: 'Profilo' },
];

export default function AdminDashboard({ navigation }: any) {
  const { user, sede, updateSede, logout, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState({ users: 0, students: 0, classes: 0 });

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/students'), api.get('/classes')])
      .then(([uR, sR, cR]) => setStats({ users: uR.data?.length || 0, students: sR.data?.length || 0, classes: cR.data?.length || 0 }))
      .catch(() => {});
  }, [sede]);

  return (
    <SafeAreaView style={s.root}>
      <DashboardHeader navigation={navigation}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Benvenuto/a,</Text>
            <Text style={s.name}>{user?.name}</Text>
            <View style={[s.badge, { backgroundColor: C.babyBlue }]}>
              <Text style={s.badgeText}>Amministratore</Text>
            </View>
          </View>
          <TouchableOpacity onPress={logout} style={s.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={C.muted} />
          </TouchableOpacity>
        </View>

        {/* Sede switcher (solo superadmin) */}
        {isSuperAdmin && (
          <View style={s.sedeRow}>
            {SEDI.map(s_ => (
              <TouchableOpacity key={s_.id} onPress={() => updateSede(s_.id)}
                style={[s.sedeBtn, sede === s_.id && { backgroundColor: s_.color + '20', borderColor: s_.color }]}>
                <Text style={[s.sedeBtnText, { color: sede === s_.id ? s_.color : C.muted }]}>{s_.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { label: 'Utenti',  value: stats.users,    color: C.primary },
            { label: 'Bambini', value: stats.students,  color: '#FF69B4' },
            { label: 'Classi',  value: stats.classes,   color: '#32CD32' },
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
      </DashboardHeader>
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
  logoutBtn:{ padding: 8 },
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
