import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const TODAY = new Date().toISOString().split('T')[0];

export default function AdminPresenze() {
  const { sede } = useAuth();
  const [classes, setClasses]       = useState<any[]>([]);
  const [students, setStudents]     = useState<any[]>([]);
  const [selectedClass, setSelected] = useState<string | null>(null);
  const [records, setRecords]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [summaryDate, setSummaryDate] = useState(TODAY);

  useEffect(() => {
    Promise.all([api.get('/classes'), api.get('/students')])
      .then(([c, s]) => {
        setClasses(c.data || []);
        setStudents(s.data || []);
        if (c.data?.length) setSelected(c.data[0].id);
      }).catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  useEffect(() => {
    if (!selectedClass) return;
    api.get(`/presenze?class_id=${selectedClass}&date=${summaryDate}`)
      .then(r => setRecords(r.data || []))
      .catch(() => {});
  }, [selectedClass, summaryDate]);

  const cls = classes.find(c => c.id === selectedClass);
  const classStudents = students.filter(s => s.class_id === selectedClass);
  const presenti = records.filter(r => r.presente).length;
  const assenti  = records.filter(r => !r.presente).length;
  const todayLabel = new Date(summaryDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading) return <ScreenLayout title="Registro Presenze" loading />;

  return (
    <ScreenLayout title="Registro Presenze" scrollable={false}>
      {/* Selettore classe */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <FlatList
          data={classes}
          keyExtractor={c => c.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item: c }) => (
            <TouchableOpacity onPress={() => setSelected(c.id)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, backgroundColor: selectedClass === c.id ? '#4169E1' : '#F3F4F6' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: selectedClass === c.id ? '#FFF' : '#374151' }}>{c.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Data + Sommario */}
      <View style={{ backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#1A202C', textAlign: 'center', textTransform: 'capitalize', marginBottom: 10 }}>
          {todayLabel}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#4169E1', textAlign: 'center', marginBottom: 10 }}>
          {cls?.name || '—'}
        </Text>
        {records.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Nessun registro per oggi</Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#DCFCE7', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#166534' }}>{presenti}</Text>
              <Text style={{ fontSize: 11, color: '#166534' }}>Presenti</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#991B1B' }}>{assenti}</Text>
              <Text style={{ fontSize: 11, color: '#991B1B' }}>Assenti</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#374151' }}>{classStudents.length}</Text>
              <Text style={{ fontSize: 11, color: '#374151' }}>Totale</Text>
            </View>
          </View>
        )}
      </View>

      {/* Lista alunni con stato */}
      <FlatList
        data={classStudents}
        keyExtractor={s => s.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item: s }) => {
          const rec = records.find(r => r.student_id === s.id);
          const presente = rec?.presente;
          return (
            <View style={{ backgroundColor: '#FFF', borderRadius: 14, padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {presente === undefined ? (
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6' }} />
              ) : presente ? (
                <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
              ) : (
                <Ionicons name="close-circle" size={28} color="#EF4444" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A202C' }}>
                  {s.name} <Text style={{ fontWeight: '400', color: '#9CA3AF' }}>{s.cognome || ''}</Text>
                </Text>
                {rec?.nota ? <Text style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>{rec.nota}</Text> : null}
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, backgroundColor: presente === true ? '#DCFCE7' : presente === false ? '#FEE2E2' : '#F3F4F6' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: presente === true ? '#166534' : presente === false ? '#991B1B' : '#9CA3AF' }}>
                  {presente === undefined ? '—' : presente ? 'Presente' : 'Assente'}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </ScreenLayout>
  );
}
