import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { bg: '#FFFDD0', white: '#FFFFFF', babyBlue: '#A7C7E7', babyPink: '#F4C2C2', babyGreen: '#98FB98', text: '#1A202C', muted: '#9CA3AF', gray: '#6B7280', border: '#F3F4F6' };

const CARDS = [
  { id: 'griglia',  icon: 'grid-outline',       color: '#FF69B4', bg: '#FFF0F7', title: 'Griglia Giornaliera',   sub: 'Gestisci le attività quotidiane', tab: 'Griglia' },
  { id: 'presenze', icon: 'clipboard-outline',  color: '#4169E1', bg: '#EBF0FF', title: 'Registro Presenze',     sub: 'Segna presenze e assenze',         tab: 'Presenze' },
  { id: 'diario',   icon: 'book-outline',       color: '#A7C7E7', bg: '#EBF0FF', title: 'Diario di Bordo',       sub: 'Scrivi il diario della classe',    tab: 'Diario' },
  { id: 'media',    icon: 'camera-outline',     color: '#32CD32', bg: '#F0FFF0', title: 'Carica Media',          sub: 'Aggiungi foto e video',            tab: 'Media' },
  { id: 'avvisi',   icon: 'megaphone-outline',  color: '#FF69B4', bg: '#FFF0F7', title: 'Avvisi',                sub: 'Comunicazioni scuola',             tab: 'Avvisi' },
  { id: 'profilo',  icon: 'person-outline',     color: '#A7C7E7', bg: '#EBF0FF', title: 'Il mio Profilo',        sub: 'Dati account e password',          tab: 'Profilo' },
];

export default function TeacherDashboard({ navigation }: any) {
  const { user, logout } = useAuth();
  const [className, setClassName] = useState('');
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sedeAttiva = user?.sede_id || 'girogirotondo';

  useEffect(() => {
    const classIds = user?.class_ids?.length ? user.class_ids : user?.class_id ? [user.class_id] : [];
    if (!classIds.length) { setLoading(false); return; }
    Promise.all([api.get('/students'), api.get('/classes')]).then(([sR, cR]) => {
      setStudentCount(sR.data?.length || 0);
      const cls = cR.data?.filter((c: any) => classIds.includes(c.id));
      setClassName(cls?.map((c: any) => c.name).join(', ') || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Notifiche')} style={[s.menuBtn, {backgroundColor: '#FF69B418'}]}>
          <Ionicons name="notifications-outline" size={22} color="#FF69B4" />
        </TouchableOpacity>
        <View style={s.topCenter}>
          <View style={{width:28,height:28,borderRadius:14,overflow:'hidden',flexShrink:0}}>
          <Image source={sedeAttiva === 'il-magico-mondo' ? require('../../../assets/logo-magico-mondo.png') : require('../../../assets/logo-girogirotondo.png')} style={{width:28,height:28}} resizeMode="cover" />
        </View>
          <Text style={s.topSede}>{sedeAttiva === 'il-magico-mondo' ? 'Il Magico Mondo' : 'Girogirotondo'}</Text>
        </View>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={s.menuBtn}>
          <Ionicons name="menu" size={26} color={C.text} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Ciao Maestra,</Text>
            <Text style={s.name}>{user?.name}</Text>
            <View style={s.row}>
              <View style={[s.badge, { backgroundColor: C.babyPink }]}>
                <Text style={s.badgeText}>{className ? `Classe ${className}` : 'Nessuna classe'}</Text>
              </View>
              <Text style={s.subText}>{studentCount} alunni</Text>
            </View>
          </View>
        </View>

        {/* Cards */}
        <Text style={s.sectionTitle}>Azioni rapide</Text>
        {CARDS.map(card => (
          <TouchableOpacity key={card.id} onPress={() => navigation.navigate(card.tab)}
            style={s.card} activeOpacity={0.9}>
            <View style={[s.iconBox, { backgroundColor: card.bg }]}>
              <Ionicons name={card.icon as any} size={24} color={card.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{card.title}</Text>
              <Text style={s.cardSub}>{card.sub}</Text>
            </View>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting:{ fontSize: 13, color: C.muted, fontWeight: '500' },
  name:   { fontSize: 24, fontWeight: '800', color: C.text, marginTop: 2 },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  badge:  { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText:{ color: C.white, fontSize: 11, fontWeight: '700' },
  subText:{ fontSize: 12, color: C.gray, fontWeight: '600' },
  logoutBtn:{ padding: 8 },
  sectionTitle:{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  card:   { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, borderWidth: 1, borderColor: C.border },
  iconBox:{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle:{ fontSize: 14, fontWeight: '800', color: C.text },
  cardSub:{ fontSize: 11, color: C.muted, marginTop: 2 },
  topBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, height: 52, backgroundColor: '#FFFFFF', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  topCenter: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  topLogo:   { width: 28, height: 28, borderRadius: 14 },
  topSede:   { fontSize: 13, fontWeight: '700', color: '#1A202C' },
  menuBtn:   { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  white:  C.white,
});

