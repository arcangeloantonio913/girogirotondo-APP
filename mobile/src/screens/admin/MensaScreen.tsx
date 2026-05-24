import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { green: '#32CD32', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6' };
const TODAY = new Date().toISOString().split('T')[0];
const PIATTI = ['primo','secondo','contorno','frutta','merenda_mattina','merenda_pomeriggio'];

export default function AdminMensa() {
  const { sede } = useAuth();
  const [meals, setMeals]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date_from: TODAY, date_to: TODAY, primo: '', secondo: '', contorno: '', frutta: '', merenda_mattina: '', merenda_pomeriggio: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/meals').then(r => setMeals(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.post('/meals', form);
      setMeals(prev => [res.data, ...prev]);
      setShowForm(false);
    } catch { Alert.alert('Errore', 'Impossibile salvare'); }
    finally { setSaving(false); }
  };

  return (
    <ScreenLayout title="Menu Mensa" showBack color={C.green} loading={loading} scrollable={false}>
      <FlatList
        data={meals}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={() => setShowForm(true)} style={s.addBtn}>
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={s.addBtnText}>Aggiungi Menu</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 48 }}>🍽️</Text><Text style={s.emptyText}>Nessun menu configurato</Text></View>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.cardDate}>{item.date_from}{item.date_to && item.date_to !== item.date_from ? ` → ${item.date_to}` : ''}</Text>
            <View style={s.mealGrid}>
              {[['primo','🍝'],['secondo','🍗'],['contorno','🥗'],['frutta','🍎']].map(([k,e]) => (
                item[k] ? <View key={k} style={s.mealItem}><Text style={s.mealIcon}>{e}</Text><Text style={s.mealValue}>{item[k]}</Text></View> : null
              ))}
            </View>
          </View>
        )}
      />
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuovo Menu</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity>
          </View>
          {[
            { key: 'date_from', label: 'Data inizio', ph: 'YYYY-MM-DD' },
            { key: 'date_to',   label: 'Data fine',   ph: 'YYYY-MM-DD' },
            { key: 'primo',     label: '🍝 Primo',    ph: 'Es. Pasta al pomodoro' },
            { key: 'secondo',   label: '🍗 Secondo',  ph: 'Es. Pollo arrosto' },
            { key: 'contorno',  label: '🥗 Contorno', ph: 'Es. Insalata mista' },
            { key: 'frutta',    label: '🍎 Frutta',   ph: 'Es. Mela' },
            { key: 'merenda_mattina',    label: '☕ Merenda mattina',    ph: 'Es. Latte e biscotti' },
            { key: 'merenda_pomeriggio', label: '🍪 Merenda pomeriggio', ph: 'Es. Frutta' },
          ].map(f => (
            <View key={f.key}>
              <Text style={s.formLabel}>{f.label}</Text>
              <TextInput style={s.input} value={(form as any)[f.key]} onChangeText={t => setForm(prev => ({ ...prev, [f.key]: t }))} placeholder={f.ph} placeholderTextColor={C.muted} />
            </View>
          ))}
          <TouchableOpacity style={s.submitBtn} onPress={handleSave} disabled={saving}>
            <Text style={s.submitText}>{saving ? 'Salvataggio...' : 'Salva Menu'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.green, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12, justifyContent: 'center' },
  addBtnText:{ color: C.white, fontWeight: '700', fontSize: 14 },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: C.muted, marginTop: 12 },
  card:      { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardDate:  { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 10 },
  mealGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealItem:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FFF0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  mealIcon:  { fontSize: 16 },
  mealValue: { fontSize: 12, fontWeight: '600', color: C.text },
  modal:     { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:{ fontSize: 20, fontWeight: '800', color: C.text },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8, marginTop: 12 },
  input:     { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white },
  submitBtn: { backgroundColor: C.green, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText:{ color: C.white, fontWeight: '700', fontSize: 15 },
});
