import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  Modal, Dimensions, ActivityIndicator, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const PAGE   = 20;
const { width } = Dimensions.get('window');
const IMG_SIZE = (width - 48) / 2;

export default function ParentGallery() {
  const { activeChildId, user } = useAuth();
  const [tab, setTab]           = useState<'personale' | 'classe'>('personale');
  const [items, setItems]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]   = useState(false);
  const [offset, setOffset]     = useState(0);
  const [classId, setClassId]   = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<any | null>(null);

  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;

  const load = useCallback(async (newTab = tab, newOffset = 0) => {
    if (newOffset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      let url = '';
      if (newTab === 'personale') {
        url = `/gallery?student_id=${childId}&limit=${PAGE}&offset=${newOffset}`;
      } else {
        if (!classId) return;
        url = `/gallery?class_id=${classId}&limit=${PAGE}&offset=${newOffset}`;
      }
      const res = await api.get(url);
      const data = res.data || [];
      setItems(prev => newOffset === 0 ? data : [...prev, ...data]);
      setHasMore(data.length === PAGE);
      setOffset(newOffset);
    } catch {}
    finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [childId, classId, tab]);

  useEffect(() => {
    if (!childId) return;
    // Carica class_id
    api.get(`/students/${childId}`).then(r => setClassId(r.data?.class_id)).catch(() => {});
    load('personale', 0);
  }, [childId]);

  const switchTab = (t: 'personale' | 'classe') => {
    setTab(t);
    setItems([]);
    load(t, 0);
  };

  const sharePhoto = async (item: any) => {
    try {
      await Share.share({ url: item.media_url, message: item.caption || 'Foto' });
    } catch {}
  };

  return (
    <ScreenLayout title="Galleria Foto" scrollable={false}>
      {/* Tab */}
      <View style={{ flexDirection: 'row', padding: 4, backgroundColor: '#FFF', borderRadius: 16, margin: 16, marginBottom: 8 }}>
        {(['personale', 'classe'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => switchTab(t)}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
              backgroundColor: tab === t ? (t === 'personale' ? '#FF69B4' : '#4169E1') : 'transparent',
            }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: tab === t ? '#FFF' : '#9CA3AF' }}>
              {t === 'personale' ? '📸 Personale' : '🏫 Classe'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF69B4" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Ionicons name="images-outline" size={64} color="#E5E7EB" />
          <Text style={{ color: '#9CA3AF', marginTop: 12 }}>Nessuna foto disponibile</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          onEndReached={() => hasMore && !loadingMore && load(tab, offset + PAGE)}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#FF69B4" style={{ margin: 16 }} /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setLightbox(item)} style={{ borderRadius: 14, overflow: 'hidden' }}>
              <Image
                source={{ uri: item.thumbnail_url || item.media_url }}
                style={{ width: IMG_SIZE, height: IMG_SIZE }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Lightbox */}
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <TouchableOpacity
            onPress={() => setLightbox(null)}
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          {lightbox && (
            <>
              <Image
                source={{ uri: lightbox.media_url }}
                style={{ width: width - 32, height: width - 32, borderRadius: 16 }}
                resizeMode="contain"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, width: width - 32 }}>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1 }}>
                  {lightbox.caption || ''}
                </Text>
                <TouchableOpacity onPress={() => sharePhoto(lightbox)} style={{ marginLeft: 12 }}>
                  <Ionicons name="share-outline" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
              <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4, alignSelf: 'flex-start', marginLeft: 16 }}>
                {lightbox.created_at ? new Date(lightbox.created_at).toLocaleDateString('it-IT') : ''}
              </Text>
            </>
          )}
        </View>
      </Modal>
    </ScreenLayout>
  );
}
