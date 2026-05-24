import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { babyBlue: '#A7C7E7', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6' };
const MOODS = ['😊','😢','😴','🤒','😤','🎉','😍','😮'];
const ACTIVITIES = ['Lettura','Pittura','Musica','Sport','Natura','Cucina','Teatro','Puzzle'];

export default function TeacherDiario() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote]   = useState('');
  const [mood, setMood]   = useState('');
  const [acts, setActs]   = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    api.get(`/diary?class_id=${classId}`).then(r => setEntries(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [classId]);

  const toggleAct = (a: string) => setActs(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  const handleSave = async () => {
    if (!note.trim()) { Alert.alert('Attenzione', 'Scrivi una nota'); return; }
    setSaving(true);
    try {
      const res = await api.post('/diary', { class_id: classId, date: new Date().toISOString().split('T')[0], mood, activities: acts, note, summary: note });
      setEntries(prev => [res.data, ...prev]);
      setShowForm(false); setNote(''); setMood(''); setActs([]);
    } catch { Alert.alert('Errore', 'Impossibile salvare'); }
    finally { setSaving(false); }
  };

  return (
    <ScreenLayout title="Diario di Bordo" showBack color={C.babyBlue} loading={loading} scrollable={false}>
      <FlatList
        data={entries}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={() => setShowForm(true)} style={s.addBtn}>
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={s.addBtnText}>Aggiungi Voce</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 48 }}>📓</Text><Text style={s.emptyText}>Nessuna voce nel diario</Text></View>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Text style={{ fontSize: 28 }}>{item.mood || '😊'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.cardDate}>{new Date(item.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
                {item.activities?.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {item.activities.map((a: string, i: number) => (
                      <View key={i} style={s.tag}><Text style={s.tagText}>{a}</Text></View>
                    ))}
                  </View>
                )}
              </View>
            </View>
            {(item.note || item.summary) && <Text style={s.cardNote}>{item.note || item.summary}</Text>}
          </View>
        )}
      />

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuova Voce Diario</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <Text style={s.formLabel}>Umore della classe</Text>
          <View style={s.moodsRow}>
            {MOODS.map(m => (
              <TouchableOpacity key={m} onPress={() => setMood(m)} style={[s.moodBtn, mood === m && s.moodBtnActive]}>
                <Text style={{ fontSize: 24 }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.formLabel}>Attività di oggi</Text>
          <View style={s.actsGrid}>
            {ACTIVITIES.map(a => (
              <TouchableOpacity key={a} onPress={() => toggleAct(a)}
                style={[s.actBtn, acts.includes(a) && s.actBtnActive]}>
                <Text style={[s.actText, acts.includes(a) && { color: C.white }]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.formLabel}>Nota per i genitori</Text>
          <TextInput style={s.textarea} value={note} onChangeText={setNote} multiline numberOfLines={4}
            placeholder="Come è andata oggi..." placeholderTextColor={C.muted} textAlignVertical="top" />
          <TouchableOpacity style={s.submitBtn} onPress={handleSave} disabled={saving}>
            <Text style={s.submitText}>{saving ? 'Salvataggio...' : 'Pubblica Diario'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.babyBlue, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12, justifyContent: 'center' },
  addBtnText:{ color: C.white, fontWeight: '700', fontSize: 14 },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: C.muted, marginTop: 12 },
  card:      { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardDate:  { fontSize: 13, fontWeight: '700', color: C.text, textTransform: 'capitalize' },
  tag:       { backgroundColor: '#EBF0FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  tagText:   { fontSize: 10, color: C.babyBlue, fontWeight: '600' },
  cardNote:  { fontSize: 12, color: '#374151', lineHeight: 18, backgroundColor: '#EBF0FF20', borderRadius: 10, padding: 10 },
  modal:     { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:{ fontSize: 20, fontWeight: '800', color: C.text },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 10, marginTop: 16 },
  moodsRow:  { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  moodBtn:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  moodBtnActive:{ borderColor: C.babyBlue, borderWidth: 2.5 },
  actsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  actBtnActive:{ backgroundColor: C.babyBlue, borderColor: C.babyBlue },
  actText:   { fontSize: 13, fontWeight: '600', color: C.text },
  textarea:  { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 14, color: C.text, minHeight: 100, backgroundColor: C.white },
  submitBtn: { backgroundColor: C.babyBlue, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText:{ color: C.white, fontWeight: '700', fontSize: 15 },
});
