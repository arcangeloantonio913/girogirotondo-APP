import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { babyPink: '#F4C2C2', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6' };

const QTY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  tutto:         { label: 'Tutto',         color: '#166534', bg: '#DCFCE7' },
  bis:           { label: 'Bis',           color: '#065F46', bg: '#D1FAE5' },
  'metà':        { label: 'Metà',          color: '#854D0E', bg: '#FEF9C3' },
  mangiata_poca: { label: 'Mangiata poca', color: '#991B1B', bg: '#FEE2E2' },
  lasciata_poca: { label: 'Lasciata poca', color: '#7F1D1D', bg: '#FECACA' },
  no:            { label: 'Non mangiato',  color: '#64748B', bg: '#F1F5F9' },
};

const ROWS = [
  { key: 'merenda_mattina',    label: 'Merenda mattina',    icon: '☕' },
  { key: 'primo',              label: 'Primo',              icon: '🍝' },
  { key: 'secondo',            label: 'Secondo',            icon: '🍗' },
  { key: 'contorno',           label: 'Contorno',           icon: '🥗' },
  { key: 'frutta',             label: 'Frutta',             icon: '🍎' },
  { key: 'merenda_pomeriggio', label: 'Merenda pomeriggio', icon: '🍪' },
];

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export default function ParentGriglia() {
  const { activeChildId, user } = useAuth();
  const [date,   setDate]   = useState(new Date().toISOString().split('T')[0]);
  const [griglia, setGriglia] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;

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
      <View style={s.scroll}>
        {/* Date nav */}
        <View style={s.dateNav}>
          <TouchableOpacity onPress={() => setDate(addDays(date, -1))} style={s.navBtn}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={s.dateText}>{new Date(date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          <TouchableOpacity onPress={() => setDate(addDays(date, 1))} style={s.navBtn}
            disabled={date >= new Date().toISOString().split('T')[0]}>
            <Ionicons name="chevron-forward" size={20} color={date >= new Date().toISOString().split('T')[0] ? C.muted : C.text} />
          </TouchableOpacity>
        </View>

        {!griglia
          ? <View style={s.empty}><Text style={{ fontSize: 48 }}>📋</Text><Text style={s.emptyText}>Nessun dato per questo giorno</Text></View>
          : ROWS.map(row => {
              const qty = griglia[row.key];
              const info = QTY_MAP[qty];
              return (
                <View key={row.key} style={s.row}>
                  <Text style={s.rowIcon}>{row.icon}</Text>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  {info
                    ? <View style={[s.qtyBadge, { backgroundColor: info.bg }]}>
                        <Text style={[s.qtyText, { color: info.color }]}>{info.label}</Text>
                      </View>
                    : <Text style={s.noData}>—</Text>
                  }
                </View>
              );
            })
        }
        {griglia?.notes && (
          <View style={s.noteBox}>
            <Text style={s.noteTitle}>Note maestra:</Text>
            <Text style={s.noteText}>{griglia.notes}</Text>
          </View>
        )}
      </View>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  scroll:   { padding: 16 },
  dateNav:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, backgroundColor: C.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border },
  navBtn:   { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dateText: { fontSize: 14, fontWeight: '700', color: C.text, textTransform: 'capitalize', flex: 1, textAlign: 'center' },
  empty:    { alignItems: 'center', paddingTop: 60 },
  emptyText:{ fontSize: 14, color: C.muted, marginTop: 12 },
  row:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  rowIcon:  { fontSize: 22, marginRight: 10 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  qtyBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  qtyText:  { fontSize: 12, fontWeight: '700' },
  noData:   { fontSize: 16, color: C.muted },
  noteBox:  { backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#FEF3C7' },
  noteTitle:{ fontSize: 12, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  noteText: { fontSize: 13, color: '#78350F', lineHeight: 18 },
});
