import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const PIATTI = [
  { key: 'merenda_mattina',    label: 'Merenda mattina',    icon: '☕', color: '#F59E0B' },
  { key: 'primo',              label: 'Primo piatto',       icon: '🍝', color: '#FF69B4' },
  { key: 'secondo',            label: 'Secondo piatto',     icon: '🍗', color: '#4169E1' },
  { key: 'contorno',           label: 'Contorno',           icon: '🥗', color: '#32CD32' },
  { key: 'frutta',             label: 'Frutta',             icon: '🍎', color: '#EF4444' },
  { key: 'merenda_pomeriggio', label: 'Merenda pomeriggio', icon: '🍪', color: '#8B5CF6' },
];

export default function ParentDieta() {
  const { activeChildId, user } = useAuth();
  const [meal, setMeal]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [offset, setOffset]     = useState(0);

  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;
  const today   = new Date().toISOString().split('T')[0];
  const currentDate = addDays(today, offset);
  const dateLabel   = new Date(currentDate + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  useEffect(() => {
    if (!childId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/students/${childId}`)
      .then(r => {
        const classId = r.data?.class_id;
        if (!classId) return Promise.reject();
        return api.get(`/meals?class_id=${classId}&date=${currentDate}`);
      })
      .then(r => setMeal(r.data?.[0] || null))
      .catch(() => setMeal(null))
      .finally(() => setLoading(false));
  }, [childId, currentDate]);

  const piatti = meal ? PIATTI.filter(p => meal[p.key]) : [];

  return (
    <ScreenLayout title="Menu Mensa" loading={loading}>
      {/* Navigazione data */}
      <View style={{
        backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
      }}>
        <TouchableOpacity onPress={() => setOffset(o => o - 1)} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={22} color="#374151" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#1A202C', textTransform: 'capitalize' }}>
            {dateLabel}
          </Text>
          {offset === 0 && (
            <View style={{ backgroundColor: '#4169E1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 }}>
              <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>OGGI</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setOffset(o => o + 1)} style={{ padding: 8 }}>
          <Ionicons name="chevron-forward" size={22} color="#374151" />
        </TouchableOpacity>
      </View>

      {piatti.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🍽️</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151' }}>Menu non disponibile</Text>
          <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>
            {offset > 0 ? 'Il menu non è ancora stato inserito' : 'La maestra non ha ancora pubblicato il menu di oggi'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {piatti.map(p => (
            <View key={p.key} style={{
              backgroundColor: '#FFF', borderRadius: 16, padding: 16,
              flexDirection: 'row', alignItems: 'center', gap: 14,
              shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
            }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: `${p.color}20` }}>
                <Text style={{ fontSize: 22 }}>{p.icon}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' }}>{p.label}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A202C', marginTop: 2 }}>{meal[p.key]}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScreenLayout>
  );
}
