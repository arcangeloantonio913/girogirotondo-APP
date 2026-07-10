import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };
const TODAY = new Date().toISOString().split('T')[0];
const CURRENT_MONTH = TODAY.slice(0, 7);          // YYYY-MM
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function AdminPresenze() {
  const { sede } = useAuth();
  const [classes, setClasses]     = useState<any[]>([]);
  const [selected, setSelected]   = useState<string | null>(null);
  const [records, setRecords]     = useState<any[]>([]);
  const [students, setStudents]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [date, setDate]           = useState(TODAY);
  const [saving, setSaving]       = useState(false);
  const [tab, setTab]             = useState<'oggi' | 'riepilogo'>('oggi');
  const [meseRiepilogo, setMeseRiepilogo] = useState(CURRENT_MONTH);   // YYYY-MM
  const [studenti, setStudenti]   = useState<any[]>([]);
  const [loadingRiep, setLoadingRiep] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/classes'), api.get('/students')])
      .then(([cR, sR]) => { setClasses(cR.data || []); setStudents(sR.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  useEffect(() => {
    if (!selected) return;
    api.get(`/presenze?class_id=${selected}&date=${date}`).then(r => setRecords(r.data || [])).catch(() => {});
  }, [selected, date]);

  // Riepilogo assenze: ricarica quando si apre il tab o cambia il mese
  useEffect(() => {
    if (tab !== 'riepilogo') return;
    setLoadingRiep(true);
    api.get(`/presenze/riepilogo?mese=${meseRiepilogo}`)
      .then(r => setStudenti(r.data?.studenti || []))
      .catch(() => setStudenti([]))
      .finally(() => setLoadingRiep(false));
  }, [tab, meseRiepilogo]);

  const presentCount = records.filter(r => r.presente).length;
  const classStudents = students.filter(s => s.class_id === selected || s.class_ids?.includes(selected));

  // Toggle ottimistico dello stato locale (nessuna POST qui)
  const togglePresente = (studentId: string) => {
    setRecords(prev => {
      const idx = prev.findIndex(r => r.student_id === studentId);
      if (idx === -1) return [...prev, { student_id: studentId, presente: true, nota: null }];
      const next = [...prev];
      next[idx] = { ...next[idx], presente: !next[idx].presente };
      return next;
    });
  };

  // Salva TUTTA la classe in un'unica POST (anche gli alunni mai toccati = assenti)
  const handleSave = async () => {
    // Guardia: nessuna classe selezionata → non costruire nulla
    if (!selected) { Alert.alert('Nessuna classe selezionata'); return; }
    setSaving(true);
    try {
      // Guardia: date non deve essere undefined/null
      let safeDate = date;
      if (!safeDate) { console.log('[PRESENZE] date mancante, uso TODAY'); safeDate = TODAY; }

      // Costruzione batch difensiva: salta studenti senza id, valori sempre definiti
      const batch = (classStudents || [])
        .filter(stu => stu && stu.id)
        .map(stu => {
          const rec = records?.find(r => r.student_id === stu.id);
          return { student_id: stu.id, presente: (rec?.presente) ?? false, nota: (rec?.nota) ?? '' };
        });

      console.log('[PRESENZE] save payload:', JSON.stringify({ class_id: selected, date: safeDate, count: records?.length }));
      console.log('[PRESENZE] classStudents:', classStudents?.length, 'records:', records?.length);

      const payload = { class_id: selected, date: safeDate, records: batch };
      await api.post('/presenze', payload);
      Alert.alert('Presenze salvate', `${batch.filter(r => r.presente).length} presenti su ${batch.length}`);
    } catch (e: any) {
      console.log('[PRESENZE] SAVE ERROR:', e?.message, '| status:', e?.response?.status, '| detail:', JSON.stringify(e?.response?.data));
      Alert.alert('Errore salvataggio', e?.response?.data?.detail || e?.message || 'Errore');
    } finally {
      setSaving(false);
    }
  };

  // Naviga i mesi col Date nativo (nessuna libreria); label italiana dalla tabella MESI.
  const shiftMese = (delta: number) => {
    const [y, m] = meseRiepilogo.split('-').map(Number);
    const d = new Date(y, (m - 1) + delta, 1);
    setMeseRiepilogo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const meseLabel = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return `${MESI[m - 1]} ${y}`;
  };
  const totAssenze = studenti.reduce((a, x) => a + (x.assenze || 0), 0);

  return (
    <ScreenLayout title="Presenze" showBack color={C.primary} loading={loading} scrollable={false}>
      {/* Tab bar */}
      <View style={s.tabBar}>
        <TouchableOpacity onPress={() => setTab('oggi')} style={[s.tabBtn, tab === 'oggi' && s.tabBtnActive]}>
          <Text style={[s.tabText, tab === 'oggi' && s.tabTextActive]}>Oggi</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('riepilogo')} style={[s.tabBtn, tab === 'riepilogo' && s.tabBtnActive]}>
          <Text style={[s.tabText, tab === 'riepilogo' && s.tabTextActive]}>Riepilogo assenze</Text>
        </TouchableOpacity>
      </View>

      {tab === 'oggi' && (
      <>
      <FlatList
        style={{ flex: 1 }}
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
            <TouchableOpacity style={s.studentCard} activeOpacity={0.7} onPress={() => togglePresente(item.id)}>
              <View style={[s.statusDot, { backgroundColor: rec?.presente ? C.accentGreen : C.red }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.studentName}>{item.name} {item.cognome}</Text>
                {rec?.nota && <Text style={s.nota}>{rec.nota}</Text>}
              </View>
              <Text style={[s.statusText, { color: rec?.presente ? C.accentGreen : C.red }]}>
                {rec?.presente ? 'Presente' : 'Assente'}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
      {selected && (
        <View style={s.saveBar}>
          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle-outline" size={18} color={C.white} />
            <Text style={s.saveBtnText}>{saving ? 'Salvataggio...' : 'Salva presenze'}</Text>
          </TouchableOpacity>
        </View>
      )}
      </>
      )}

      {tab === 'riepilogo' && (
        <FlatList
          style={{ flex: 1 }}
          data={studenti}
          keyExtractor={(item) => item.student_id}
          contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={
            <View>
              {/* Selettore mese */}
              <View style={s.meseRow}>
                <TouchableOpacity onPress={() => shiftMese(-1)} style={s.meseArrow}>
                  <Ionicons name="chevron-back" size={20} color={C.primary} />
                </TouchableOpacity>
                <Text style={s.meseLabel}>{meseLabel(meseRiepilogo)}</Text>
                <TouchableOpacity onPress={() => shiftMese(1)} style={s.meseArrow}>
                  <Ionicons name="chevron-forward" size={20} color={C.primary} />
                </TouchableOpacity>
              </View>
              {!loadingRiep && studenti.length > 0 && (
                <Text style={s.riepHeader}>{studenti.length} bambini — {totAssenze} assenze nel mese</Text>
              )}
            </View>
          }
          ListEmptyComponent={
            loadingRiep
              ? <View style={s.empty}><Text style={s.emptyText}>Caricamento…</Text></View>
              : <View style={s.empty}><Text style={{ fontSize: 40 }}>📊</Text><Text style={s.emptyText}>Nessun dato per questo mese</Text></View>
          }
          renderItem={({ item }) => (
            <View style={s.studentCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.studentName}>{item.nome} {item.cognome}</Text>
                <Text style={s.classInfo}>{item.class_name || '—'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.assenzeNum, { color: item.assenze > 0 ? C.red : C.muted }]}>{item.assenze}</Text>
                <Text style={s.presenzeSmall}>P: {item.presenze}</Text>
              </View>
            </View>
          )}
        />
      )}
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
  saveBar:     { padding: 12, paddingTop: 8, backgroundColor: C.white, borderTopWidth: 0.5, borderTopColor: C.border },
  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14 },
  saveBtnText: { color: C.white, fontWeight: '700', fontSize: 15 },
  tabBar:      { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 4 },
  tabBtn:      { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  tabBtnActive:{ backgroundColor: C.primary, borderColor: C.primary },
  tabText:     { fontSize: 13, fontWeight: '700', color: C.muted },
  tabTextActive:{ color: C.white },
  meseRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderRadius: 12, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  meseArrow:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  meseLabel:   { fontSize: 15, fontWeight: '800', color: C.text },
  riepHeader:  { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 8 },
  assenzeNum:  { fontSize: 22, fontWeight: '900' },
  presenzeSmall:{ fontSize: 11, color: C.muted, fontWeight: '600' },
  empty:       { alignItems: 'center', paddingTop: 40 },
  emptyText:   { color: C.muted, fontSize: 14, marginTop: 10 },
});
