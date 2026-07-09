import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };

export default function NotificheScreen() {
  const { user } = useAuth();
  const [avvisi,     setAvvisi]     = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const role = user?.role || 'parent';
  const accentColor = role === 'teacher' ? C.accentPink : C.babyBlue;

  const load = async () => {
    try {
      const res = await api.get('/avvisi');
      setAvvisi(res.data || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <ScreenLayout title="Avvisi & Notifiche" showBack color={accentColor} loading={loading} scrollable={false}>
      <FlatList
        data={avvisi}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={accentColor} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 52 }}>🔔</Text>
            <Text style={s.emptyTitle}>Nessuna notifica</Text>
            <Text style={s.emptySub}>Qui appariranno avvisi, aggiornamenti e comunicazioni dalla scuola</Text>
          </View>
        }
        renderItem={({ item }) => {
          const dateStr = item.created_at
            ? new Date(item.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
            : '';
          return (
            <View style={s.card}>
              <View style={s.iconBox}><Ionicons name="megaphone-outline" size={20} color={accentColor} /></View>
              <View style={{ flex: 1 }}>
                <View style={s.row}><Text style={s.title} numberOfLines={1}>{item.title}</Text><Text style={s.date}>{dateStr}</Text></View>
                {(item.body || item.message) && <Text style={s.body} numberOfLines={3}>{item.body || item.message}</Text>}
                {item.attachment_name && (
                  <View style={s.attach}><Ionicons name="attach-outline" size={12} color={C.muted} /><Text style={s.attachText}>{item.attachment_name}</Text></View>
                )}
                <Text style={s.author}>{item.author_name ? `da ${item.author_name}` : ''}</Text>
              </View>
            </View>
          );
        }}
      />
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  empty:     { alignItems: 'center', paddingTop: 70 },
  emptyTitle:{ fontSize: 18, fontWeight: '700', color: C.text, marginTop: 14 },
  emptySub:  { fontSize: 13, color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },
  card:      { flexDirection: 'row', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: C.border },
  iconBox:   { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EBF0FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  title:     { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  date:      { fontSize: 10, color: C.muted, marginTop: 2 },
  body:      { fontSize: 12, color: '#374151', lineHeight: 18, marginBottom: 4 },
  attach:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  attachText:{ fontSize: 11, color: C.muted },
  author:    { fontSize: 10, color: C.muted },
});
