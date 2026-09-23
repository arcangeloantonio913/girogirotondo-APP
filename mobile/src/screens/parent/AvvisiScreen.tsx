import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import api from '../../lib/api';
import { openFileUrl } from '../../lib/openFile';
import { formatItDate } from '../../lib/dates';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };

async function openAttachment(url?: string, name?: string) {
  if (!url) return;
  try { await openFileUrl(url, name); }
  catch { Alert.alert('Errore', 'Impossibile aprire l\'allegato.'); }
}

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
              <Text style={s.date}>{formatItDate(item.created_at || item.date)}</Text>
            </View>
            <Text style={s.cardTitle}>{item.titolo || item.title}</Text>
            {(item.testo || item.body) && <Text style={s.cardBody}>{item.testo || item.body}</Text>}
            {item.attachment_name && (
              <TouchableOpacity onPress={() => openAttachment(item.attachment_url, item.attachment_name)}
                style={s.attachChip}>
                <Ionicons name="attach-outline" size={14} color="#BE185D" />
                <Text style={s.attachChipText} numberOfLines={1}>{item.attachment_name}</Text>
              </TouchableOpacity>
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
  card:     { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badge:    { backgroundColor: C.babyPink + '40', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:{ fontSize: 10, fontWeight: '700', color: '#BE185D' },
  date:     { fontSize: 11, color: C.muted },
  cardTitle:{ fontSize: 14, fontWeight: '700', color: C.text },
  cardBody: { fontSize: 12, color: '#374151', lineHeight: 18, marginTop: 4 },
  attachChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start', backgroundColor: C.babyPink + '30', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '95%' },
  attachChipText: { fontSize: 12, color: '#BE185D', fontWeight: '600', flexShrink: 1 },
});
