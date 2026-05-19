import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const TODAY = new Date().toISOString().split('T')[0];

export default function AdminMensa() {
  const { sede } = useAuth();
  const [meals, setMeals]       = useState<any[]>([]);
  const [classes, setClasses]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({
    class_id: '', date_from: TODAY, date_to: TODAY,
    primo: '', secondo: '', contorno: '', frutta: '',
    merenda_mattina: '', merenda_pomeriggio: '',
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/meals?date=${TODAY}`),
      api.get('/classes'),
    ]).then(([m, c]) => {
      setMeals(m.data || []);
      setClasses(c.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [sede]);

  const deleteMeal = (id: string) => {
    Alert.alert('Elimina menu', 'Eliminare questo menu?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/meals/menu/${id}`); setMeals(prev => prev.filter(m => m.id !== id)); }
        catch { Alert.alert('Errore', 'Impossibile eliminare.'); }
      }},
    ]);
  };

  const saveMeal = async () => {
    if (!form.primo) { Alert.alert('Attenzione', 'Inserisci almeno il primo piatto.'); return; }
    setSaving(true);
    try {
      const res = await api.post('/meals/menu', { ...form, date: form.date_from === form.date_to ? form.date_from : null });
      setMeals(prev => [...prev, res.data]);
      setShowForm(false);
    } catch { Alert.alert('Errore', 'Impossibile salvare.'); }
    finally { setSaving(false); }
  };

  const getClassName = (id: string) => classes.find(c => c.id === id)?.name || 'Tutte le classi';

  if (loading) return <ScreenLayout title="Menu Mensa" loading />;

  return (
    <ScreenLayout title="Menu Mensa" scrollable={false}
      rightAction={
        <TouchableOpacity onPress={() => setShowForm(true)}
          style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#EBF0FF', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="add" size={22} color="#4169E1" />
        </TouchableOpacity>
      }>

      {meals.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <Text style={{ fontSize: 40 }}>🍽️</Text>
          <Text style={{ color: '#9CA3AF', marginTop: 12 }}>Nessun menu per oggi</Text>
        </View>
      ) : (
        <FlatList
          data={meals}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item: m }) => (
            <View style={{ backgroundColor: '#FFF', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#1A202C' }}>{getClassName(m.class_id)}</Text>
                <TouchableOpacity onPress={() => deleteMeal(m.id)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
              {[['Primo', m.primo], ['Secondo', m.secondo], ['Contorno', m.contorno], ['Frutta', m.frutta]].filter(([,v]) => v).map(([l, v]) => (
                <View key={l as string} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', width: 60 }}>{l}:</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', flex: 1 }}>{v}</Text>
                </View>
              ))}
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={{ flex: 1, backgroundColor: '#FFFDD0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A202C' }}>Nuovo Menu</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color="#374151" /></TouchableOpacity>
          </View>
          <FlatList
            data={[1]}
            keyExtractor={() => 'f'}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={() => (
              <View style={{ gap: 12 }}>
                {/* Classe */}
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 }}>Classe (opzionale)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <TouchableOpacity onPress={() => setForm(p => ({ ...p, class_id: '' }))}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: !form.class_id ? '#4169E1' : '#F3F4F6' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: !form.class_id ? '#FFF' : '#374151' }}>Tutte</Text>
                    </TouchableOpacity>
                    {classes.map(c => (
                      <TouchableOpacity key={c.id} onPress={() => setForm(p => ({ ...p, class_id: c.id }))}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: form.class_id === c.id ? '#4169E1' : '#F3F4F6' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: form.class_id === c.id ? '#FFF' : '#374151' }}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {/* Piatti */}
                {[
                  { key: 'primo',             label: 'Primo *' },
                  { key: 'secondo',           label: 'Secondo *' },
                  { key: 'contorno',          label: 'Contorno' },
                  { key: 'frutta',            label: 'Frutta' },
                  { key: 'merenda_mattina',   label: 'Merenda mattina' },
                  { key: 'merenda_pomeriggio',label: 'Merenda pomeriggio' },
                ].map(f => (
                  <View key={f.key}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>{f.label}</Text>
                    <TextInput
                      value={form[f.key as keyof typeof form]}
                      onChangeText={t => setForm(p => ({ ...p, [f.key]: t }))}
                      placeholder={f.label.replace(' *', '')} placeholderTextColor="#D1D5DB"
                      style={{ borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#1A202C', backgroundColor: '#FFF' }} />
                  </View>
                ))}
                <TouchableOpacity onPress={saveMeal} disabled={saving}
                  style={{ backgroundColor: saving ? '#93C5FD' : '#4169E1', borderRadius: 14, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
                  {saving ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Pubblica Menu</Text>}
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </Modal>
    </ScreenLayout>
  );
}
