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

const { width } = Dimensions.get('window');
const IMG  = (width - 48) / 2;
const C = { green: '#32CD32', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6', pink: '#FF69B4' };

export default function TeacherMedia() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;
  const [items,     setItems]     = useState<any[]>([]);
  const [students,  setStudents]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form upload
  const [selStudents, setSelStudents] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState(true);
  const [caption,     setCaption]     = useState('');
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64: string } | null>(null);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    Promise.all([
      api.get(`/gallery?class_id=${classId}&limit=40`),
      api.get(`/students?class_id=${classId}`),
    ]).then(([gR, sR]) => {
      setItems(gR.data || []);
      setStudents(sR.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [classId]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permesso negato', 'Vai in Impostazioni > Privacy > Foto e concedi l\'accesso');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.4, // bassa qualità per upload veloce
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    setPickedImage({ uri, base64 });
    setShowModal(true);
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
      // student_ids: tutti o selezionati
      const studentIds = allStudents
        ? students.map(s => s.id)
        : selStudents;

      if (studentIds.length === 0) {
        Alert.alert('Seleziona almeno un bambino'); setUploading(false); return;
      }

      const payload = {
        class_id: classId,
        student_ids: studentIds,
        media_url: `data:image/jpeg;base64,${pickedImage.base64}`,
        media_type: 'photo',
        caption: caption || new Date().toLocaleDateString('it-IT'),
      };
      const res = await api.post('/gallery', payload);
      setItems(prev => [res.data, ...prev]);
      setShowModal(false);
      setPickedImage(null);
      setCaption('');
      setSelStudents([]);
      setAllStudents(true);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Errore sconosciuto';
      console.log('[MEDIA] Upload error:', e?.response?.status, msg);
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
    <ScreenLayout title="Carica Media" showBack color={C.green} loading={loading} scrollable={false}>
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(_, i) => String(i)}
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
              <Ionicons name="people-outline" size={18} color={allStudents ? C.white : C.green} />
              <Text style={[s.optText, allStudents && { color: C.white }]}>Tutta la classe ({students.length} bambini)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAllStudents(false)}
              style={[s.optBtn, !allStudents && s.optBtnActive]}>
              <Ionicons name="person-outline" size={18} color={!allStudents ? C.white : C.green} />
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
  uploadBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.green, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 12, justifyContent: 'center' },
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
  optBtn:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.green, backgroundColor: C.white, marginBottom: 8 },
  optBtnActive:    { backgroundColor: C.green, borderColor: C.green },
  optText:         { fontSize: 14, fontWeight: '600', color: C.green, flex: 1 },
  studentsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  studentChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  studentChipActive:{ backgroundColor: C.green, borderColor: C.green },
  studentChipText: { fontSize: 13, fontWeight: '600', color: C.text },
  uploadFinalBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.green, borderRadius: 14, paddingVertical: 14, justifyContent: 'center', marginTop: 20 },
  uploadFinalText: { color: C.white, fontWeight: '700', fontSize: 15 },
});
