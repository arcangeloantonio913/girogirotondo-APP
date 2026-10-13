import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, Alert, Dimensions, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useScreenRefresh } from '../../lib/useScreenRefresh';
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
  const [loadErr,   setLoadErr]   = useState<string | null>(null);
  const [retry,     setRetry]     = useState(0);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const refreshTick = useScreenRefresh();   // foto pubblicate da altre maestre / da web

  // Form upload
  const [selStudents, setSelStudents] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState(true);
  const [caption,     setCaption]     = useState('');
  const [pickedImages, setPickedImages] = useState<{ uri: string; base64: string; mime: string }[]>([]);
  const [uploadProg, setUploadProg] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  // Nomi classi per il selettore (solo quelle della maestra)
  useEffect(() => {
    if (!classIds.length) { setLoading(false); return; }
    setLoadErr(null);
    api.get('/classes').then(r => { setClasses((r.data || []).filter((c: any) => classIds.includes(c.id))); setLoadErr(null); }).catch(() => { setLoadErr('Impossibile caricare le classi. Verifica la connessione e riprova.'); setLoading(false); });
  }, [classIds, retry]);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    Promise.allSettled([
      api.get(`/gallery?class_id=${classId}&limit=40`),
      api.get(`/students?class_id=${classId}`),
    ]).then(([gR, sR]) => {
      const val = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value.data : undefined;
      setItems(val(gR) || []);
      setStudents(val(sR) || []);
    }).finally(() => setLoading(false));
  }, [classId, refreshTick, retry]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permesso negato', 'Vai in Impostazioni > Privacy > Foto e concedi l\'accesso');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8, // qualità alta (prima 0.4 = foto sgranate). Upload più pesante ma gestito dal timeout 90s
        allowsMultipleSelection: true,   // più foto in una volta sola
        selectionLimit: 10,
      });
      if (result.canceled || !result.assets?.length) return;
      // MIME REALE dal picker. Su Android la foto scelta può essere PNG/WebP/HEIC:
      // etichettarla a forza come image/jpeg la rende illeggibile su iPhone (iOS è
      // rigoroso sul match tipo↔byte, Android è tollerante) → "foto non visualizzabili".
      const imgs = await Promise.all(result.assets.map(async (asset) => ({
        uri: asset.uri,
        base64: await new FileSystem.File(asset.uri).base64(),
        mime: asset.mimeType || 'image/jpeg',
      })));
      setPickedImages(imgs);
      setShowModal(true);
    } catch (e: any) {
      if(__DEV__) console.log('[MEDIA] pickImage error:', e?.message);
      Alert.alert('Errore selezione foto', e?.message || 'Errore sconosciuto');
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permesso negato', 'Vai in Impostazioni e concedi l\'accesso alla fotocamera');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const img = {
        uri: asset.uri,
        base64: await new FileSystem.File(asset.uri).base64(),
        mime: asset.mimeType || 'image/jpeg',
      };
      setPickedImages([img]);
      setShowModal(true);
    } catch (e: any) {
      if(__DEV__) console.log('[MEDIA] takePhoto error:', e?.message);
      Alert.alert('Errore fotocamera', e?.message || 'Errore sconosciuto');
    }
  };

  const toggleStudent = (id: string) => {
    setSelStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setAllStudents(false);
  };

  const handleUpload = async () => {
    if (!pickedImages.length) { Alert.alert('Seleziona almeno una foto'); return; }
    if (!classId) { Alert.alert('Nessuna classe assegnata'); return; }
    setUploading(true);
    // student_ids: se non seleziona nessuno → foto a TUTTA la classe (caso comune:
    // foto di gruppo). Niente più blocco "seleziona almeno un bambino".
    const studentIds = (allStudents || selStudents.length === 0)
      ? students.map(s => s.id)
      : selStudents;

    const uploaded: any[] = [];
    let failures = 0;
    setUploadProg({ done: 0, total: pickedImages.length });
    // Caricamento SEQUENZIALE (una foto alla volta) per non saturare la connessione.
    for (let i = 0; i < pickedImages.length; i++) {
      const img = pickedImages[i];
      try {
        const payload = {
          class_id: classId,
          student_ids: studentIds,
          media_url: `data:${img.mime || 'image/jpeg'};base64,${img.base64}`,
          media_type: 'photo',
          caption: caption || new Date().toLocaleDateString('it-IT'),
        };
        // Timeout esteso: le foto degli iPhone possono essere pesanti e superare i 20s di default
        const res = await api.post('/gallery/upload-b64', payload, { timeout: 90000 });
        uploaded.push(res.data);
      } catch (e: any) {
        failures++;
        if(__DEV__) console.log('[MEDIA] Upload error:', e?.response?.status, e?.code);
      }
      setUploadProg({ done: i + 1, total: pickedImages.length });
    }

    if (uploaded.length) setItems(prev => [...uploaded, ...prev]);
    setShowModal(false);
    setPickedImages([]);
    setCaption('');
    setSelStudents([]);
    setAllStudents(true);
    setUploading(false);
    if (failures) {
      Alert.alert('Caricamento parziale', `${uploaded.length} foto caricate, ${failures} non riuscite (foto pesanti o connessione debole). Riprova con quelle mancanti.`);
    }
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
    <ScreenLayout title="Carica Media" showBack color={C.primary} loading={loading} scrollable={false} error={loadErr} onRetry={() => setRetry(x => x + 1)}>
      {/* Selettore classe (solo se la maestra ha più classi) */}
      {classes.length > 1 && (
        <View style={s.classRow}>
          {classes.map(c => (
            <TouchableOpacity key={c.id} onPress={() => setClassId(c.id)}
              style={[s.classChip, classId === c.id && { backgroundColor: C.primary, borderColor: C.primary }]}>
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
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <TouchableOpacity onPress={takePhoto} style={[s.uploadBtn, { flex: 1, marginBottom: 0 }]}>
              <Ionicons name="camera-outline" size={20} color={C.white} />
              <Text style={s.uploadBtnText}>Scatta Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickImage} style={[s.uploadBtn, { flex: 1, marginBottom: 0, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.primary }]}>
              <Ionicons name="images-outline" size={20} color={C.primary} />
              <Text style={[s.uploadBtnText, { color: C.primary }]}>Dalla Galleria</Text>
            </TouchableOpacity>
          </View>
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
            {/* Preview (una o più foto) */}
            {pickedImages.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                {pickedImages.length === 1 ? (
                  <Image source={{ uri: pickedImages[0].uri }}
                    style={{ width: '100%', height: 180, borderRadius: 14 }}
                    resizeMode="cover" />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {pickedImages.map((img, i) => (
                      <Image key={i} source={{ uri: img.uri }}
                        style={{ width: 96, height: 96, borderRadius: 12, marginRight: 8 }}
                        resizeMode="cover" />
                    ))}
                  </ScrollView>
                )}
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 6, fontWeight: '600' }}>
                  {pickedImages.length} foto selezionate
                </Text>
              </View>
            )}

            <Text style={s.fl}>Visibile a</Text>
            <TouchableOpacity onPress={() => { setAllStudents(true); setSelStudents([]); }}
              style={[s.optBtn, allStudents && s.optBtnActive]}>
              <Ionicons name="people-outline" size={18} color={allStudents ? C.white : C.primary} />
              <Text style={[s.optText, allStudents && { color: C.white }]}>Tutta la classe ({students.length} bambini)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAllStudents(false)}
              style={[s.optBtn, !allStudents && s.optBtnActive]}>
              <Ionicons name="person-outline" size={18} color={!allStudents ? C.white : C.primary} />
              <Text style={[s.optText, !allStudents && { color: C.white }]}>Bambini specifici</Text>
            </TouchableOpacity>

            {!allStudents && (
              <View style={s.studentsGrid}>
                {students.map(st => (
                  <TouchableOpacity key={st.id} onPress={() => toggleStudent(st.id)}
                    style={[s.studentChip, selStudents.includes(st.id) && s.studentChipActive]}>
                    <Text style={[s.studentChipText, selStudents.includes(st.id) && { color: C.white }]}>
                      {st.name} {st.cognome || ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={[s.uploadFinalBtn, uploading && { opacity: 0.6 }]}
              onPress={handleUpload} disabled={uploading}>
              {uploading
                ? <><ActivityIndicator color={C.white} size="small" />
                    <Text style={s.uploadFinalText}>  Caricamento {uploadProg.done}/{uploadProg.total}…</Text>
                  </>
                : <><Ionicons name="cloud-upload-outline" size={18} color={C.white} />
                    <Text style={s.uploadFinalText}>Pubblica {pickedImages.length > 1 ? `${pickedImages.length} foto` : 'Foto'}</Text>
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
  uploadBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 12, justifyContent: 'center' },
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
  optBtn:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.primary, backgroundColor: C.white, marginBottom: 8 },
  optBtnActive:    { backgroundColor: C.primary, borderColor: C.primary },
  optText:         { fontSize: 14, fontWeight: '600', color: C.primary, flex: 1 },
  studentsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  studentChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  studentChipActive:{ backgroundColor: C.primary, borderColor: C.primary },
  studentChipText: { fontSize: 13, fontWeight: '600', color: C.text },
  uploadFinalBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, justifyContent: 'center', marginTop: 20 },
  uploadFinalText: { color: C.white, fontWeight: '700', fontSize: 15 },
});
