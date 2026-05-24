import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ScrollView, Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { primary: '#4169E1', babyPink: '#FF69B4', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6', red: '#EF4444' };

const SEDI = [
  { id: 'girogirotondo',   label: 'Girogirotondo',   color: '#4169E1' },
  { id: 'il-magico-mondo', label: 'Il Magico Mondo', color: '#FF69B4' },
];

const FILE_ICONS: Record<string, string> = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
  ppt: '📊', pptx: '📊', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', default: '📎',
};

function getFileIcon(name: string) {
  const ext = name?.split('.').pop()?.toLowerCase() || 'default';
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

export default function AdminAvvisi() {
  const { user, sede } = useAuth();
  const [avvisi,  setAvvisi]  = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm,setShowForm]= useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // Form
  const [title,      setTitle]      = useState('');
  const [body,       setBody]       = useState('');
  const [selSedi,    setSelSedi]    = useState<string[]>(['girogirotondo', 'il-magico-mondo']);
  const [selRoles,   setSelRoles]   = useState<string[]>(['parent', 'teacher']);
  const [selClasses, setSelClasses] = useState<string[]>([]);
  const [allClasses, setAllClasses] = useState(true);
  const [allegati,   setAllegati]   = useState<{ name: string; mime: string; base64: string }[]>([]);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    Promise.all([api.get('/avvisi'), api.get('/classes')])
      .then(([aR, cR]) => { setAvvisi(aR.data || []); setClasses(cR.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  const resetForm = () => {
    setTitle(''); setBody('');
    setSelSedi(['girogirotondo', 'il-magico-mondo']);
    setSelRoles(['parent', 'teacher']);
    setSelClasses([]); setAllClasses(true);
    setAllegati([]); setEditing(null);
  };

  const openEdit = (a: any) => {
    setEditing(a); setTitle(a.title || ''); setBody(a.body || a.message || '');
    setSelSedi(a.sedi || ['girogirotondo']);
    setSelRoles(a.target_roles || ['parent']);
    setSelClasses(a.class_ids || []); setAllClasses(!a.class_ids?.length);
    setAllegati([]); setShowForm(true);
  };

  // ── Allegati ──────────────────────────────────────────────────────────────

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      setAllegati(prev => [...prev, {
        name: asset.name,
        mime: asset.mimeType || 'application/octet-stream',
        base64: `data:${asset.mimeType};base64,${base64}`,
      }]);
    } catch (e) {
      Alert.alert('Errore', 'Impossibile caricare il file');
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permesso negato'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const name = asset.uri.split('/').pop() || 'immagine.jpg';
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    setAllegati(prev => [...prev, {
      name,
      mime: 'image/jpeg',
      base64: `data:image/jpeg;base64,${base64}`,
    }]);
  };

  const removeAllegato = (idx: number) => {
    setAllegati(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Attenzione', 'Il titolo è obbligatorio'); return; }
    setSaving(true);
    try {
      const payload: any = {
        title, body,
        sedi: selSedi,
        target_roles: selRoles,
        class_ids: allClasses ? [] : selClasses,
      };
      // Allega il primo file se presente (il backend supporta un allegato per avviso)
      if (allegati.length > 0) {
        payload.attachment_data = allegati[0].base64;
        payload.attachment_name = allegati[0].name;
        payload.attachment_mime = allegati[0].mime;
      }
      let res;
      if (editing) {
        res = await api.put(`/avvisi/${editing.id}`, payload);
        setAvvisi(prev => prev.map(a => a.id === editing.id ? res.data : a));
      } else {
        res = await api.post('/avvisi', payload);
        setAvvisi(prev => [res.data, ...prev]);
      }
      setShowForm(false); resetForm();
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile salvare');
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Elimina avviso', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/avvisi/${id}`); setAvvisi(prev => prev.filter(a => a.id !== id)); }
        catch { Alert.alert('Errore', 'Impossibile eliminare'); }
      }},
    ]);
  };

  const toggleItem = (arr: string[], item: string, set: (v: string[]) => void) =>
    set(arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScreenLayout title="Avvisi" showBack color={C.primary} loading={loading} scrollable={false}>
      <FlatList
        data={avvisi}
        keyExtractor={a => a.id}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={s.addBtn}>
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={s.addBtnText}>Nuovo Avviso</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={s.empty}><Text style={{ fontSize: 48 }}>📢</Text>
            <Text style={s.emptyText}>Nessun avviso pubblicato</Text></View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardDate}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                </Text>
                <Text style={s.cardTitle}>{item.title}</Text>
                {(item.body || item.message) &&
                  <Text style={s.cardBody} numberOfLines={2}>{item.body || item.message}</Text>}
                {/* Allegato */}
                {item.attachment_name && (
                  <TouchableOpacity onPress={() => item.attachment_url && Linking.openURL(item.attachment_url)}
                    style={s.attachRow}>
                    <Text style={{ fontSize: 16 }}>{getFileIcon(item.attachment_name)}</Text>
                    <Text style={s.attachName} numberOfLines={1}>{item.attachment_name}</Text>
                    <Ionicons name="download-outline" size={14} color={C.primary} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity onPress={() => openEdit(item)} style={s.editBtn}>
                  <Ionicons name="pencil-outline" size={16} color={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn}>
                  <Ionicons name="trash-outline" size={16} color={C.red} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.badgesRow}>
              {(item.sedi || []).map((sd: string) => {
                const info = SEDI.find(x => x.id === sd);
                return info ? (
                  <View key={sd} style={[s.badge, { backgroundColor: info.color + '15' }]}>
                    <Text style={[s.badgeText, { color: info.color }]}>{info.label}</Text>
                  </View>
                ) : null;
              })}
              {(item.target_roles || []).map((r: string) => (
                <View key={r} style={[s.badge, { backgroundColor: '#F3F4F6' }]}>
                  <Text style={[s.badgeText, { color: C.muted }]}>
                    {r === 'parent' ? 'Genitori' : 'Maestre'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      />

      {/* ── Modale crea/modifica ─────────────────────────────────────────── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { setShowForm(false); resetForm(); }}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editing ? 'Modifica Avviso' : 'Nuovo Avviso'}</Text>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>

            <Text style={s.fieldLabel}>Titolo *</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Titolo avviso" />

            <Text style={s.fieldLabel}>Messaggio</Text>
            <TextInput style={[s.input, { height: 90 }]} value={body} onChangeText={setBody}
              multiline placeholder="Testo dell'avviso..." textAlignVertical="top" />

            {/* Sedi */}
            <Text style={s.fieldLabel}>Sede</Text>
            <View style={s.chipRow}>
              {SEDI.map(sd => (
                <TouchableOpacity key={sd.id} onPress={() => toggleItem(selSedi, sd.id, setSelSedi)}
                  style={[s.chip, selSedi.includes(sd.id) && { backgroundColor: sd.color, borderColor: sd.color }]}>
                  <Text style={[s.chipText, selSedi.includes(sd.id) && { color: C.white }]}>{sd.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Destinatari */}
            <Text style={s.fieldLabel}>Destinatari</Text>
            <View style={s.chipRow}>
              {[{ id: 'parent', label: 'Genitori' }, { id: 'teacher', label: 'Maestre' }].map(r => (
                <TouchableOpacity key={r.id} onPress={() => toggleItem(selRoles, r.id, setSelRoles)}
                  style={[s.chip, selRoles.includes(r.id) && { backgroundColor: C.primary, borderColor: C.primary }]}>
                  <Text style={[s.chipText, selRoles.includes(r.id) && { color: C.white }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Classi */}
            <Text style={s.fieldLabel}>Classi</Text>
            <TouchableOpacity onPress={() => { setAllClasses(true); setSelClasses([]); }}
              style={[s.chip, allClasses && { backgroundColor: '#32CD32', borderColor: '#32CD32' }, { marginBottom: 8 }]}>
              <Text style={[s.chipText, allClasses && { color: C.white }]}>✓ Tutte le classi</Text>
            </TouchableOpacity>
            <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
              {classes.map(cls => (
                <TouchableOpacity key={cls.id} onPress={() => { setAllClasses(false); toggleItem(selClasses, cls.id, setSelClasses); }}
                  style={[s.chip, selClasses.includes(cls.id) && { backgroundColor: C.primary, borderColor: C.primary }]}>
                  <Text style={[s.chipText, selClasses.includes(cls.id) && { color: C.white }]}>{cls.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Allegati */}
            <Text style={s.fieldLabel}>Allegati</Text>
            <View style={s.attachButtons}>
              <TouchableOpacity onPress={pickDocument} style={s.attachBtn}>
                <Ionicons name="document-attach-outline" size={18} color={C.primary} />
                <Text style={s.attachBtnText}>PDF / Word / Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImage} style={s.attachBtn}>
                <Ionicons name="image-outline" size={18} color={C.primary} />
                <Text style={s.attachBtnText}>Immagine</Text>
              </TouchableOpacity>
            </View>

            {allegati.map((a, i) => (
              <View key={i} style={s.allegato}>
                <Text style={{ fontSize: 20 }}>{getFileIcon(a.name)}</Text>
                <Text style={s.allegatoName} numberOfLines={1}>{a.name}</Text>
                <TouchableOpacity onPress={() => removeAllegato(i)}>
                  <Ionicons name="close-circle" size={20} color={C.red} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={s.submitText}>{saving ? 'Pubblicazione...' : editing ? 'Salva Modifiche' : 'Pubblica Avviso'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 12, marginBottom: 12, justifyContent: 'center' },
  addBtnText:   { color: C.white, fontWeight: '700', fontSize: 14 },
  empty:        { alignItems: 'center', paddingTop: 60 },
  emptyText:    { fontSize: 14, color: C.muted, marginTop: 12 },
  card:         { backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: C.border },
  cardTop:      { flexDirection: 'row', gap: 10, marginBottom: 6 },
  cardDate:     { fontSize: 10, color: C.muted, marginBottom: 2 },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: C.text },
  cardBody:     { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 17 },
  attachRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: '#EBF0FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  attachName:   { flex: 1, fontSize: 11, color: C.primary, fontWeight: '600' },
  editBtn:      { padding: 8, backgroundColor: '#EBF0FF', borderRadius: 8 },
  deleteBtn:    { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },
  badgesRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge:        { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:    { fontSize: 10, fontWeight: '700' },
  modal:        { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: C.text },
  fieldLabel:   { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6, marginTop: 14 },
  input:        { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white },
  chipRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  chipText:     { fontSize: 13, fontWeight: '600', color: C.text },
  attachButtons:{ flexDirection: 'row', gap: 10, marginBottom: 10 },
  attachBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.primary, backgroundColor: '#EBF0FF' },
  attachBtnText:{ fontSize: 12, color: C.primary, fontWeight: '700' },
  allegato:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 0.5, borderColor: C.border },
  allegatoName: { flex: 1, fontSize: 12, color: C.text, fontWeight: '600' },
  submitBtn:    { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText:   { color: C.white, fontWeight: '700', fontSize: 15 },
});
