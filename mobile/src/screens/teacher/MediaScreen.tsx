import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const { width } = Dimensions.get('window');
const IMG_SIZE  = (width - 48) / 2;
const PAGE      = 20;

async function compressToBase64(uri: string): Promise<string> {
  // Legge il file come base64
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:image/jpeg;base64,${base64}`;
}

export default function TeacherMedia() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;
  const [gallery, setGallery]   = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    Promise.all([
      api.get('/students'),
      api.get(`/gallery?class_id=${classId}&limit=${PAGE}&offset=0`),
    ]).then(([sRes, gRes]) => {
      setStudents(sRes.data || []);
      setGallery(gRes.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [classId]);

  const pickAndUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permesso necessario', 'Consenti accesso alla galleria.'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.6,
      exif: false,
    });

    if (result.canceled || !result.assets.length) return;
    if (selected.length === 0) { Alert.alert('Seleziona bambini', 'Seleziona almeno un bambino prima di caricare.'); return; }

    setUploading(true);
    let ok = 0;
    for (const asset of result.assets) {
      try {
        const dataURL = await compressToBase64(asset.uri);
        const today   = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
        const res = await api.post('/gallery/upload-b64', {
          class_id:    classId,
          student_ids: selected,
          media_type:  'photo',
          caption:     today,
          media_url:   dataURL,
        });
        setGallery(prev => [res.data, ...prev]);
        ok++;
      } catch {}
    }
    setUploading(false);
    setShowPicker(false);
    Alert.alert('✓', `${ok} foto caricate!`);
  };

  if (loading) return <ScreenLayout title="Galleria Media" loading />;

  return (
    <ScreenLayout title="Galleria Media" scrollable={false}
      rightAction={
        <TouchableOpacity onPress={() => setShowPicker(!showPicker)}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0FFF0', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, color: '#32CD32' }}>+</Text>
        </TouchableOpacity>
      }>

      {showPicker && (
        <View style={{ backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#1A202C', marginBottom: 10 }}>
            Seleziona i bambini nelle foto
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {students.map(s => (
              <TouchableOpacity key={s.id} onPress={() => setSelected(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: selected.includes(s.id) ? '#32CD32' : '#F3F4F6' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: selected.includes(s.id) ? '#FFF' : '#374151' }}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={pickAndUpload} disabled={uploading}
            style={{ backgroundColor: uploading ? '#86EFAC' : '#32CD32', borderRadius: 14, height: 48, justifyContent: 'center', alignItems: 'center' }}>
            {uploading ? <ActivityIndicator color="#FFF" /> : (
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>📷 Scegli e carica foto</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {gallery.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <Text style={{ fontSize: 48 }}>📷</Text>
          <Text style={{ color: '#9CA3AF', marginTop: 12 }}>Nessuna foto caricata</Text>
        </View>
      ) : (
        <FlatList
          data={gallery}
          keyExtractor={i => i.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item.thumbnail_url || item.media_url }}
              style={{ width: IMG_SIZE, height: IMG_SIZE, borderRadius: 14 }}
              resizeMode="cover"
            />
          )}
        />
      )}
    </ScreenLayout>
  );
}
