import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { babyBlue: '#A7C7E7', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6', red: '#EF4444' };
const SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00'];

export default function ParentAppuntamenti() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date,   setDate]   = useState('');
  const [slot,   setSlot]   = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    api.get('/appointments').then(r => setAppointments(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleBook = async () => {
    if (!date || !slot || !reason.trim()) { Alert.alert('Attenzione', 'Compila tutti i campi'); return; }
    setSaving(true);
    try {
      const res = await api.post('/appointments', { parent_id: user?.id, date, time_slot: slot, reason });
      setAppointments(prev => [res.data, ...prev]);
      setShowForm(false); setDate(''); setSlot(''); setReason('');
    } catch { Alert.alert('Errore', 'Impossibile prenotare'); }
    finally { setSaving(false); }
  };

  return (
    <ScreenLayout title="Prenotazioni" showBack color={C.babyBlue} loading={loading} scrollable={false}>
      <FlatList
        data={appointments}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <>
            <TouchableOpacity onPress={() => setShowForm(!showForm)} style={s.addBtn}>
              <Ionicons name={showForm ? 'close' : 'add'} size={18} color={C.white} />
              <Text style={s.addBtnText}>{showForm ? 'Annulla' : 'Nuova Prenotazione'}</Text>
            </TouchableOpacity>

            {showForm && (
              <View style={s.form}>
                <Text style={s.formLabel}>Data</Text>
                <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
                <Text style={s.formLabel}>Orario</Text>
                <View style={s.slotsGrid}>
                  {SLOTS.map(sl => (
                    <TouchableOpacity key={sl} onPress={() => setSlot(sl)}
                      style={[s.slotBtn, slot === sl && s.slotBtnActive]}>
                      <Text style={[s.slotText, slot === sl && { color: C.white }]}>{sl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.formLabel}>Motivo</Text>
                <TextInput style={s.input} value={reason} onChangeText={setReason} placeholder="Es. Colloquio, informazioni..." />
                <TouchableOpacity style={s.submitBtn} onPress={handleBook} disabled={saving}>
                  <Text style={s.submitText}>{saving ? 'Prenotazione...' : 'Conferma Prenotazione'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 48 }}>📅</Text><Text style={s.emptyText}>Nessuna prenotazione</Text></View>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={[s.dot, { backgroundColor: item.status === 'confirmed' ? '#32CD32' : C.babyBlue }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.cardDate}>{item.date} — {item.time_slot}</Text>
              <Text style={s.cardReason}>{item.reason}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: item.status === 'confirmed' ? '#D1FAE5' : '#EBF0FF' }]}>
              <Text style={[s.statusText, { color: item.status === 'confirmed' ? '#065F46' : '#4169E1' }]}>
                {item.status === 'confirmed' ? 'Confermato' : 'In attesa'}
              </Text>
            </View>
          </View>
        )}
      />
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#A7C7E7', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12, justifyContent: 'center' },
  addBtnText:{ color: C.white, fontWeight: '700', fontSize: 14 },
  form:      { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  formLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 12 },
  input:     { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBtn:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: '#F9FAFB' },
  slotBtnActive:{ backgroundColor: C.babyBlue, borderColor: C.babyBlue },
  slotText:  { fontSize: 13, fontWeight: '600', color: '#374151' },
  submitBtn: { backgroundColor: C.babyBlue, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  submitText:{ color: C.white, fontWeight: '700', fontSize: 14 },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: C.muted, marginTop: 12 },
  card:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  dot:       { width: 10, height: 10, borderRadius: 5 },
  cardDate:  { fontSize: 13, fontWeight: '700', color: C.text },
  cardReason:{ fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBadge:{ borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:{ fontSize: 10, fontWeight: '700' },
});
