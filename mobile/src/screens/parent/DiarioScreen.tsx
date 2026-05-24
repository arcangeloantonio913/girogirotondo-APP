import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { babyBlue: '#A7C7E7', babyPink: '#F4C2C2', text: '#1A202C', muted: '#9CA3AF', white: '#FFFFFF', border: '#F3F4F6', bg: '#EBF0FF' };

export default function ParentDiario() {
  const { activeChildId, user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;

  useEffect(() => {
    if (!childId) { setLoading(false); return; }
    api.get(`/diary?student_id=${childId}`)
      .then(r => setEntries(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId]);

  return (
    <ScreenLayout title="Diario di Bordo" showBack color={C.babyBlue} loading={loading} scrollable={false}>
      <FlatList
        data={entries}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>📓</Text>
            <Text style={s.emptyText}>Nessuna nota nel diario</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <Text style={{ fontSize: 28 }}>{item.mood || '😊'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.date}>{new Date(item.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
                {item.activities?.length > 0 && (
                  <View style={s.tagsRow}>
                    {item.activities.map((a: string, i: number) => (
                      <View key={i} style={s.tag}><Text style={s.tagText}>{a}</Text></View>
                    ))}
                  </View>
                )}
              </View>
            </View>
            {(item.summary || item.note) && (
              <View style={s.noteBox}>
                <Text style={s.noteText}>{item.summary || item.note}</Text>
              </View>
            )}
          </View>
        )}
      />
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  empty:    { alignItems: 'center', paddingTop: 80 },
  emptyText:{ fontSize: 14, color: C.muted, marginTop: 12 },
  card:     { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop:  { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 8 },
  date:     { fontSize: 13, fontWeight: '700', color: C.text, textTransform: 'capitalize' },
  tagsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag:      { backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  tagText:  { fontSize: 10, color: C.babyBlue, fontWeight: '600' },
  noteBox:  { backgroundColor: '#EBF0FF30', borderRadius: 10, padding: 10 },
  noteText: { fontSize: 12, color: '#374151', lineHeight: 18 },
});
