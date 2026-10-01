import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };

// Vista SOLA LETTURA delle presenze del proprio figlio (per i genitori).
// Usa activeChildId (selettore figlio nella home) → nessuna confusione tra più figli.
export default function ParentPresenze() {
  const { activeChildId, user } = useAuth();
  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;
  const [rows, setRows]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const mese = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (!childId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/presenze?student_id=${childId}&mese=${mese}`)
      .then(r => {
        const data = (r.data || []).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
        setRows(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId]);

  const presenti = rows.filter(r => r.presente).length;
  const assenti  = rows.length - presenti;

  return (
    <ScreenLayout title="Presenze" showBack color={C.primary} loading={loading} scrollable={false}>
      {/* Riepilogo mese */}
      <View style={s.summary}>
        <Text style={s.summaryMonth}>{now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</Text>
        <View style={s.summaryRow}>
          <View style={[s.badge, { backgroundColor: `${C.accentGreen}1a` }]}>
            <Text style={[s.badgeTxt, { color: C.accentGreen }]}>✓ {presenti} presenze</Text>
          </View>
          <View style={[s.badge, { backgroundColor: `${C.red}1a` }]}>
            <Text style={[s.badgeTxt, { color: C.red }]}>✗ {assenti} assenze</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 42 }}>🗓️</Text>
            <Text style={s.emptyTxt}>Nessuna presenza registrata questo mese</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={[s.dot, { backgroundColor: item.presente ? C.accentGreen : C.red }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.date}>
                {new Date((item.date || '') + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              {!item.presente && !!item.nota && <Text style={s.nota}>{item.nota}</Text>}
            </View>
            <View style={[s.pill, { backgroundColor: item.presente ? `${C.accentGreen}1a` : `${C.red}1a` }]}>
              <Ionicons name={item.presente ? 'checkmark' : 'close'} size={14} color={item.presente ? C.accentGreen : C.red} />
              <Text style={[s.pillTxt, { color: item.presente ? C.accentGreen : C.red }]}>
                {item.presente ? 'Presente' : 'Assente'}
              </Text>
            </View>
          </View>
        )}
      />
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  summary:      { padding: 14, backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
  summaryMonth: { fontSize: 14, fontWeight: '800', color: C.text, textTransform: 'capitalize', marginBottom: 8 },
  summaryRow:   { flexDirection: 'row', gap: 10 },
  badge:        { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  badgeTxt:     { fontSize: 13, fontWeight: '700' },
  empty:        { alignItems: 'center', paddingTop: 50 },
  emptyTxt:     { fontSize: 14, color: C.muted, marginTop: 12, textAlign: 'center' },
  card:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 0.5, borderColor: C.border },
  dot:          { width: 10, height: 10, borderRadius: 5 },
  date:         { fontSize: 14, fontWeight: '700', color: C.text, textTransform: 'capitalize' },
  nota:         { fontSize: 12, color: C.muted, marginTop: 2 },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  pillTxt:      { fontSize: 12, fontWeight: '700' },
});
