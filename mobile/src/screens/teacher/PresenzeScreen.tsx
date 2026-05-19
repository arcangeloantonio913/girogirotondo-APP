import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

function addDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

type Presenza = { presente: boolean; nota: string };

export default function TeacherPresenze() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;

  const [students, setStudents] = useState<any[]>([]);
  const [presenze, setPresenze] = useState<Record<string, Presenza>>({});
  const [dateOffset, setDateOffset] = useState(0);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);

  const currentDate = addDays(dateOffset);
  const dateLabel   = new Date(currentDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    api.get('/students').then(r => {
      const s = r.data || [];
      setStudents(s);
      const p: Record<string, Presenza> = {};
      s.forEach((st: any) => { p[st.id] = { presente: true, nota: '' }; });
      setPresenze(p);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [classId]);

  useEffect(() => {
    if (!classId || !students.length) return;
    api.get(`/presenze?class_id=${classId}&date=${currentDate}`).then(r => {
      setPresenze(prev => {
        const p = { ...prev };
        (r.data || []).forEach((rec: any) => {
          p[rec.student_id] = { presente: rec.presente, nota: rec.nota || '' };
        });
        return p;
      });
    }).catch(() => {});
  }, [currentDate, students.length]);

  const toggle = (id: string) => {
    setPresenze(p => ({ ...p, [id]: { ...p[id], presente: !p[id]?.presente } }));
  };

  const setAll = (presente: boolean) => {
    setPresenze(p => {
      const np = { ...p };
      Object.keys(np).forEach(id => { np[id] = { ...np[id], presente }; });
      return np;
    });
  };

  const save = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      await api.post('/presenze', {
        class_id: classId,
        date:     currentDate,
        records:  students.map(s => ({
          student_id: s.id,
          presente:   presenze[s.id]?.presente ?? true,
          nota:       presenze[s.id]?.nota || '',
        })),
      });
      Alert.alert('✓', 'Registro salvato!');
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il registro.');
    } finally {
      setSaving(false);
    }
  };

  const presenti = students.filter(s => presenze[s.id]?.presente !== false).length;
  const assenti  = students.length - presenti;

  if (loading) return <ScreenLayout title="Registro Presenze" loading />;
  if (!classId) {
    return (
      <ScreenLayout title="Registro Presenze">
        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
          <Ionicons name="clipboard-outline" size={64} color="#E5E7EB" />
          <Text style={{ color: '#9CA3AF', marginTop: 12 }}>Nessuna classe assegnata</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title="Registro Presenze" scrollable={false}>
      {/* Navigazione data */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 12,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
      }}>
        <TouchableOpacity onPress={() => setDateOffset(d => d - 1)} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={22} color="#374151" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#1A202C', textTransform: 'capitalize' }}>{dateLabel}</Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
            <View style={{ alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#166534' }}>{presenti}</Text>
              <Text style={{ fontSize: 10, color: '#166534' }}>Presenti</Text>
            </View>
            <View style={{ alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#991B1B' }}>{assenti}</Text>
              <Text style={{ fontSize: 10, color: '#991B1B' }}>Assenti</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={() => setDateOffset(d => d + 1)} style={{ padding: 8 }}>
          <Ionicons name="chevron-forward" size={22} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Azioni rapide */}
      <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 8 }}>
        <TouchableOpacity onPress={() => setAll(true)} style={{ flex: 1, backgroundColor: '#DCFCE7', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#166534' }}>✓ Tutti presenti</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAll(false)} style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#991B1B' }}>✗ Tutti assenti</Text>
        </TouchableOpacity>
      </View>

      {/* Lista alunni */}
      <FlatList
        data={students}
        keyExtractor={s => s.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        renderItem={({ item: s }) => {
          const presente = presenze[s.id]?.presente !== false;
          return (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: '#FFF', borderRadius: 14, padding: 12, marginBottom: 8,
              shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
            }}>
              <TouchableOpacity
                onPress={() => toggle(s.id)}
                style={{
                  width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
                  backgroundColor: presente ? '#DCFCE7' : '#FEE2E2',
                }}>
                <Ionicons name={presente ? 'checkmark-circle' : 'close-circle'} size={24} color={presente ? '#22C55E' : '#EF4444'} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A202C' }}>
                  {s.name} <Text style={{ fontWeight: '400', color: '#6B7280' }}>{s.cognome || ''}</Text>
                </Text>
                <Text style={{ fontSize: 11, color: presente ? '#22C55E' : '#EF4444', fontWeight: '600' }}>
                  {presente ? 'Presente' : 'Assente'}
                </Text>
              </View>
              <TextInput
                value={presenze[s.id]?.nota || ''}
                onChangeText={t => setPresenze(p => ({ ...p, [s.id]: { ...p[s.id], nota: t } }))}
                placeholder="Nota..."
                placeholderTextColor="#D1D5DB"
                style={{
                  width: 90, fontSize: 12, borderWidth: 1, borderColor: '#E5E7EB',
                  borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, color: '#374151',
                }}
              />
            </View>
          );
        }}
      />

      {/* Salva */}
      <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          style={{
            backgroundColor: saving ? '#93C5FD' : '#FF69B4', borderRadius: 16, height: 52,
            justifyContent: 'center', alignItems: 'center',
            shadowColor: '#FF69B4', shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
          }}>
          {saving ? <ActivityIndicator color="#FFF" /> : (
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>💾 Salva Registro</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
