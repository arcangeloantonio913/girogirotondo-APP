import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { primary: '#4169E1', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6', green: '#32CD32', red: '#EF4444' };
const TODAY = new Date().toISOString().split('T')[0];

export default function AdminPresenze() {
  const { sede } = useAuth();
  const [classes, setClasses]     = useState<any[]>([]);
  const [selected, setSelected]   = useState<string | null>(null);
  const [records, setRecords]     = useState<any[]>([]);
  const [students, setStudents]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [date, setDate]           = useState(TODAY);

  useEffect(() => {
    Promise.all([api.get('/classes'), api.get('/students')])
      .then(([cR, sR]) => { setClasses(cR.data || []); setStudents(sR.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  useEffect(() => {
    if (!selected) return;
    api.get(`/presenze?class_id=${selected}&date=${date}`).then(r => setRecords(r.data || [])).catch(() => {});
  }, [selected, date]);

  const presentCount = records.filter(r => r.presente).length;
  const classStudents = students.filter(s => s.class_id === selected || s.class_ids?.includes(selected));

  return (
    <ScreenLayout title="Presenze" showBack color={C.primary} loading={loading} scrollable={false}>
      <FlatList
        data={selected ? classStudents : classes}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          selected ? (
            <View>
              <TouchableOpacity onPress={() => setSelected(null)} style={s.backRow}>
                <Ionicons name="arrow-back" size={16} color={C.primary} />
                <Text style={s.backText}>Tutte le classi</Text>
              </TouchableOpacity>
              <View style={s.summaryCard}>
                <Text style={s.summaryTitle}>{classes.find(c => c.id === selected)?.name}</Text>
                <View style={s.summaryRow}>
                  <View style={[s.summaryBadge, { backgroundColor: '#D1FAE5' }]}><Text style={[s.summaryBadgeText, { color: '#065F46' }]}>✓ {presentCount} presenti</Text></View>
                  <View style={[s.summaryBadge, { backgroundColor: '#FEE2E2' }]}><Text style={[s.summaryBadgeText, { color: '#991B1B' }]}>✗ {classStudents.length - presentCount} assenti</Text></View>
                </View>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (!selected) {
            const count = students.filter(s => s.class_id === item.id || s.class_ids?.includes(item.id)).length;
            return (
              <TouchableOpacity onPress={() => setSelected(item.id)} style={s.classCard}>
                <View style={s.classIcon}>
                  <Ionicons name="people-outline" size={22} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.className}>{item.name}</Text>
                  <Text style={s.classInfo}>{count} alunni — {item.teacher_name || ''}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </TouchableOpacity>
            );
          }
          const rec = records.find(r => r.student_id === item.id);
          return (
            <View style={s.studentCard}>
              <View style={[s.statusDot, { backgroundColor: rec?.presente ? C.green : C.red }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.studentName}>{item.name} {item.cognome}</Text>
                {rec?.nota && <Text style={s.nota}>{rec.nota}</Text>}
              </View>
              <Text style={[s.statusText, { color: rec?.presente ? C.green : C.red }]}>
                {rec?.presente ? 'Presente' : 'Assente'}
              </Text>
            </View>
          );
        }}
      />
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  backRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText:    { fontSize: 14, fontWeight: '700', color: C.primary },
  summaryCard: { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  summaryTitle:{ fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 8 },
  summaryRow:  { flexDirection: 'row', gap: 8 },
  summaryBadge:{ flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  summaryBadgeText:{ fontSize: 13, fontWeight: '700' },
  classCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  classIcon:   { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EBF0FF', alignItems: 'center', justifyContent: 'center' },
  className:   { fontSize: 15, fontWeight: '700', color: C.text },
  classInfo:   { fontSize: 12, color: C.muted, marginTop: 2 },
  studentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  statusDot:   { width: 10, height: 10, borderRadius: 5 },
  studentName: { fontSize: 14, fontWeight: '700', color: C.text },
  nota:        { fontSize: 12, color: C.muted, marginTop: 2 },
  statusText:  { fontSize: 12, fontWeight: '700' },
});
