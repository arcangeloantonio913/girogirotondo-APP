import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';
import { todayLocal, localYMD } from '../../lib/dates';
import { pickMealForClass } from '../../lib/meals';
import { useScreenRefresh, useFollowToday } from '../../lib/useScreenRefresh';

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
  return localYMD(dt);
}

export default function ParentDieta() {
  const { activeChildId, user } = useAuth();
  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;
  const [meal,  setMeal]  = useState<any>(null);
  const [loading, setLoading]       = useState(true);   // solo primo caricamento (spinner pieno)
  const [refreshing, setRefreshing] = useState(false);  // pull-to-refresh
  const [error, setError]           = useState('');
  const [manualTick, setManualTick] = useState(0);
  const refreshTick = useScreenRefresh();
  // Segue "oggi": se l'app resta aperta oltre la mezzanotte (tipico su iPhone) al ritorno
  // si riallinea alla data corrente; se il genitore ha scelto un altro giorno resta lì.
  const [date, changeDate] = useFollowToday(refreshTick);

  // Caricamento SEQUENZIALE: prima la classe del figlio, poi il menu di quella classe.
  // Prima erano due effect in parallelo → la risposta senza class_id poteva arrivare per ultima
  // e sovrascrivere quella corretta (menu di un'altra classe o vuoto).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError('');
      try {
        let classId: string | undefined;
        if (childId) {
          try { classId = (await api.get(`/students/${childId}`)).data?.class_id || undefined; }
          catch { classId = undefined; }   // senza classe il backend restituisce comunque i menu autorizzati
        }
        const r = await api.get('/meals', { params: { date, ...(classId ? { class_id: classId } : {}) } });
        if (!cancelled) setMeal(pickMealForClass(r.data, classId));
      } catch (e: any) {
        if (!cancelled) {
          setMeal(null);
          setError(e?.response?.data?.detail || 'Impossibile caricare il menu. Controlla la connessione e riprova.');
        }
      } finally {
        if (!cancelled) { setLoading(false); setRefreshing(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [childId, date, refreshTick, manualTick]);

  const onRefresh = useCallback(() => { setRefreshing(true); setManualTick(t => t + 1); }, []);

  const isToday = date === todayLocal();
  const piatti  = meal ? PIATTI.filter(p => meal[p.key]) : [];

  return (
    <ScreenLayout
      title="Menu Mensa" showBack color={C.babyGreen} loading={loading}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.babyGreen} />}
    >
      <View style={{ padding: 16 }} testID="parent-dieta-screen">
        {/* Date nav */}
        <View style={s.dateNav}>
          <TouchableOpacity onPress={() => changeDate(addDays(date, -1))} style={s.navBtn} testID="dieta-prev-day" accessibilityLabel="Giorno precedente">
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.dateText}>{new Date(date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            {isToday
              ? <Text style={[s.todayBadge, { backgroundColor: C.babyGreen }]}>Oggi</Text>
              : <TouchableOpacity onPress={() => changeDate(todayLocal())} testID="dieta-go-today">
                  <Text style={[s.todayLink, { color: C.babyGreen }]}>Torna a oggi</Text>
                </TouchableOpacity>}
          </View>
          <TouchableOpacity onPress={() => changeDate(addDays(date, 1))} style={s.navBtn} testID="dieta-next-day" accessibilityLabel="Giorno successivo">
            <Ionicons name="chevron-forward" size={20} color={C.text} />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={s.empty} testID="dieta-error">
            <Text style={{ fontSize: 48 }}>⚠️</Text>
            <Text style={s.emptyText}>{error}</Text>
            <TouchableOpacity onPress={onRefresh} style={[s.retryBtn, { backgroundColor: C.babyGreen }]} testID="dieta-retry">
              <Text style={s.retryText}>Riprova</Text>
            </TouchableOpacity>
          </View>
        ) : piatti.length === 0 ? (
          <View style={s.empty} testID="dieta-empty">
            <Text style={{ fontSize: 48 }}>🍽️</Text>
            <Text style={s.emptyText}>Menu non ancora disponibile per questo giorno</Text>
            <Text style={s.emptyHint}>Trascina verso il basso per aggiornare</Text>
          </View>
        ) : (
          piatti.map(p => (
            <View key={p.key} style={[s.row, { backgroundColor: p.bg, borderColor: p.bg }]} testID={`dieta-item-${p.key}`}>
              <Text style={s.rowIcon}>{p.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowLabel, { color: p.color }]}>{p.label}</Text>
                <Text style={s.rowValue}>{meal[p.key]}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  dateNav:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, backgroundColor: C.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border },
  navBtn:   { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dateText: { fontSize: 14, fontWeight: '700', color: C.text, textAlign: 'center', textTransform: 'capitalize' },
  todayBadge: { marginTop: 4, fontSize: 10, fontWeight: '700', color: '#FFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  todayLink:  { marginTop: 4, fontSize: 11, fontWeight: '700' },
  empty:    { alignItems: 'center', paddingTop: 60, paddingHorizontal: 16 },
  emptyText:{ fontSize: 14, color: C.muted, marginTop: 12, textAlign: 'center' },
  emptyHint:{ fontSize: 12, color: C.muted, marginTop: 6, textAlign: 'center', opacity: 0.8 },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  retryText:{ color: '#FFF', fontWeight: '700', fontSize: 14 },
  row:      { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1 },
  rowIcon:  { fontSize: 28, marginRight: 14 },
  rowLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { fontSize: 15, fontWeight: '600', color: C.text, marginTop: 2 },
});
