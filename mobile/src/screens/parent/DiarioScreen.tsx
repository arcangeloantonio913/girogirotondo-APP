import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const TODAY = new Date().toISOString().split('T')[0];

export default function ParentDiario() {
  const { activeChildId, user } = useAuth();
  const [entries, setEntries]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;

  useEffect(() => {
    if (!childId) { setLoading(false); return; }
    api.get(`/diary?student_id=${childId}`)
      .then(r => setEntries(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId]);

  if (loading) return <ScreenLayout title="Diario di Bordo" loading />;

  return (
    <ScreenLayout title="Diario di Bordo" scrollable={false}>
      {entries.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <Ionicons name="book-outline" size={64} color="#E5E7EB" />
          <Text style={{ color: '#9CA3AF', marginTop: 12, fontSize: 15 }}>Nessuna nota disponibile</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const isToday = item.date === TODAY;
            return (
              <View style={{
                backgroundColor: isToday ? '#EBF0FF' : '#FFF',
                borderRadius: 16, padding: 16,
                borderLeftWidth: isToday ? 4 : 0, borderLeftColor: '#4169E1',
                shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isToday ? '#4169E1' : '#9CA3AF', textTransform: 'capitalize' }}>
                    {new Date(item.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </Text>
                  {isToday && (
                    <View style={{ backgroundColor: '#4169E1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>OGGI</Text>
                    </View>
                  )}
                </View>
                {item.mood && <Text style={{ fontSize: 28, marginBottom: 6 }}>{item.mood}</Text>}
                {item.activities && item.activities.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {item.activities.map((a: string, i: number) => (
                      <View key={i} style={{ backgroundColor: '#EBF0FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 12, color: '#4169E1', fontWeight: '600' }}>{a}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {item.note && (
                  <Text style={{ fontSize: 14, color: '#374151', lineHeight: 20 }}>{item.note}</Text>
                )}
              </View>
            );
          }}
        />
      )}
    </ScreenLayout>
  );
}
