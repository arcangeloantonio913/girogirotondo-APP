import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { babyPink: '#F4C2C2', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6' };

export default function TeacherAvvisi() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;
  const [avvisi, setAvvisi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body,  setBody]  = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/avvisi').then(r => setAvvisi(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Attenzione', 'Inserisci un titolo'); return; }
    setSaving(true);
    try {
      const res = await api.post('/avvisi', { class_id: classId, title, body, type: 'avviso' });
      setAvvisi(prev => [res.data, ...prev]);
      setShowForm(false); setTitle(''); setBody('');
    } catch { Alert.alert('Errore', 'Impossibile pubblicare'); }
    finally { setSaving(false); }
  };

  return (
    <ScreenLayout title="Avvisi" showBack color={C.babyPink} loading={loading} scrollable={false}>
      <FlatList
        data={avvisi}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={() => setShowForm(true)} style={s.addBtn}>
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={s.addBtnText}>Nuovo Avviso</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 48 }}>📢</Text><Text style={s.emptyText}>Nessun avviso</Text></View>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.cardDate}>{new Date(item.created_at || item.date || Date.now()).toLocaleDateString('it-IT')}</Text>
            <Text style={s.cardTitle}>{item.title}</Text>
            {item.body && <Text style={s.cardBody}>{item.body}</Text>}
          </View>
        )}
      />
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuovo Avviso</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity>
          </View>
          <Text style={s.formLabel}>Titolo</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Titolo avviso..." />
          <Text style={s.formLabel}>Messaggio</Text>
          <TextInput style={s.textarea} value={body} onChangeText={setBody} multiline numberOfLines={4} placeholder="Testo avviso..." textAlignVertical="top" />
          <TouchableOpacity style={s.submitBtn} onPress={handleSave} disabled={saving}>
            <Text style={s.submitText}>{saving ? 'Pubblicazione...' : 'Pubblica Avviso'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.babyPink, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12, justifyContent: 'center' },
  addBtnText:{ color: C.white, fontWeight: '700', fontSize: 14 },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: C.muted, marginTop: 12 },
  card:      { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardDate:  { fontSize: 11, color: C.muted, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  cardBody:  { fontSize: 12, color: '#374151', marginTop: 4, lineHeight: 18 },
  modal:     { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:{ fontSize: 20, fontWeight: '800', color: C.text },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8, marginTop: 16 },
  input:     { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white },
  textarea:  { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 14, color: C.text, minHeight: 120, backgroundColor: C.white },
  submitBtn: { backgroundColor: C.babyPink, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText:{ color: C.white, fontWeight: '700', fontSize: 15 },
});
