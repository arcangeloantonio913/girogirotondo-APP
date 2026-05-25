import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { green: '#32CD32', primary: '#4169E1', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6', red: '#EF4444' };

const TODAY = new Date().toISOString().split('T')[0];

// Etichette ufficiali pasti (da screenshot Girogirotondo)
const PASTI = [
  { key: 'merenda_mattina',    label: 'Merenda mattina',    icon: '☕', required: false },
  { key: 'primo',              label: 'Pasta / Primo',      icon: '🍝', required: true  },
  { key: 'secondo',            label: 'Secondo',            icon: '🍗', required: true  },
  { key: 'pane',               label: 'Pane',               icon: '🍞', required: false },
  { key: 'frutta',             label: 'Frutta',             icon: '🍎', required: false },
  { key: 'merenda_pomeriggio', label: 'Merenda pomeriggio', icon: '🍪', required: false },
];

const SEDI = [
  { id: 'girogirotondo',   label: 'Girogirotondo',   color: '#4169E1' },
  { id: 'il-magico-mondo', label: 'Il Magico Mondo', color: '#FF69B4' },
];

const PRESETS = [
  { label: '1 giorno',     days: 1  },
  { label: '1 settimana',  days: 7  },
  { label: '2 settimane',  days: 14 },
  { label: '1 mese',       days: 30 },
];

function addDays(d: string, n: number) {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n - 1);
  return dt.toISOString().split('T')[0];
}

export default function AdminMensa() {
  const { sede } = useAuth();
  const [meals,   setMeals]   = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,  setSaving]  = useState(false);

  // Navigazione date
  const [navDate, setNavDate] = useState(TODAY);

  // Form
  const [form, setForm] = useState({
    date_from: TODAY, date_to: TODAY,
    primo: '', secondo: '', pane: '', frutta: '',
    merenda_mattina: '', merenda_pomeriggio: '',
    class_id: '', // '' = tutte le classi
    sede_ids: [sede || 'girogirotondo'],
  });

  useEffect(() => {
    Promise.all([api.get('/meals'), api.get('/classes')])
      .then(([mR, cR]) => { setMeals(mR.data || []); setClasses(cR.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  // Filtro per data selezionata
  const todayMeals = meals.filter(m => m.date_from <= navDate && m.date_to >= navDate);

  const applyPreset = (days: number) => {
    setForm(p => ({ ...p, date_to: addDays(p.date_from, days) }));
  };

  const handleSave = async () => {
    if (!form.primo && !form.secondo) { Alert.alert('Attenzione', 'Inserisci almeno Pasta e Secondo'); return; }
    setSaving(true);
    try {
      const payload = { ...form, sede_id: form.sede_ids[0] };
      const res = await api.post('/meals', payload);
      setMeals(prev => [res.data, ...prev]);
      setShowForm(false);
      setForm({ date_from: TODAY, date_to: TODAY, primo: '', secondo: '', pane: '', frutta: '', merenda_mattina: '', merenda_pomeriggio: '', class_id: '', sede_ids: [sede || 'girogirotondo'] });
    } catch { Alert.alert('Errore', 'Impossibile salvare il menu'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Elimina menu', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/meals/menu/${id}`); setMeals(prev => prev.filter(m => m.id !== id)); }
        catch { Alert.alert('Errore'); }
      }},
    ]);
  };

  const toggleSede = (id: string) => {
    setForm(p => ({
      ...p,
      sede_ids: p.sede_ids.includes(id) ? p.sede_ids.filter(s => s !== id) : [...p.sede_ids, id],
    }));
  };

  return (
    <ScreenLayout title="Menu Mensa" showBack color={C.green} loading={loading} scrollable={false}>
      {/* Navigazione date */}
      <View style={s.dateNav}>
        <TouchableOpacity onPress={() => {
          const d = new Date(navDate + 'T12:00:00'); d.setDate(d.getDate() - 1);
          setNavDate(d.toISOString().split('T')[0]);
        }} style={s.navBtn}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={s.dateText}>{new Date(navDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          {navDate === TODAY && <View style={s.todayBadge}><Text style={s.todayText}>Oggi</Text></View>}
        </View>
        <TouchableOpacity onPress={() => {
          const d = new Date(navDate + 'T12:00:00'); d.setDate(d.getDate() + 1);
          setNavDate(d.toISOString().split('T')[0]);
        }} style={s.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={C.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={todayMeals}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={() => setShowForm(true)} style={s.addBtn}>
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={s.addBtnText}>Aggiungi Menu</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>🍽️</Text>
            <Text style={s.emptyText}>Nessun menu per questo giorno</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardClass}>{item.class_id ? classes.find(c => c.id === item.class_id)?.name || 'Classe' : 'Tutte le classi'}</Text>
                <Text style={s.cardDates}>{item.date_from}{item.date_to !== item.date_from ? ` → ${item.date_to}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.delBtn}>
                <Ionicons name="trash-outline" size={16} color={C.red} />
              </TouchableOpacity>
            </View>
            <View style={s.pastiGrid}>
              {PASTI.filter(p => item[p.key]).map(p => (
                <View key={p.key} style={s.pastoItem}>
                  <Text style={{ fontSize: 16 }}>{p.icon}</Text>
                  <View>
                    <Text style={s.pastoLabel}>{p.label}</Text>
                    <Text style={s.pastoValue}>{item[p.key]}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      />

      {/* ── FORM NUOVO MENU ───────────────────────────────────────────────── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowForm(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuovo Menu</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={C.text}/></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Sede */}
            <Text style={s.fl}>Sede</Text>
            <View style={s.chipRow}>
              {SEDI.map(sd => (
                <TouchableOpacity key={sd.id} onPress={() => toggleSede(sd.id)}
                  style={[s.chip, form.sede_ids.includes(sd.id) && { backgroundColor: sd.color, borderColor: sd.color }]}>
                  <Text style={[s.chipText, form.sede_ids.includes(sd.id) && { color: C.white }]}>{sd.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Classe */}
            <Text style={s.fl}>Classi</Text>
            <TouchableOpacity onPress={() => setForm(p => ({ ...p, class_id: '' }))}
              style={[s.chip, !form.class_id && { backgroundColor: C.green, borderColor: C.green }, { marginBottom: 6 }]}>
              <Text style={[s.chipText, !form.class_id && { color: C.white }]}>✓ Tutte le classi</Text>
            </TouchableOpacity>
            <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
              {classes.map(cls => (
                <TouchableOpacity key={cls.id} onPress={() => setForm(p => ({ ...p, class_id: cls.id }))}
                  style={[s.chip, form.class_id === cls.id && { backgroundColor: C.green, borderColor: C.green }]}>
                  <Text style={[s.chipText, form.class_id === cls.id && { color: C.white }]}>{cls.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date */}
            <Text style={s.fl}>Data inizio</Text>
            <TextInput style={s.input} value={form.date_from}
              onChangeText={t => setForm(p => ({ ...p, date_from: t }))} placeholder={TODAY} />

            <Text style={s.fl}>Durata rapida</Text>
            <View style={s.chipRow}>
              {PRESETS.map(pr => (
                <TouchableOpacity key={pr.days} onPress={() => applyPreset(pr.days)} style={s.presetBtn}>
                  <Text style={s.presetText}>{pr.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fl}>Data fine</Text>
            <TextInput style={s.input} value={form.date_to}
              onChangeText={t => setForm(p => ({ ...p, date_to: t }))} placeholder={TODAY} />

            {/* Pasti */}
            <Text style={[s.fl, { marginTop: 16 }]}>Pasti</Text>
            {PASTI.map(p => (
              <View key={p.key} style={s.pastoInputRow}>
                <Text style={s.pastoInputIcon}>{p.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.pastoInputLabel}>{p.label}{p.required ? ' *' : ''}</Text>
                  <TextInput style={s.pastoInput}
                    value={(form as any)[p.key]}
                    onChangeText={t => setForm(prev => ({ ...prev, [p.key]: t }))}
                    placeholder={`Es. ${p.key === 'primo' ? 'Pasta al pomodoro' : p.key === 'secondo' ? 'Pollo arrosto' : p.key === 'pane' ? 'Pane bianco' : p.key === 'frutta' ? 'Mela' : p.key === 'merenda_mattina' ? 'Latte e biscotti' : 'Frutta di stagione'}`}
                    placeholderTextColor={C.muted}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={s.submitText}>{saving ? 'Salvataggio...' : 'Salva Menu'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  dateNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
  navBtn:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dateText:      { fontSize: 14, fontWeight: '700', color: C.text, textTransform: 'capitalize' },
  todayBadge:    { backgroundColor: C.green, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  todayText:     { fontSize: 10, color: C.white, fontWeight: '700' },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.green, borderRadius: 14, paddingVertical: 12, marginBottom: 12, justifyContent: 'center' },
  addBtnText:    { color: C.white, fontWeight: '700', fontSize: 14 },
  empty:         { alignItems: 'center', paddingTop: 50 },
  emptyText:     { fontSize: 14, color: C.muted, marginTop: 12, textAlign: 'center' },
  card:          { backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: C.border },
  cardTop:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardClass:     { fontSize: 13, fontWeight: '700', color: C.text },
  cardDates:     { fontSize: 11, color: C.muted },
  delBtn:        { padding: 6 },
  pastiGrid:     { gap: 6 },
  pastoItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 8 },
  pastoLabel:    { fontSize: 10, color: C.muted, fontWeight: '600' },
  pastoValue:    { fontSize: 13, fontWeight: '700', color: C.text },
  modal:         { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: C.text },
  fl:            { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6, marginTop: 14 },
  input:         { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white },
  chipRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  chipText:      { fontSize: 13, fontWeight: '600', color: C.text },
  presetBtn:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.green, backgroundColor: C.white },
  presetText:    { fontSize: 12, fontWeight: '600', color: C.green },
  pastoInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  pastoInputIcon:{ fontSize: 24, width: 36, textAlign: 'center' },
  pastoInputLabel:{ fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 3 },
  pastoInput:    { borderWidth: 0.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: C.text, backgroundColor: C.white },
  submitBtn:     { backgroundColor: C.green, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText:    { color: C.white, fontWeight: '700', fontSize: 15 },
});
