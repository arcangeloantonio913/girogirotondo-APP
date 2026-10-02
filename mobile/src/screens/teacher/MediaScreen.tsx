import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, Alert, Dimensions, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const { width } = Dimensions.get('window');
const IMG  = (width - 48) / 2;
const C = { ...tenant.colors, border: tenant.colors.divider };

export default function TeacherMedia() {
  const { user } = useAuth();
  // Una maestra può avere PIÙ classi: niente più class_ids[0] fisso → selettore.
  const classIds = React.useMemo(() => {
    const ids = [...(user?.class_ids || [])];
    if (user?.class_id && !ids.includes(user.class_id)) ids.push(user.class_id);
    return ids;
  }, [user]);
  const [classId, setClassId] = useState<string | undefined>(classIds[0]);
  useEffect(() => { setClassId(prev => (prev && classIds.includes(prev)) ? prev : classIds[0]); }, [classIds]);
  const [classes,   setClasses]   = useState<any[]>([]);
  const [items,     setItems]     = useState<any[]>([]);
  const [students,  setStudents]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form upload
  const [selStudents, setSelStudents] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState(true);
  const [caption,     setCaption]     = useState('');
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64: string; mime: string } | null>(null);

  // Nomi classi per il selettore (solo quelle della maestra)
  useEffect(() => {
    if (!classIds.length) { setLoading(false); return; }
    api.get('/classes').then(r => setClasses((r.data || []).filter((c: any) => classIds.includes(c.id)))).catch(() => {});
  }, [classIds]);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    Promise.allSettled([
      api.get(`/gallery?class_id=${classId}&limit=40`),
      api.get(`/students?class_id=${classId}`),
    ]).then(([gR, sR]) => {
      const val = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value.data : undefined;
      setItems(val(gR) || []);
      setStudents(val(sR) || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [classId]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permesso negato', 'Vai in Impostazioni > Privacy > Foto e concedi l\'accesso');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.4, // bassa qualità per upload veloce
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      const base64 = await new FileSystem.File(uri).base64();
      // MIME REALE dal picker. Su Android la foto scelta può essere PNG/WebP/HEIC:
      // etichettarla a forza come image/jpeg la rende illeggibile su iPhone (iOS è
      // rigoroso sul match tipo↔byte, Android è tollerante) → "foto non visualizzabili".
      const mime = asset.mimeType || 'image/jpeg';
      setPickedImage({ uri, base64, mime });
      setShowModal(true);
    } catch (e: any) {
      if(__DEV__) console.log('[MEDIA] pickImage error:', e?.message);
      Alert.alert('Errore selezione foto', e?.message || 'Errore sconosciuto');
    }
  };

  const toggleStudent = (id: string) => {
    setSelStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setAllStudents(false);
  };

  const handleUpload = async () => {
    if (!pickedImage) { Alert.alert('Seleziona una foto prima'); return; }
    if (!classId) { Alert.alert('Nessuna classe assegnata'); return; }
    setUploading(true);
    try {
      // student_ids: se non seleziona nessuno → foto a TUTTA la classe (caso comune:
      // foto di gruppo). Niente più blocco "seleziona almeno un bambino".
      const studentIds = (allStudents || selStudents.length === 0)
        ? students.map(s => s.id)
        : selStudents;

      const payload = {
        class_id: classId,
        student_ids: studentIds,
        media_url: `data:${pickedImage.mime || 'image/jpeg'};base64,${pickedImage.base64}`,
        media_type: 'photo',
        caption: caption || new Date().toLocaleDateString('it-IT'),
      };
      // Timeout esteso: le foto degli iPhone possono essere pesanti e superare i 20s di default
      const res = await api.post('/gallery/upload-b64', payload, { timeout: 90000 });
      setItems(prev => [res.data, ...prev]);
      setShowModal(false);
      setPickedImage(null);
      setCaption('');
      setSelStudents([]);
      setAllStudents(true);
    } catch (e: any) {
      const isTimeout = e?.code === 'ECONNABORTED';
      const msg = isTimeout
        ? 'Upload troppo lento: la foto è pesante o la connessione è debole. Riprova con una connessione migliore.'
        : (e?.response?.data?.detail || e?.message || 'Errore sconosciuto');
      if(__DEV__) console.log('[MEDIA] Upload error:', e?.response?.status, e?.code, msg);
      Alert.alert('Errore upload', msg);
    }
    finally { setUploading(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Elimina foto', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/gallery/${id}`); setItems(prev => prev.filter(i => i.id !== id)); }
        catch { Alert.alert('Errore'); }
      }},
    ]);
  };

  return (
    <ScreenLayout title="Carica Media" showBack color={C.accentGreen} loading={loading} scrollable={false}>
      {/* Selettore classe (solo se la maestra ha più classi) */}
      {classes.length > 1 && (
        <View style={s.classRow}>
          {classes.map(c => (
            <TouchableOpacity key={c.id} onPress={() => setClassId(c.id)}
              style={[s.classChip, classId === c.id && { backgroundColor: C.accentGreen, borderColor: C.accentGreen }]}>
              <Text style={[s.classChipTxt, classId === c.id && { color: C.white }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(item, i) => String(item?.id ?? i)}
        contentContainerStyle={{ padding: 10 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={pickImage} style={s.uploadBtn}>
            <Ionicons name="cloud-upload-outline" size={20} color={C.white} />
            <Text style={s.uploadBtnText}>Carica Foto</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>📸</Text>
            <Text style={s.emptyText}>Nessuna foto caricata</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.thumb}>
            <Image source={{ uri: item.media_url || item.url || item.thumbnail_url }}
              style={s.thumbImg} />
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.delBtn}>
              <Ionicons name="trash-outline" size={14} color={C.white} />
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Modal selezione bambini */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Pubblica foto</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {/* Preview */}
            {pickedImage && (
              <Image source={{ uri: pickedImage.uri }}
                style={{ width: '100%', height: 180, borderRadius: 14, marginBottom: 16 }}
                resizeMode="cover" />
            )}

            <Text style={s.fl}>Visibile a</Text>
            <TouchableOpacity onPress={() => { setAllStudents(true); setSelStudents([]); }}
              style={[s.optBtn, allStudents && s.optBtnActive]}>
              <Ionicons name="people-outline" size={18} color={allStudents ? C.white : C.accentGreen} />
              <Text style={[s.optText, allStudents && { color: C.white }]}>Tutta la classe ({students.length} bambini)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAllStudents(false)}
              style={[s.optBtn, !allStudents && s.optBtnActive]}>
              <Ionicons name="person-outline" size={18} color={!allStudents ? C.white : C.accentGreen} />
              <Text style={[s.optText, !allStudents && { color: C.white }]}>Bambini specifici</Text>
            </TouchableOpacity>

            {!allStudents && (
              <View style={s.studentsGrid}>
                {students.map(st => (
                  <TouchableOpacity key={st.id} onPress={() => toggleStudent(st.id)}
                    style={[s.studentChip, selStudents.includes(st.id) && s.studentChipActive]}>
                    <Text style={[s.studentChipText, selStudents.includes(st.id) && { color: C.white }]}>
                      {st.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={[s.uploadFinalBtn, uploading && { opacity: 0.6 }]}
              onPress={handleUpload} disabled={uploading}>
              {uploading
                ? <ActivityIndicator color={C.white} size="small" />
                : <><Ionicons name="cloud-upload-outline" size={18} color={C.white} />
                    <Text style={s.uploadFinalText}>Pubblica Foto</Text>
                  </>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  classRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  classChip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  classChipTxt:    { fontSize: 13, fontWeight: '600', color: C.text },
  uploadBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accentGreen, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 12, justifyContent: 'center' },
  uploadBtnText:   { color: C.white, fontWeight: '700', fontSize: 14 },
  empty:           { alignItems: 'center', paddingTop: 60 },
  emptyText:       { fontSize: 14, color: C.muted, marginTop: 12 },
  thumb:           { width: IMG, height: IMG, margin: 4, borderRadius: 14, overflow: 'hidden', backgroundColor: C.border, position: 'relative' },
  thumbImg:        { width: IMG, height: IMG },
  delBtn:          { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  modal:           { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:      { fontSize: 20, fontWeight: '800', color: C.text },
  fl:              { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, marginTop: 14 },
  optBtn:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.accentGreen, backgroundColor: C.white, marginBottom: 8 },
  optBtnActive:    { backgroundColor: C.accentGreen, borderColor: C.accentGreen },
  optText:         { fontSize: 14, fontWeight: '600', color: C.accentGreen, flex: 1 },
  studentsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  studentChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  studentChipActive:{ backgroundColor: C.accentGreen, borderColor: C.accentGreen },
  studentChipText: { fontSize: 13, fontWeight: '600', color: C.text },
  uploadFinalBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accentGreen, borderRadius: 14, paddingVertical: 14, justifyContent: 'center', marginTop: 20 },
  uploadFinalText: { color: C.white, fontWeight: '700', fontSize: 15 },
});
