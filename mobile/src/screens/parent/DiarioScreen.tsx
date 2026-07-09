import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };

const MOOD_LABELS: Record<string, string> = {
  '😊':'Felice','😢':'Triste','😴':'Assonnato','🤒':'Non si sentiva bene',
  '😤':'Agitato','🎉':'Festoso','😍':'Entusiasta','😮':'Sorpreso',
};

function addDays(d: string, n: number) {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n);
  return dt.toISOString().split('T')[0];
}

export default function ParentDiario() {
  const { activeChildId, user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0]);
  const [viewAll, setViewAll] = useState(false);

  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;

  useEffect(() => {
    if (!childId) { setLoading(false); return; }
    const url = viewAll
      ? `/diary?student_id=${childId}`
      : `/diary?student_id=${childId}&date=${date}`;
    setLoading(true);
    api.get(url)
      .then(r => setEntries(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId, date, viewAll]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <ScreenLayout title="Diario di Bordo" showBack color={C.babyBlue} loading={loading} scrollable={false}>
      {/* Toggle: giorno singolo / storico completo */}
      <View style={s.modeRow}>
        <TouchableOpacity onPress={() => setViewAll(false)}
          style={[s.modeBtn, !viewAll && s.modeBtnActive]}>
          <Ionicons name="today-outline" size={14} color={!viewAll ? C.white : C.muted} />
          <Text style={[s.modeBtnText, !viewAll && { color: C.white }]}>Giorno</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setViewAll(true)}
          style={[s.modeBtn, viewAll && s.modeBtnActive]}>
          <Ionicons name="list-outline" size={14} color={viewAll ? C.white : C.muted} />
          <Text style={[s.modeBtnText, viewAll && { color: C.white }]}>Tutto lo storico</Text>
        </TouchableOpacity>
      </View>

      {/* Navigazione data (solo in modalità giorno) */}
      {!viewAll && (
        <View style={s.dateNav}>
          <TouchableOpacity onPress={() => setDate(addDays(date, -1))} style={s.navBtn}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.dateText}>
              {new Date(date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            {date === today && <View style={s.todayBadge}><Text style={s.todayText}>Oggi</Text></View>}
          </View>
          <TouchableOpacity onPress={() => setDate(addDays(date, 1))} style={s.navBtn}
            disabled={date >= today}>
            <Ionicons name="chevron-forward" size={20} color={date >= today ? C.muted : C.text} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={entries}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 52 }}>📓</Text>
            <Text style={s.emptyTitle}>Nessuna voce nel diario</Text>
            <Text style={s.emptySub}>{viewAll ? 'Non ci sono ancora voci' : 'La maestra non ha ancora scritto per oggi'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const entryDate = new Date((item.date || item.created_at) + 'T12:00:00');
          const isToday = (item.date || '') === today;
          return (
            <View style={[s.card, isToday && s.cardToday]}>
              {/* Header card */}
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardDate, isToday && { color: C.babyBlue }]}>
                    {isToday ? '📅 Oggi — ' : ''}{entryDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </Text>
                </View>
                {item.mood && (
                  <View style={s.moodBox}>
                    <Text style={{ fontSize: 26 }}>{item.mood}</Text>
                    {MOOD_LABELS[item.mood] && (
                      <Text style={s.moodLabel}>{MOOD_LABELS[item.mood]}</Text>
                    )}
                  </View>
                )}
              </View>

              {/* Attività */}
              {item.activities?.length > 0 && (
                <View style={s.activitiesRow}>
                  {item.activities.map((a: string, i: number) => (
                    <View key={i} style={s.actTag}>
                      <Text style={s.actTagText}>{a}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Nota / Summary */}
              {(item.note || item.summary) && (
                <View style={s.noteBox}>
                  <Text style={s.noteText}>{item.note || item.summary}</Text>
                </View>
              )}
            </View>
          );
        }}
      />
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  modeRow:      { flexDirection: 'row', margin: 12, backgroundColor: C.white, borderRadius: 12, padding: 4, borderWidth: 0.5, borderColor: C.border },
  modeBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10 },
  modeBtnActive:{ backgroundColor: C.babyBlue },
  modeBtnText:  { fontSize: 13, fontWeight: '600', color: C.muted },
  dateNav:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8 },
  navBtn:       { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dateText:     { fontSize: 14, fontWeight: '700', color: C.text, textTransform: 'capitalize', textAlign: 'center' },
  todayBadge:   { backgroundColor: C.babyBlue, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  todayText:    { fontSize: 10, color: C.white, fontWeight: '700' },
  empty:        { alignItems: 'center', paddingTop: 60 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 14 },
  emptySub:     { fontSize: 13, color: C.muted, marginTop: 6, textAlign: 'center' },
  card:         { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardToday:    { borderColor: C.babyBlue, borderWidth: 1.5 },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardDate:     { fontSize: 13, fontWeight: '700', color: C.text, textTransform: 'capitalize' },
  moodBox:      { alignItems: 'center', minWidth: 60 },
  moodLabel:    { fontSize: 9, color: C.muted, marginTop: 2, textAlign: 'center', maxWidth: 60 },
  activitiesRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  actTag:       { backgroundColor: '#EBF0FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  actTagText:   { fontSize: 11, color: C.babyBlue, fontWeight: '700' },
  noteBox:      { backgroundColor: '#F8FBFF', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: C.babyBlue, borderRadius: 0 },
  noteText:     { fontSize: 13, color: '#374151', lineHeight: 20 },
});
