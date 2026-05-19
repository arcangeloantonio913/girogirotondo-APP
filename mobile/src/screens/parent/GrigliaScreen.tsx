import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const TODAY = new Date().toISOString().split('T')[0];

const QTY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  tutto:         { label: 'Tutto',         color: '#166534', bg: '#DCFCE7' },
  bis:           { label: 'Bis',           color: '#065F46', bg: '#D1FAE5' },
  metà:          { label: 'Metà',          color: '#854D0E', bg: '#FEF9C3' },
  mangiata_poca: { label: 'Mangiata poca', color: '#991B1B', bg: '#FEE2E2' },
  lasciata_poca: { label: 'Lasciata poca', color: '#7F1D1D', bg: '#FECACA' },
  no:            { label: 'Non mangiato',  color: '#64748B', bg: '#F1F5F9' },
  molta:         { label: 'Molto',         color: '#065F46', bg: '#D1FAE5' },
  poca:          { label: 'Poca',          color: '#991B1B', bg: '#FEE2E2' },
};

const ITEMS = [
  { key: 'merenda', label: 'Merenda',  icon: '🍪', color: '#FFB347' },
  { key: 'pasta',   label: 'Pasta',    icon: '🍝', color: '#F4C2C2' },
  { key: 'secondo', label: 'Secondo',  icon: '🍗', color: '#A7C7E7' },
  { key: 'pane',    label: 'Pane',     icon: '🍞', color: '#FFD699' },
  { key: 'frutta',  label: 'Frutta',   icon: '🍎', color: '#98FB98' },
  { key: 'pupu',    label: 'Pupù',     icon: '🚽', color: '#D4B8E0', boolean: true },
  { key: 'nanna',   label: 'Nanna',    icon: '😴', color: '#93C5FD', boolean: true },
];

export default function ParentGriglia() {
  const { activeChildId, user } = useAuth();
  const [griglia, setGriglia]   = useState<any>(null);
  const [child, setChild]       = useState<any>(null);
  const [loading, setLoading]   = useState(true);

  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;
  const todayLabel = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    if (!childId) { setLoading(false); return; }
    Promise.all([
      api.get(`/griglia?student_id=${childId}&date=${TODAY}`),
      api.get(`/students/${childId}`),
    ]).then(([g, c]) => {
      setGriglia(g.data?.[0] || null);
      setChild(c.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [childId]);

  if (loading) return <ScreenLayout title="Griglia Pasti" loading />;

  return (
    <ScreenLayout title="Griglia Pasti">
      {/* Header bambino */}
      <View style={{
        backgroundColor: '#FFF', borderRadius: 20, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
      }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F4C2C2', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: '#7A3B3B' }}>{child?.name?.charAt(0) || '?'}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A202C' }}>{child?.name} {child?.cognome || ''}</Text>
          <Text style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'capitalize' }}>{todayLabel}</Text>
        </View>
      </View>

      {!griglia ? (
        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🐻</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151' }}>Dati non disponibili</Text>
          <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>La maestra non ha ancora compilato il registro di oggi</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {ITEMS.map(item => {
            const qty    = griglia[`${item.key}_qty`] as string | undefined;
            const active = griglia[item.key] as boolean;
            const qtyInfo = qty ? QTY_LABELS[qty] : null;

            return (
              <View key={item.key} style={{
                backgroundColor: '#FFF', borderRadius: 16, padding: 16,
                flexDirection: 'row', alignItems: 'center',
                shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
              }}>
                <Text style={{ fontSize: 28, marginRight: 14 }}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A202C' }}>{item.label}</Text>
                </View>
                {/* Badge */}
                {item.boolean ? (
                  <View style={{
                    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
                    backgroundColor: active ? `${item.color}30` : '#F3F4F6',
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? item.color : '#9CA3AF' }}>
                      {active ? 'Sì' : 'No'}
                    </Text>
                  </View>
                ) : qtyInfo ? (
                  <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: qtyInfo.bg }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: qtyInfo.color }}>{qtyInfo.label}</Text>
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: '#F3F4F6' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#9CA3AF' }}>—</Text>
                  </View>
                )}
              </View>
            );
          })}

          {griglia.notes && (
            <View style={{ backgroundColor: '#EBF0FF', borderRadius: 16, padding: 14, marginTop: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#4169E1', textTransform: 'uppercase', marginBottom: 4 }}>
                Note della maestra
              </Text>
              <Text style={{ fontSize: 14, color: '#374151' }}>{griglia.notes}</Text>
            </View>
          )}
        </View>
      )}
    </ScreenLayout>
  );
}
