import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import ScreenLayout from '../../components/layout/ScreenLayout';
import api from '../../lib/api';

const C = { babyPink: '#F4C2C2', text: '#1A202C', muted: '#9CA3AF', white: '#FFFFFF', border: '#F3F4F6' };

export default function ParentAvvisi() {
  const [avvisi, setAvvisi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/avvisi').then(r => setAvvisi(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <ScreenLayout title="Avvisi" showBack color={C.babyPink} loading={loading} scrollable={false}>
      <FlatList
        data={avvisi}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 48 }}>📢</Text><Text style={s.emptyText}>Nessun avviso al momento</Text></View>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={s.badge}><Text style={s.badgeText}>{item.type || 'Avviso'}</Text></View>
              <Text style={s.date}>{new Date(item.created_at || item.date).toLocaleDateString('it-IT')}</Text>
            </View>
            <Text style={s.cardTitle}>{item.title}</Text>
            {item.body && <Text style={s.cardBody}>{item.body}</Text>}
          </View>
        )}
      />
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  empty:    { alignItems: 'center', paddingTop: 80 },
  emptyText:{ fontSize: 14, color: C.muted, marginTop: 12 },
  card:     { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badge:    { backgroundColor: C.babyPink + '40', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:{ fontSize: 10, fontWeight: '700', color: '#BE185D' },
  date:     { fontSize: 11, color: C.muted },
  cardTitle:{ fontSize: 14, fontWeight: '700', color: C.text },
  cardBody: { fontSize: 12, color: '#374151', lineHeight: 18, marginTop: 4 },
});
