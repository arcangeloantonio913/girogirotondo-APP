import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, SafeAreaView,
  StatusBar, StyleSheet, ActivityIndicator, Image, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = {
  bg: '#FFFDD0', white: '#FFFFFF', primary: '#4169E1',
  babyBlue: '#A7C7E7', babyPink: '#F4C2C2', babyGreen: '#98FB98',
  text: '#1A202C', muted: '#9CA3AF', gray: '#6B7280',
  border: '#F3F4F6', shadow: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
};

function EmptyBear({ text }: { text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 16 }}>
      <Text style={{ fontSize: 40 }}>🐻</Text>
      <Text style={{ fontSize: 12, color: C.muted, marginTop: 6, fontWeight: '500' }}>{text}</Text>
    </View>
  );
}

function Card({ children, onPress, testID }: any) {
  return (
    <TouchableOpacity onPress={onPress} testID={testID} activeOpacity={0.92}
      style={[s.card, C.shadow]}>
      {children}
    </TouchableOpacity>
  );
}

function CardHeader({ icon, iconBg, iconColor, title, subtitle }: any) {
  return (
    <View style={s.cardHeader}>
      <View style={[s.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={s.cardSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.muted} />
    </View>
  );
}

export default function ParentDashboard({ navigation }: any) {
  const { user, activeChildId } = useAuth();
  const [child,    setChild]    = useState<any>(null);
  const [diary,    setDiary]    = useState<any>(null);
  const [griglia,  setGriglia]  = useState<any>(null);
  const [gallery,  setGallery]  = useState<any[]>([]);
  const [meal,     setMeal]     = useState<any>(null);
  const [className, setClassName] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [childSwitcherOpen, setChildSwitcherOpen] = useState(false);
  const sedeAttiva = user?.sede_id || 'girogirotondo';

  const today = new Date().toISOString().split('T')[0];
  const todayFmt = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });


  useEffect(() => {
    const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;
    if (!childId) { setLoading(false); return; }
    Promise.all([
      api.get(`/students/${childId}`),
      api.get(`/diary?date=${today}`),
      api.get(`/griglia?student_id=${childId}&date=${today}`),
      api.get(`/gallery?student_id=${childId}`),
      api.get(`/meals?date=${today}`),
      api.get('/classes'),
    ]).then(([cR, dR, gR, galR, mR, clR]) => {
      setChild(cR.data);
      setDiary(dR.data?.[0] || null);
      setGriglia(gR.data?.[0] || null);
      setGallery(galR.data || []);
      setMeal(mR.data?.[0] || null);
      const cls = clR.data.find((c: any) => c.id === cR.data?.class_id);
      if (cls) setClassName(cls.name);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user, activeChildId]);

  if (loading) return (
    <SafeAreaView style={s.root}>
      <ActivityIndicator size="large" color={C.babyBlue} style={{ flex: 1 }} />
          {/* Child Switcher Modal */}
      <Modal visible={childSwitcherOpen} transparent animationType="fade" onRequestClose={() => setChildSwitcherOpen(false)}>
        <TouchableOpacity style={s.switOverlay} onPress={() => setChildSwitcherOpen(false)} activeOpacity={1}>
          <View style={s.switSheet}>
            <Text style={s.switTitle}>Seleziona bambino</Text>
            {children.map((ch: any) => {
              const isActive = ch.id === (activeChildId || childIds[0]);
              return (
                <TouchableOpacity key={ch.id} onPress={() => { setActiveChildId(ch.id); setChildSwitcherOpen(false); }}
                  style={[s.switItem, isActive && s.switItemActive]}>
                  <View style={[s.switAvatar, isActive && { backgroundColor: '#32CD32' }]}>
                    <Text style={{ color: isActive ? '#FFF' : '#374151', fontWeight: '800' }}>{ch.name?.charAt(0)}</Text>
                  </View>
                  <Text style={[s.switName, isActive && { color: '#32CD32' }]}>{ch.name} {ch.cognome}</Text>
                  {isActive && <Ionicons name="checkmark-circle" size={20} color="#32CD32" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} navigation={navigation} />
    </SafeAreaView>
  );

  const grigliaItems = griglia ? [
    { label: 'Primo',   active: !!griglia.pasta,   color: C.babyPink },
    { label: 'Secondo', active: !!griglia.secondo,  color: C.babyBlue },
    { label: 'Pane',    active: !!griglia.pane,     color: '#FFD699' },
    { label: 'Frutta',  active: !!griglia.frutta,   color: C.babyGreen },
  ] : [];

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Notifiche')} style={[s.menuBtn, {backgroundColor: '#32CD3218'}]}>
          <Ionicons name="notifications-outline" size={22} color="#32CD32" />
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Image source={sedeAttiva === 'il-magico-mondo' ? require('../../../assets/logo-magico-mondo.png') : require('../../../assets/logo-girogirotondo.png')} style={s.topLogo} resizeMode="contain" />
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
            <Text style={s.greeting}>Bentornato/a,</Text>
            <Text style={s.userName}>{user?.name}</Text>
            {child && (
              <View style={s.childRow}>
                <View style={s.childBadge}>
                  <Text style={s.childBadgeText}>{child.name}</Text>
                </View>
                {!!className && <Text style={s.childClass}>Classe {className}</Text>}
              </View>
            )}
            <Text style={s.dateText}>{todayFmt}</Text>
          </View>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(child?.name || user?.name || '?').charAt(0)}</Text>
          </View>
        </View>

        {/* DIARIO */}
        <Card onPress={() => navigation.navigate('Diario')} testID="parent-card-diario">
          <CardHeader icon="book-outline" iconBg="#EBF0FF" iconColor={C.babyBlue} title="Diario di Bordo" subtitle="Aggiornamento di oggi" />
          {diary
            ? <View style={s.diaryPreview}><Text style={s.diaryText} numberOfLines={3}>{diary.summary || diary.note}</Text></View>
            : <EmptyBear text="La maestra non ha ancora scritto il diario!" />
          }
        </Card>

        {/* GRIGLIA */}
        <Card onPress={() => navigation.navigate('Griglia')} testID="parent-card-griglia">
          <CardHeader icon="grid-outline" iconBg="#FFF0F7" iconColor={C.babyPink} title="Griglia Giornaliera" subtitle={`La giornata di ${child?.name?.split(' ')[0] || 'tuo figlio/a'}`} />
          {grigliaItems.length > 0
            ? <View style={s.grigliaRow}>
                {grigliaItems.map((item, i) => (
                  <View key={i} style={[s.grigliaItem, { backgroundColor: item.active ? item.color + '30' : '#F9FAFB' }]}>
                    <View style={[s.grigliaCircle, { backgroundColor: item.active ? item.color : '#E5E7EB' }]} />
                    <Text style={[s.grigliaLabel, { color: item.active ? '#555' : C.muted }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            : <EmptyBear text="Nessun dato per la griglia oggi!" />
          }
        </Card>

        {/* GALLERY */}
        <View style={[s.card, C.shadow]}>
          <TouchableOpacity onPress={() => navigation.navigate('Foto')} activeOpacity={0.92}>
            <CardHeader icon="images-outline" iconBg="#F0FFF0" iconColor="#32CD32" title="Foto e Video del Giorno" subtitle={`${gallery.length} contenuti disponibili`} />
          </TouchableOpacity>
          {gallery.length > 0
            ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {gallery.slice(0, 6).map((item: any, i: number) => (
                  <TouchableOpacity key={i} onPress={() => navigation.navigate('Foto')} style={s.galleryThumb}>
                    <Image source={{ uri: item.media_url || item.url }} style={s.galleryImg} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            : <EmptyBear text="Nessuna foto oggi!" />
          }
        </View>

        {/* MENSA */}
        <Card onPress={() => navigation.navigate('Dieta')} testID="parent-card-alimentazione">
          <CardHeader icon="restaurant-outline" iconBg="#FFF0F7" iconColor={C.babyPink} title="Alimentazione & Dieta" subtitle="Menu del giorno" />
          {meal
            ? <View style={s.mealGrid}>
                {[
                  { label: 'Primo', value: meal.primo, bg: C.babyPink + '20' },
                  { label: 'Secondo', value: meal.secondo, bg: C.babyBlue + '20' },
                  { label: 'Contorno', value: meal.contorno, bg: C.babyGreen + '20' },
                  { label: 'Frutta', value: meal.frutta, bg: '#FFFBEB' },
                ].map((m, i) => (
                  <View key={i} style={[s.mealItem, { backgroundColor: m.bg }]}>
                    <Text style={s.mealLabel}>{m.label}</Text>
                    <Text style={s.mealValue} numberOfLines={1}>{m.value || '—'}</Text>
                  </View>
                ))}
              </View>
            : <EmptyBear text="Menu non ancora disponibile!" />
          }
        </Card>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* FAB prenotazione */}
      {/* Bottom actions row */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, position: 'absolute', bottom: 80, right: 16 }}>
        <TouchableOpacity style={[s.fab, { backgroundColor: '#FF69B4' }]} onPress={() => navigation.navigate('Notifiche')}>
          <Ionicons name="megaphone-outline" size={22} color={C.white}/>
        </TouchableOpacity>
        <TouchableOpacity style={[s.fab, { backgroundColor: '#A7C7E7' }]} onPress={() => navigation.navigate('Modulistica')}>
          <Ionicons name="document-text-outline" size={22} color={C.white}/>
        </TouchableOpacity>
        <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('Appuntamenti')}>
          <Ionicons name="calendar-outline" size={24} color={C.white}/>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 80 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 13, color: C.muted, fontWeight: '500' },
  userName: { fontSize: 24, fontWeight: '800', color: C.text, marginTop: 2 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  childBadge: { backgroundColor: C.babyBlue, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  childBadgeText: { color: C.white, fontSize: 11, fontWeight: '700' },
  childClass: { fontSize: 11, color: C.gray, fontWeight: '600' },
  dateText: { fontSize: 11, color: C.muted, marginTop: 4, textTransform: 'capitalize' },
  avatar:   { width: 48, height: 48, borderRadius: 24, backgroundColor: C.babyPink, alignItems: 'center', justifyContent: 'center' },
  avatarText:{ color: C.white, fontSize: 18, fontWeight: '800' },
  card:     { backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardHeader:{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconBox:  { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle:{ fontSize: 13, fontWeight: '800', color: C.text },
  cardSubtitle:{ fontSize: 10, color: C.muted, marginTop: 1 },
  diaryPreview:{ backgroundColor: '#EBF0FF30', borderRadius: 12, padding: 12 },
  diaryText:{ fontSize: 12, color: '#374151', lineHeight: 18 },
  grigliaRow:{ flexDirection: 'row', gap: 6 },
  grigliaItem:{ flex: 1, alignItems: 'center', padding: 10, borderRadius: 12 },
  grigliaCircle:{ width: 20, height: 20, borderRadius: 10, marginBottom: 4 },
  grigliaLabel:{ fontSize: 9, fontWeight: '600' },
  galleryThumb:{ width: 112, height: 112, borderRadius: 16, marginRight: 10, overflow: 'hidden' },
  galleryImg:  { width: 112, height: 112 },
  mealGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealItem:   { width: '47%', borderRadius: 12, padding: 10 },
  mealLabel:  { fontSize: 10, color: C.muted, fontWeight: '500' },
  mealValue:  { fontSize: 12, fontWeight: '700', color: C.text, marginTop: 2 },
  fab: { position: 'absolute', bottom: 80, right: 16, width: 52, height: 52, borderRadius: 26, backgroundColor: C.babyBlue, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  childSwitcher: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FFF0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#86EFAC' },
  childSwitcherText: { fontSize: 12, fontWeight: '700', color: '#32CD32' },
  switOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  switSheet:   { backgroundColor: '#FFFDD0', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  switTitle:   { fontSize: 16, fontWeight: '800', color: '#1A202C', marginBottom: 16, textAlign: 'center' },
  switItem:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  switItemActive: { backgroundColor: '#F0FFF0', borderRadius: 12, paddingHorizontal: 10 },
  switAvatar:  { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  switName:    { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A202C' },
  white: C.white,
});
