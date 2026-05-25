import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { primary: '#4169E1', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6', red: '#EF4444' };

export default function AdminModulistica() {
  const { sede } = useAuth();
  const [docs,    setDocs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm,setShowForm]= useState(false);
  const [title,   setTitle]   = useState('');
  const [desc,    setDesc]    = useState('');
  const [file,    setFile]    = useState<{ name: string; base64: string } | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [receiptsDoc, setReceiptsDoc] = useState<any | null>(null);
  const [receipts,    setReceipts]    = useState<any[]>([]);

  useEffect(() => {
    api.get('/documents').then(r => setDocs(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  const pickFile = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permesso negato'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const name = uri.split('/').pop() || 'documento.jpg';
    setFile({ name, base64: `data:image/jpeg;base64,${base64}` });
  };

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Attenzione', 'Il titolo è obbligatorio'); return; }
    setSaving(true);
    try {
      const res = await api.post('/documents/upload-b64', { title, description: desc, data: file?.base64, filename: file?.name });
      setDocs(prev => [res.data, ...prev]);
      setShowForm(false); setTitle(''); setDesc(''); setFile(null);
    } catch { Alert.alert('Errore', 'Impossibile caricare il documento'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Elimina documento', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/documents/${id}`); setDocs(prev => prev.filter(d => d.id !== id)); }
        catch { Alert.alert('Errore', 'Impossibile eliminare'); }
      }},
    ]);
  };

  const viewReceipts = async (doc: any) => {
    try {
      const res = await api.get(`/read-receipts?document_id=${doc.id}`);
      setReceipts(res.data || []);
      setReceiptsDoc(doc);
    } catch { Alert.alert('Errore', 'Impossibile caricare le ricevute'); }
  };

  return (
    <ScreenLayout title="Modulistica" showBack color={C.primary} loading={loading} scrollable={false}>
      <FlatList
        data={docs}
        keyExtractor={d => d.id}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={() => setShowForm(true)} style={s.addBtn}>
            <Ionicons name="cloud-upload-outline" size={18} color={C.white} />
            <Text style={s.addBtnText}>Carica Documento</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 48 }}>📁</Text><Text style={s.emptyText}>Nessun documento caricato</Text></View>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={s.docIcon}><Ionicons name="document-text-outline" size={22} color={C.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.docTitle}>{item.title}</Text>
                {item.description && <Text style={s.docDesc} numberOfLines={1}>{item.description}</Text>}
                <TouchableOpacity onPress={() => viewReceipts(item)} style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: C.primary, fontWeight: '600' }}>
                    Prese visione: {item.read_count || 0}/{item.total_parents || '—'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color={C.red} />
              </TouchableOpacity>
            </View>
            {/* Progress bar */}
            {item.total_parents > 0 && (
              <View style={s.progressBg}>
                <View style={[s.progressFg, { width: `${Math.min(100, (item.read_count / item.total_parents) * 100)}%` as any }]} />
              </View>
            )}
          </View>
        )}
      />

      {/* Form upload */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Carica Documento</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity>
          </View>
          <Text style={s.fieldLabel}>Titolo *</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Titolo documento" />
          <Text style={s.fieldLabel}>Descrizione</Text>
          <TextInput style={[s.input, { height: 80 }]} value={desc} onChangeText={setDesc} multiline placeholder="Descrizione opzionale" textAlignVertical="top" />
          <Text style={s.fieldLabel}>File (immagine)</Text>
          <TouchableOpacity onPress={pickFile} style={s.fileBtn}>
            <Ionicons name="image-outline" size={20} color={C.primary} />
            <Text style={s.fileBtnText}>{file ? file.name : 'PDF, Word, Excel o immagine...'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
            <Text style={s.submitText}>{saving ? 'Caricamento...' : 'Pubblica Documento'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Receipts modal */}
      <Modal visible={!!receiptsDoc} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReceiptsDoc(null)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Prese Visione</Text>
            <TouchableOpacity onPress={() => setReceiptsDoc(null)}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity>
          </View>
          <Text style={[s.fieldLabel, { marginBottom: 12 }]}>{receiptsDoc?.title}</Text>
          {receipts.length === 0
            ? <Text style={{ color: C.muted, textAlign: 'center', marginTop: 40 }}>Nessuna presa visione ancora</Text>
            : receipts.map((r: any, i: number) => (
              <View key={i} style={s.receiptRow}>
                <View style={s.receiptAvatar}><Text style={{ fontWeight: '700', color: C.primary }}>{r.parent_name?.charAt(0) || '?'}</Text></View>
                <Text style={{ flex: 1, fontSize: 13, color: C.text }}>{r.parent_name || r.parent_id}</Text>
                <Ionicons name="checkmark-circle" size={18} color="#32CD32" />
              </View>
            ))
          }
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 12, marginBottom: 12, justifyContent: 'center' },
  addBtnText:  { color: C.white, fontWeight: '700', fontSize: 14 },
  empty:       { alignItems: 'center', paddingTop: 60 },
  emptyText:   { fontSize: 14, color: C.muted, marginTop: 12 },
  card:        { backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: C.border },
  cardTop:     { flexDirection: 'row', gap: 10, marginBottom: 8 },
  docIcon:     { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EBF0FF', alignItems: 'center', justifyContent: 'center' },
  docTitle:    { fontSize: 14, fontWeight: '700', color: C.text },
  docDesc:     { fontSize: 12, color: C.muted, marginTop: 2 },
  deleteBtn:   { padding: 8 },
  progressBg:  { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, overflow: 'hidden' },
  progressFg:  { height: 4, backgroundColor: C.primary, borderRadius: 2 },
  modal:       { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:  { fontSize: 20, fontWeight: '800', color: C.text },
  fieldLabel:  { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 6, marginTop: 14 },
  input:       { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white },
  fileBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, backgroundColor: C.white },
  fileBtnText: { fontSize: 13, color: C.primary, flex: 1 },
  submitBtn:   { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText:  { color: C.white, fontWeight: '700', fontSize: 15 },
  receiptRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.border },
  receiptAvatar:{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EBF0FF', alignItems: 'center', justifyContent: 'center' },
});
