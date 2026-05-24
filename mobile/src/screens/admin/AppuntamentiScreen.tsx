import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { primary: '#4169E1', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6' };

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  pending:    { label: 'In attesa', bg: '#FFF7E6', text: '#B45309' },
  confirmed:  { label: 'Confermato', bg: '#F0FFF4', text: '#065F46' },
  cancelled:  { label: 'Annullato', bg: '#FEF2F2', text: '#991B1B' },
};

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }

export default function AdminAppuntamenti() {
  const { sede } = useAuth();
  const [appts, setAppts]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view,  setView]    = useState<'lista' | 'calendario'>('lista');
  const [year,  setYear]    = useState(new Date().getFullYear());
  const [month, setMonth]   = useState(new Date().getMonth());
  const [selDay, setSelDay] = useState<number | null>(null);

  const stats = {
    total:    appts.length,
    pending:  appts.filter(a => a.status === 'pending').length,
    confirmed:appts.filter(a => a.status === 'confirmed').length,
  };

  useEffect(() => {
    api.get('/appointments').then(r => setAppts(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  const changeStatus = async (id: string, status: string) => {
    try {
      await api.put(`/appointments/${id}/status?status=${status}`);
      setAppts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch { Alert.alert('Errore', 'Impossibile aggiornare lo stato'); }
  };

  const deleteAppt = (id: string) => {
    Alert.alert('Elimina appuntamento', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/appointments/${id}`);
          setAppts(prev => prev.filter(a => a.id !== id));
        } catch { Alert.alert('Errore', 'Impossibile eliminare'); }
      }},
    ]);
  };

  const exportGCal = (appt: any) => {
    const dt = appt.date?.replace(/-/g, '') || '';
    const time = appt.time_slot?.replace(':', '') || '0900';
    const start = `${dt}T${time}00`;
    const endH = String(parseInt(time.slice(0, 2)) + 1).padStart(2, '0');
    const end = `${dt}T${endH}${time.slice(2)}00`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Appuntamento: ${appt.reason}`)}&dates=${start}/${end}`;
    Linking.openURL(url);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  const apptsByDay: Record<number, any[]> = {};
  appts.forEach(a => {
    const d = new Date(a.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!apptsByDay[day]) apptsByDay[day] = [];
      apptsByDay[day].push(a);
    }
  });

  const selectedAppts = selDay ? (apptsByDay[selDay] || []) : [];
  const filteredAppts = view === 'lista' ? appts : selectedAppts;

  return (
    <ScreenLayout title="Appuntamenti" showBack color={C.primary} loading={loading} scrollable={false}>
      {/* Stats */}
      <View style={s.statsRow}>
        {[
          { label: 'Totali', value: stats.total, color: C.primary },
          { label: 'In attesa', value: stats.pending, color: '#B45309' },
          { label: 'Confermati', value: stats.confirmed, color: '#065F46' },
        ].map((st, i) => (
          <View key={i} style={s.statCard}>
            <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
            <Text style={s.statLabel}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* View toggle */}
      <View style={s.viewToggle}>
        {(['lista','calendario'] as const).map(v => (
          <TouchableOpacity key={v} onPress={() => { setView(v); setSelDay(null); }}
            style={[s.viewBtn, view === v && s.viewBtnActive]}>
            <Ionicons name={v === 'lista' ? 'list-outline' : 'calendar-outline'} size={16} color={view === v ? C.white : C.muted} />
            <Text style={[s.viewBtnText, view === v && { color: C.white }]}>{v === 'lista' ? 'Lista' : 'Calendario'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Calendario */}
      {view === 'calendario' && (
        <View style={s.calendar}>
          <View style={s.calHeader}>
            <TouchableOpacity onPress={() => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }}>
              <Ionicons name="chevron-back" size={20} color={C.text} />
            </TouchableOpacity>
            <Text style={s.calTitle}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={() => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }}>
              <Ionicons name="chevron-forward" size={20} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={s.calGrid}>
            {['D','L','M','M','G','V','S'].map((d,i) => <Text key={i} style={s.calDayName}>{d}</Text>)}
            {Array.from({ length: firstDay }).map((_, i) => <View key={`e${i}`} style={s.calCell} />)}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const dayAppts = apptsByDay[day] || [];
              const isToday = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` === todayStr;
              const isSelected = selDay === day;
              return (
                <TouchableOpacity key={day} onPress={() => setSelDay(isSelected ? null : day)}
                  style={[s.calCell, isToday && s.calCellToday, isSelected && s.calCellSelected]}>
                  <Text style={[s.calDayNum, isToday && { color: C.primary }, isSelected && { color: C.white }]}>{day}</Text>
                  {dayAppts.length > 0 && (
                    <View style={[s.calDot, { backgroundColor: isSelected ? C.white : C.primary }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <FlatList
        data={filteredAppts}
        keyExtractor={a => a.id}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>📅</Text>
            <Text style={s.emptyText}>{selDay ? 'Nessun appuntamento in questo giorno' : 'Nessun appuntamento'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const st = STATUS_MAP[item.status] || STATUS_MAP.pending;
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName}>{item.parent_name || item.parent_id}</Text>
                  <Text style={s.cardReason}>{item.reason}</Text>
                  <Text style={s.cardDate}>{item.date} — {item.time_slot}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                  <Text style={[s.statusText, { color: st.text }]}>{st.label}</Text>
                </View>
              </View>
              <View style={s.cardActions}>
                {item.status === 'pending' && (
                  <>
                    <TouchableOpacity onPress={() => changeStatus(item.id, 'confirmed')} style={s.confirmBtn}>
                      <Ionicons name="checkmark-outline" size={14} color="#065F46" />
                      <Text style={{ fontSize: 12, color: '#065F46', fontWeight: '600' }}>Conferma</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => changeStatus(item.id, 'cancelled')} style={s.cancelBtn}>
                      <Ionicons name="close-outline" size={14} color="#991B1B" />
                      <Text style={{ fontSize: 12, color: '#991B1B', fontWeight: '600' }}>Annulla</Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity onPress={() => exportGCal(item)} style={s.gcalBtn}>
                  <Ionicons name="calendar-outline" size={14} color={C.muted} />
                  <Text style={{ fontSize: 12, color: C.muted }}>Calendar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteAppt(item.id)} style={s.deleteBtn}>
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  statsRow:    { flexDirection: 'row', gap: 8, padding: 12 },
  statCard:    { flex: 1, backgroundColor: C.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: C.border },
  statValue:   { fontSize: 22, fontWeight: '800' },
  statLabel:   { fontSize: 10, color: C.muted, marginTop: 2 },
  viewToggle:  { flexDirection: 'row', marginHorizontal: 12, backgroundColor: C.white, borderRadius: 10, padding: 3, borderWidth: 0.5, borderColor: C.border },
  viewBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 8 },
  viewBtnActive:{ backgroundColor: C.primary },
  viewBtnText: { fontSize: 13, fontWeight: '600', color: C.muted },
  calendar:    { margin: 12, backgroundColor: C.white, borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: C.border },
  calHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calTitle:    { fontSize: 15, fontWeight: '700', color: C.text },
  calGrid:     { flexDirection: 'row', flexWrap: 'wrap' },
  calDayName:  { width: '14.28%', textAlign: 'center', fontSize: 11, color: C.muted, fontWeight: '600', paddingVertical: 4 },
  calCell:     { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calCellToday:{ backgroundColor: '#EBF0FF' },
  calCellSelected:{ backgroundColor: C.primary },
  calDayNum:   { fontSize: 13, fontWeight: '500', color: C.text },
  calDot:      { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  empty:       { alignItems: 'center', paddingTop: 40 },
  emptyText:   { fontSize: 13, color: C.muted, marginTop: 8 },
  card:        { backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: C.border },
  cardTop:     { flexDirection: 'row', gap: 10, marginBottom: 8 },
  cardName:    { fontSize: 14, fontWeight: '700', color: C.text },
  cardReason:  { fontSize: 12, color: C.muted, marginTop: 1 },
  cardDate:    { fontSize: 11, color: C.muted, marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText:  { fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 6 },
  confirmBtn:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F0FFF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cancelBtn:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  gcalBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F9FAFB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  deleteBtn:   { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },
});
