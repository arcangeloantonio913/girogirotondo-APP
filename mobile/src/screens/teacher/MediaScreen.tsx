import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Alert, Dimensions, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const { width } = Dimensions.get('window');
const IMG = (width - 48) / 2;
const C = { babyGreen: '#98FB98', green: '#32CD32', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6' };

export default function TeacherMedia() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;
  const [items,    setItems]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    api.get(`/gallery?class_id=${classId}&limit=40`)
      .then(r => setItems(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [classId]);

  const handlePick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permesso negato', 'Concedi l\'accesso alla galleria nelle impostazioni'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const res = await api.post('/gallery', { class_id: classId, media_url: `data:image/jpeg;base64,${base64}`, media_type: 'image' });
      setItems(prev => [res.data, ...prev]);
    } catch { Alert.alert('Errore', 'Impossibile caricare la foto'); }
    finally { setUploading(false); }
  };

  return (
    <ScreenLayout title="Carica Media" showBack color={C.babyGreen} loading={loading} scrollable={false}>
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={handlePick} disabled={uploading} style={[s.uploadBtn, { opacity: uploading ? 0.6 : 1 }]}>
            {uploading ? <ActivityIndicator color={C.white} size="small" /> : <Ionicons name="cloud-upload-outline" size={20} color={C.white} />}
            <Text style={s.uploadBtnText}>{uploading ? 'Caricamento...' : 'Carica Foto'}</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 48 }}>📸</Text><Text style={s.emptyText}>Nessuna foto caricata</Text></View>}
        renderItem={({ item }) => (
          <View style={s.thumb}>
            <Image source={{ uri: item.media_url || item.url }} style={s.thumbImg} />
          </View>
        )}
      />
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  uploadBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#32CD32', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 12, justifyContent: 'center' },
  uploadBtnText:{ color: C.white, fontWeight: '700', fontSize: 14 },
  empty:      { alignItems: 'center', paddingTop: 60 },
  emptyText:  { fontSize: 14, color: C.muted, marginTop: 12 },
  thumb:      { width: IMG, height: IMG, margin: 4, borderRadius: 14, overflow: 'hidden', backgroundColor: C.border },
  thumbImg:   { width: IMG, height: IMG },
});
