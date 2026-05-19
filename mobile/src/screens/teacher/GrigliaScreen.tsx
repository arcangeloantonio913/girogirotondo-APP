import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

// Se @react-native-picker/picker non disponibile, usa un semplice selettore custom
const QTY_OPTIONS = [
  { value: '',             label: '—' },
  { value: 'tutto',        label: 'Tutto' },
  { value: 'bis',          label: 'Bis' },
  { value: 'metà',         label: 'Metà' },
  { value: 'mangiata_poca',label: 'Mangiata poca' },
  { value: 'lasciata_poca',label: 'Lasciata poca' },
  { value: 'no',           label: 'No' },
];

const QTY_COLORS: Record<string, string> = {
  '': '#F3F4F6', tutto: '#DCFCE7', bis: '#D1FAE5',
  metà: '#FEF9C3', mangiata_poca: '#FEE2E2', lasciata_poca: '#FECACA', no: '#F1F5F9',
};

function addDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0];
}

const defaultRow = () => ({
  merenda: false, merenda_qty: '',
  pasta: false, pasta_qty: '',
  secondo: false, secondo_qty: '',
  pane: false, pane_qty: '',
  frutta: false, frutta_qty: '',
  pupu: false, nanna: false, notes: '',
});

const MEAL_COLS = [
  { key: 'merenda', label: 'Merenda' },
  { key: 'pasta',   label: 'Pasta' },
  { key: 'secondo', label: 'Secondo' },
  { key: 'pane',    label: 'Pane' },
  { key: 'frutta',  label: 'Frutta' },
];

export default function TeacherGriglia() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;
  const [students, setStudents] = useState<any[]>([]);
  const [grid, setGrid]         = useState<Record<string, any>>({});
  const [dateOffset, setDateOffset] = useState(0);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const currentDate = addDays(dateOffset);
  const dateLabel   = new Date(currentDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    api.get('/students').then(r => {
      const s = r.data || [];
      setStudents(s);
      const g: Record<string, any> = {};
      s.forEach((st: any) => { g[st.id] = defaultRow(); });
      setGrid(g);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [classId]);

  useEffect(() => {
    if (!classId || !students.length) return;
    api.get(`/griglia?class_id=${classId}&date=${currentDate}`).then(r => {
      setGrid(prev => {
        const g = { ...prev };
        (r.data || []).forEach((e: any) => {
          if (g[e.student_id]) g[e.student_id] = { ...defaultRow(), ...e };
        });
        return g;
      });
    }).catch(() => {});
  }, [currentDate, students.length]);

  const setQty = (sid: string, col: string, qty: string) => {
    setGrid(prev => ({
      ...prev,
      [sid]: { ...prev[sid], [col]: qty !== 'no' && !!qty, [`${col}_qty`]: qty },
    }));
  };

  const toggleBool = (sid: string, key: string) => {
    setGrid(prev => ({ ...prev, [sid]: { ...prev[sid], [key]: !prev[sid]?.[key] } }));
  };

  const save = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      await Promise.all(students.map(s =>
        api.post('/griglia', { class_id: classId, student_ids: [s.id], date: currentDate, ...grid[s.id] })
      ));
      Alert.alert('✓', 'Griglia salvata e pubblicata!');
    } catch {
      Alert.alert('Errore', 'Impossibile salvare.');
    } finally { setSaving(false); }
  };

  if (loading) return <ScreenLayout title="Griglia Pasti" loading />;

  return (
    <ScreenLayout title="Griglia Pasti" scrollable={false}>
      {/* Data */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 16, backgroundColor: '#FFF', borderRadius: 16, padding: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
        <TouchableOpacity onPress={() => setDateOffset(d => d - 1)} style={{ padding: 8 }}>
          <Text style={{ fontSize: 22, color: '#374151' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#1A202C', textTransform: 'capitalize', textAlign: 'center' }}>
          {dateLabel}
        </Text>
        <TouchableOpacity onPress={() => setDateOffset(d => d + 1)} style={{ padding: 8 }}>
          <Text style={{ fontSize: 22, color: '#374151' }}>›</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={students}
        keyExtractor={s => s.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        renderItem={({ item: s }) => {
          const sg = grid[s.id] || defaultRow();
          const isExpanded = expanded === s.id;
          return (
            <TouchableOpacity
              onPress={() => setExpanded(isExpanded ? null : s.id)}
              style={{ backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A202C' }}>
                  {s.name} <Text style={{ fontWeight: '400', color: '#9CA3AF' }}>{s.cognome || ''}</Text>
                </Text>
                <Text style={{ fontSize: 18, color: '#9CA3AF' }}>{isExpanded ? '▲' : '▼'}</Text>
              </View>

              {isExpanded && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  {MEAL_COLS.map(col => (
                    <View key={col.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ width: 70, fontSize: 13, fontWeight: '600', color: '#374151' }}>{col.label}</Text>
                      <View style={{ flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        {QTY_OPTIONS.map(opt => (
                          <TouchableOpacity
                            key={opt.value}
                            onPress={() => setQty(s.id, col.key, opt.value)}
                            style={{
                              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                              backgroundColor: sg[`${col.key}_qty`] === opt.value ? QTY_COLORS[opt.value] : '#F3F4F6',
                              borderWidth: sg[`${col.key}_qty`] === opt.value ? 1.5 : 0,
                              borderColor: '#D1D5DB',
                            }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                  {/* Pupù e Nanna */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    {[{ key: 'pupu', label: 'Pupù', color: '#D4B8E0' }, { key: 'nanna', label: 'Nanna', color: '#93C5FD' }].map(b => (
                      <TouchableOpacity
                        key={b.key}
                        onPress={() => toggleBool(s.id, b.key)}
                        style={{
                          flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                          backgroundColor: sg[b.key] ? `${b.color}50` : '#F3F4F6',
                        }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151' }}>
                          {sg[b.key] ? '✓' : '—'} {b.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Salva */}
      <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
        <TouchableOpacity onPress={save} disabled={saving} style={{ backgroundColor: saving ? '#F9A8D4' : '#FF69B4', borderRadius: 16, height: 52, justifyContent: 'center', alignItems: 'center', shadowColor: '#FF69B4', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 }}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Salva e Pubblica</Text>}
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
