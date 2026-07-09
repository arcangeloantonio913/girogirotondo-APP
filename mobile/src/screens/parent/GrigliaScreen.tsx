import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };

const QTY_MAP: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  tutto:         { label: 'Tutto',         color: '#065F46', bg: '#D1FAE5', emoji: '😋' },
  bis:           { label: 'Bis',           color: '#065F46', bg: '#A7F3D0', emoji: '🥰' },
  'metà':        { label: 'Metà',          color: '#854D0E', bg: '#FEF9C3', emoji: '🙂' },
  mangiata_poca: { label: 'Mangiata poca', color: '#991B1B', bg: '#FEE2E2', emoji: '😐' },
  lasciata_poca: { label: 'Lasciata',      color: '#7F1D1D', bg: '#FECACA', emoji: '😕' },
  no:            { label: 'Non mangiato',  color: '#64748B', bg: '#F1F5F9', emoji: '😶' },
};

const TIMELINE = [
  { key: 'merenda_mattina',    label: 'Merenda mattina',    icon: '☕', time: '09:30', type: 'meal' },
  { key: 'pasta',              label: 'Pasta / Primo',      icon: '🍝', time: '12:00', type: 'meal' },
  { key: 'secondo',            label: 'Secondo',            icon: '🍗', time: '12:15', type: 'meal' },
  { key: 'pane',               label: 'Pane',               icon: '🍞', time: '12:25', type: 'meal' },
  { key: 'frutta',             label: 'Frutta',             icon: '🍎', time: '12:35', type: 'meal' },
  { key: 'merenda_pomeriggio', label: 'Merenda pomeriggio', icon: '🍪', time: '15:30', type: 'meal' },
  { key: 'pupù',               label: 'Pupù',               icon: '💩', time: '',      type: 'bool' },
  { key: 'nanna',              label: 'Nanna / Riposo',     icon: '😴', time: '13:00', type: 'bool' },
];

function addDays(d: string, n: number) {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n);
  return dt.toISOString().split('T')[0];
}

export default function ParentGriglia() {
  const { activeChildId, user } = useAuth();
  const [date,   setDate]   = useState(new Date().toISOString().split('T')[0]);
  const [griglia,setGriglia]= useState<any>(null);
  const [loading,setLoading]= useState(true);
  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!childId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/griglia?student_id=${childId}&date=${date}`)
      .then(r => setGriglia(r.data?.[0] || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId, date]);

  return (
    <ScreenLayout title="Griglia Giornaliera" showBack color={C.babyPink} loading={loading}>
      <View style={{ padding: 14 }}>
        {/* Date nav */}
        <View style={s.dateNav}>
          <TouchableOpacity onPress={() => setDate(addDays(date, -1))} style={s.navBtn}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={s.dateText}>{new Date(date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            {date === today && <View style={s.todayBadge}><Text style={s.todayText}>Oggi</Text></View>}
          </View>
          <TouchableOpacity onPress={() => setDate(addDays(date, 1))} style={s.navBtn} disabled={date >= today}>
            <Ionicons name="chevron-forward" size={20} color={date >= today ? C.muted : C.text} />
          </TouchableOpacity>
        </View>

        {!griglia ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 52 }}>📋</Text>
            <Text style={s.emptyTitle}>Nessun dato per oggi</Text>
            <Text style={s.emptySub}>La maestra non ha ancora inserito la griglia</Text>
          </View>
        ) : (
          <>
            {/* Timeline pasti */}
            <Text style={s.sectionLabel}>Pasti del giorno</Text>
            {TIMELINE.filter(t => t.type === 'meal').map((item, i) => {
              const val = griglia[item.key];
              const info = val ? QTY_MAP[val] : null;
              return (
                <View key={i} style={s.timelineRow}>
                  {/* Linea verticale + dot */}
                  <View style={s.timeline}>
                    {i > 0 && <View style={s.timelineLine} />}
                    <View style={[s.timelineDot, info ? { backgroundColor: info.color } : {}]} />
                  </View>
                  {/* Contenuto */}
                  <View style={s.timelineContent}>
                    {item.time && <Text style={s.timeText}>{item.time}</Text>}
                    <View style={s.mealRow}>
                      <Text style={{ fontSize: 22, width: 32 }}>{item.icon}</Text>
                      <Text style={s.mealLabel}>{item.label}</Text>
                      {info ? (
                        <View style={[s.qtyBadge, { backgroundColor: info.bg }]}>
                          <Text style={{ fontSize: 14 }}>{info.emoji}</Text>
                          <Text style={[s.qtyText, { color: info.color }]}>{info.label}</Text>
                        </View>
                      ) : (
                        <Text style={s.noData}>—</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Pupù e Nanna */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>Altre attività</Text>
            <View style={s.boolGrid}>
              {TIMELINE.filter(t => t.type === 'bool').map((item, i) => {
                const val = griglia[item.key];
                return (
                  <View key={i} style={[s.boolCard, val && s.boolCardActive]}>
                    <Text style={{ fontSize: 32 }}>{item.icon}</Text>
                    <Text style={[s.boolLabel, val && { color: C.babyPink }]}>{item.label}</Text>
                    <View style={[s.boolStatus, { backgroundColor: val ? '#FFF0F7' : '#F9FAFB' }]}>
                      <Ionicons name={val ? 'checkmark-circle' : 'close-circle-outline'} size={18}
                        color={val ? '#FF69B4' : C.muted} />
                      <Text style={[s.boolStatusText, { color: val ? '#FF69B4' : C.muted }]}>
                        {val ? 'Sì' : 'No'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Note maestra */}
            {griglia.notes && (
              <View style={s.notesBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Ionicons name="chatbubble-outline" size={14} color="#92400E" />
                  <Text style={s.notesTitle}>Note della maestra</Text>
                </View>
                <Text style={s.notesText}>{griglia.notes}</Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  dateNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 0.5, borderColor: C.border },
  navBtn:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dateText:      { fontSize: 14, fontWeight: '700', color: C.text, textTransform: 'capitalize', textAlign: 'center' },
  todayBadge:    { backgroundColor: C.babyPink, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  todayText:     { fontSize: 10, color: C.white, fontWeight: '700' },
  empty:         { alignItems: 'center', paddingTop: 50 },
  emptyTitle:    { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 14 },
  emptySub:      { fontSize: 13, color: C.muted, marginTop: 6, textAlign: 'center' },
  sectionLabel:  { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  timelineRow:   { flexDirection: 'row', marginBottom: 2 },
  timeline:      { width: 24, alignItems: 'center' },
  timelineLine:  { width: 2, flex: 1, backgroundColor: '#F3F4F6', marginBottom: -4 },
  timelineDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB', marginVertical: 4 },
  timelineContent:{ flex: 1, paddingLeft: 10, paddingBottom: 8 },
  timeText:      { fontSize: 10, color: C.muted, fontWeight: '600', marginBottom: 2 },
  mealRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, padding: 10, borderWidth: 0.5, borderColor: C.border },
  mealLabel:     { flex: 1, fontSize: 13, fontWeight: '600', color: C.text, marginLeft: 4 },
  qtyBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  qtyText:       { fontSize: 12, fontWeight: '700' },
  noData:        { fontSize: 16, color: '#D1D5DB', fontWeight: '500' },
  boolGrid:      { flexDirection: 'row', gap: 10 },
  boolCard:      { flex: 1, alignItems: 'center', backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: C.border },
  boolCardActive:{ borderColor: '#FF69B4', backgroundColor: '#FFF0F7' },
  boolLabel:     { fontSize: 12, fontWeight: '700', color: C.text, marginTop: 6, marginBottom: 8, textAlign: 'center' },
  boolStatus:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  boolStatusText:{ fontSize: 12, fontWeight: '700' },
  notesBox:      { marginTop: 14, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: '#FEF3C7' },
  notesTitle:    { fontSize: 12, fontWeight: '700', color: '#92400E' },
  notesText:     { fontSize: 13, color: '#78350F', lineHeight: 20 },
});
