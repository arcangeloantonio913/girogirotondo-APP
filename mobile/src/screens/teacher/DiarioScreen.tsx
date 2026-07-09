import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };
const MOODS = ['😊','😢','😴','🤒','😤','🎉','😍','😮'];
const ACTIVITIES = ['Lettura','Pittura','Musica','Sport','Natura','Cucina','Teatro','Puzzle','Danza','Canto'];
const TODAY = new Date().toISOString().split('T')[0];

export default function TeacherDiario() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;
  const [entries,   setEntries]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);

  // Form fields
  const [note,  setNote]  = useState('');
  const [mood,  setMood]  = useState('');
  const [acts,  setActs]  = useState<string[]>([]);
  const [date,  setDate]  = useState(TODAY);
  const [saving,setSaving]= useState(false);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    api.get(`/diary?class_id=${classId}`)
      .then(r => setEntries(r.data || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [classId]);

  const resetForm = () => {
    setNote(''); setMood(''); setActs([]); setDate(TODAY); setEditEntry(null);
  };

  const openEdit = (entry: any) => {
    setEditEntry(entry);
    setNote(entry.note || entry.summary || '');
    setMood(entry.mood || '');
    setActs(entry.activities || []);
    setDate(entry.date || TODAY);
    setShowForm(true);
  };

  const toggleAct = (a: string) =>
    setActs(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  const handleSave = async () => {
    if (!note.trim()) { Alert.alert('Attenzione', 'Scrivi una nota'); return; }
    setSaving(true);
    try {
      const payload = {
        class_id: classId, date, mood, activities: acts,
        note, summary: note,
      };
      if (editEntry) {
        const res = await api.put(`/diary/${editEntry.id}`, payload);
        setEntries(prev => prev.map(e => e.id === editEntry.id ? res.data : e));
      } else {
        const res = await api.post('/diary', payload);
        setEntries(prev => [res.data, ...prev]);
      }
      setShowForm(false); resetForm();
    } catch { Alert.alert('Errore', 'Impossibile salvare'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Elimina voce', 'Sei sicuro? Questa azione è irreversibile.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/diary/${id}`);
          setEntries(prev => prev.filter(e => e.id !== id));
        } catch { Alert.alert('Errore', 'Impossibile eliminare'); }
      }},
    ]);
  };

  return (
    <ScreenLayout title="Diario di Bordo" showBack color={C.babyBlue} loading={loading} scrollable={false}>
      <FlatList
        data={entries}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 14 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={s.addBtn}>
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={s.addBtnText}>Aggiungi Voce Diario</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>📓</Text>
            <Text style={s.emptyText}>Nessuna voce nel diario</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <Text style={{ fontSize: 28 }}>{item.mood || '😊'}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.cardDate}>
                  {new Date((item.date || item.created_at) + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                {item.activities?.length > 0 && (
                  <View style={s.tagsRow}>
                    {item.activities.map((a: string, i: number) => (
                      <View key={i} style={s.tag}><Text style={s.tagText}>{a}</Text></View>
                    ))}
                  </View>
                )}
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity onPress={() => openEdit(item)} style={s.editBtn}>
                  <Ionicons name="pencil-outline" size={15} color={C.babyBlue} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn}>
                  <Ionicons name="trash-outline" size={15} color={C.red} />
                </TouchableOpacity>
              </View>
            </View>
            {(item.note || item.summary) && (
              <View style={s.noteBox}>
                <Text style={s.noteText}>{item.note || item.summary}</Text>
              </View>
            )}
          </View>
        )}
      />

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { setShowForm(false); resetForm(); }}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editEntry ? 'Modifica Voce' : 'Nuova Voce Diario'}</Text>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fl}>Data</Text>
            <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />

            <Text style={s.fl}>Umore della classe</Text>
            <View style={s.moodsRow}>
              {MOODS.map(m => (
                <TouchableOpacity key={m} onPress={() => setMood(m)}
                  style={[s.moodBtn, mood === m && s.moodBtnActive]}>
                  <Text style={{ fontSize: 26 }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fl}>Attività di oggi</Text>
            <View style={s.actsGrid}>
              {ACTIVITIES.map(a => (
                <TouchableOpacity key={a} onPress={() => toggleAct(a)}
                  style={[s.actBtn, acts.includes(a) && s.actBtnActive]}>
                  <Text style={[s.actText, acts.includes(a) && { color: C.white }]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fl}>Nota per i genitori *</Text>
            <TextInput style={s.textarea} value={note} onChangeText={setNote}
              multiline numberOfLines={5} placeholder="Come è andata oggi..."
              placeholderTextColor={C.muted} textAlignVertical="top" />

            <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave} disabled={saving}>
              <Text style={s.submitText}>
                {saving ? 'Salvataggio...' : editEntry ? 'Salva Modifiche' : 'Pubblica Diario'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#A7C7E7', borderRadius: 14, paddingVertical: 12, marginBottom: 12, justifyContent: 'center' },
  addBtnText:{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: C.muted, marginTop: 12 },
  card:      { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: C.border },
  cardTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  cardDate:  { fontSize: 13, fontWeight: '700', color: C.text, textTransform: 'capitalize' },
  tagsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag:       { backgroundColor: '#EBF0FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  tagText:   { fontSize: 10, color: '#A7C7E7', fontWeight: '700' },
  editBtn:   { padding: 6, backgroundColor: '#EBF0FF', borderRadius: 8 },
  deleteBtn: { padding: 6, backgroundColor: '#FEF2F2', borderRadius: 8 },
  noteBox:   { backgroundColor: '#EBF0FF20', borderRadius: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: '#A7C7E7', borderRadius: 0 },
  noteText:  { fontSize: 13, color: '#374151', lineHeight: 19 },
  modal:     { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:{ fontSize: 20, fontWeight: '800', color: C.text },
  fl:        { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 7, marginTop: 14 },
  input:     { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white },
  moodsRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  moodBtn:   { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  moodBtnActive:{ borderColor: '#A7C7E7', borderWidth: 2.5, backgroundColor: '#EBF0FF' },
  actsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  actBtnActive:{ backgroundColor: '#A7C7E7', borderColor: '#A7C7E7' },
  actText:   { fontSize: 13, fontWeight: '600', color: C.text },
  textarea:  { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 14, color: C.text, minHeight: 120, backgroundColor: C.white },
  submitBtn: { backgroundColor: '#A7C7E7', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText:{ color: C.white, fontWeight: '700', fontSize: 15 },
});
