import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };

const PIATTI = [
  { key: 'merenda_mattina',    label: 'Merenda mattina',    icon: '☕', bg: '#FFF7E6', color: '#F59E0B' },
  { key: 'primo',              label: 'Primo piatto',       icon: '🍝', bg: '#FFF0F7', color: '#FF69B4' },
  { key: 'secondo',            label: 'Secondo piatto',     icon: '🍗', bg: '#EBF0FF', color: '#4169E1' },
  { key: 'contorno',           label: 'Contorno',           icon: '🥗', bg: '#F0FFF0', color: '#32CD32' },
  { key: 'frutta',             label: 'Frutta',             icon: '🍎', bg: '#FEF2F2', color: '#EF4444' },
  { key: 'merenda_pomeriggio', label: 'Merenda pomeriggio', icon: '🍪', bg: '#F5F3FF', color: '#8B5CF6' },
];

function addDays(d: string, n: number) {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n);
  return dt.toISOString().split('T')[0];
}

export default function ParentDieta() {
  const [date,  setDate]  = useState(new Date().toISOString().split('T')[0]);
  const [meal,  setMeal]  = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/meals?date=${date}`)
      .then(r => setMeal(r.data?.[0] || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <ScreenLayout title="Menu Mensa" showBack color={C.babyGreen} loading={loading}>
      <View style={{ padding: 16 }}>
        {/* Date nav */}
        <View style={s.dateNav}>
          <TouchableOpacity onPress={() => setDate(addDays(date, -1))} style={s.navBtn}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={s.dateText}>{new Date(date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          <TouchableOpacity onPress={() => setDate(addDays(date, 1))} style={s.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={C.text} />
          </TouchableOpacity>
        </View>

        {!meal
          ? <View style={s.empty}><Text style={{ fontSize: 48 }}>🍽️</Text><Text style={s.emptyText}>Menu non disponibile per questo giorno</Text></View>
          : PIATTI.map(p => (
              <View key={p.key} style={[s.row, { backgroundColor: p.bg, borderColor: p.bg }]}>
                <Text style={s.rowIcon}>{p.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowLabel, { color: p.color }]}>{p.label}</Text>
                  <Text style={s.rowValue}>{meal[p.key] || '—'}</Text>
                </View>
              </View>
            ))
        }
      </View>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  dateNav:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, backgroundColor: C.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border },
  navBtn:   { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dateText: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1, textAlign: 'center', textTransform: 'capitalize' },
  empty:    { alignItems: 'center', paddingTop: 60 },
  emptyText:{ fontSize: 14, color: C.muted, marginTop: 12, textAlign: 'center' },
  row:      { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1 },
  rowIcon:  { fontSize: 28, marginRight: 14 },
  rowLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { fontSize: 15, fontWeight: '600', color: C.text, marginTop: 2 },
});
