import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Modal, Dimensions, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import ScreenLayout from '../../components/layout/ScreenLayout';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const { width, height } = Dimensions.get('window');
const IMG = (width - 48) / 2;
const PAGE = 24;
const C = { ...tenant.colors, border: tenant.colors.divider };

// Galleria per la DIREZIONE: tutte le foto di TUTTE le classi (il backend scopa per
// sede/org della direzione; per una superadmin = tutte le sedi dell'org). Filtro per
// classe + "Tutte". Sola visione + download (niente upload/elimina da qui).
export default function AdminGallery() {
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState<string>('all');   // 'all' = tutte le classi
  const [items, setItems]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage]       = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [preview, setPreview] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [fullMap, setFullMap] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data || [])).catch(() => setClasses([]));
  }, []);

  const load = useCallback(async (reset = false) => {
    if (!reset && (loadingMore || loading)) return;
    if (!reset && !hasMore) return;
    const offset = reset ? 0 : page * PAGE;
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const q = classId === 'all'
        ? `/gallery?limit=${PAGE}&offset=${offset}`
        : `/gallery?class_id=${classId}&limit=${PAGE}&offset=${offset}`;
      const r = await api.get(q);
      const data = r.data || [];
      setItems(prev => reset ? data : [...prev, ...data]);
      setPage(reset ? 1 : page + 1);
      setHasMore(data.length === PAGE);
    } catch { if (reset) setItems([]); } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [classId, page, hasMore, loading, loadingMore]);

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [classId]);

  const fetchFull = useCallback(async (item: any): Promise<string | null> => {
    if (!item) return null;
    if (!item.has_full) return item.media_url || item.thumbnail_url || null;
    if (item.id && fullMap[item.id]) return fullMap[item.id];
    if (!item.id) return item.media_url || item.thumbnail_url || null;
    try {
      const r = await api.get(`/gallery/${item.id}`);
      const full = r.data?.media_url || null;
      if (full) setFullMap(m => ({ ...m, [item.id]: full }));
      return full || item.media_url || item.thumbnail_url || null;
    } catch { return item.media_url || item.thumbnail_url || null; }
  }, [fullMap]);

  const openPreview = (index: number) => { setPreview(index); fetchFull(items[index]); };

  const handleDownload = async (item: any) => {
    const url = item.media_url || (item.id && fullMap[item.id]) || await fetchFull(item) || item.thumbnail_url;
    if (!url) return;
    setDownloading(true);
    try {
      if (url.startsWith('data:')) {
        const mime = (url.match(/^data:([^;]+)/) || [, 'image/jpeg'])[1];
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/heic' ? 'heic' : 'jpg';
        const path = new FileSystem.File(FileSystem.Paths.cache, `foto.${ext}`).uri;
        await LegacyFS.writeAsStringAsync(path, url.split(',')[1], { encoding: 'base64' });
        await Sharing.shareAsync(path, { mimeType: mime });
      } else {
        const path = new FileSystem.File(FileSystem.Paths.cache, 'foto.jpg').uri;
        await Promise.race([
          LegacyFS.downloadAsync(url, path),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000)),
        ]);
        await Sharing.shareAsync(path, { mimeType: 'image/jpeg' });
      }
    } catch { Alert.alert('Errore', 'Impossibile scaricare la foto'); }
    finally { setDownloading(false); }
  };

  const current = preview !== null ? items[preview] : null;
  const chips = [{ id: 'all', name: '🏫 Tutte' }, ...classes];

  return (
    <ScreenLayout title="Galleria (tutte le classi)" showBack color={C.babyBlue} loading={false} scrollable={false}>
      {/* Filtro classe */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {chips.map(c => (
          <TouchableOpacity key={c.id} onPress={() => setClassId(c.id)}
            style={[s.chip, classId === c.id && s.chipActive]}>
            <Text style={[s.chipText, classId === c.id && s.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading
        ? <ActivityIndicator size="large" color={C.babyBlue} style={{ flex: 1 }} />
        : <FlatList
            data={items}
            numColumns={2}
            keyExtractor={(item, i) => String(item?.id ?? i)}
            contentContainerStyle={s.grid}
            onEndReached={() => load(false)}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={C.babyBlue} style={{ padding: 10 }} /> : null}
            ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 48 }}>📷</Text><Text style={s.emptyText}>Nessuna foto</Text></View>}
            renderItem={({ item, index }) => (
              <TouchableOpacity onPress={() => openPreview(index)} style={s.thumb}>
                <Image source={{ uri: item.thumbnail_url || item.media_url }} style={s.thumbImg} />
                {item.media_type === 'video' && (
                  <View style={s.playBtn}><Ionicons name="play" size={20} color={C.white} /></View>
                )}
              </TouchableOpacity>
            )}
          />
      }

      {/* Lightbox */}
      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={s.overlay}>
          <TouchableOpacity onPress={() => setPreview(null)} style={s.closeBtn}>
            <Ionicons name="close" size={28} color={C.white} />
          </TouchableOpacity>
          {current && <Image source={{ uri: (current.id && fullMap[current.id]) || current.media_url || current.thumbnail_url }} style={s.previewImg} resizeMode="contain" />}
          <View style={s.navRow}>
            <TouchableOpacity onPress={() => setPreview(p => p !== null && p > 0 ? p - 1 : p)} style={[s.navBtn, preview === 0 && { opacity: 0.3 }]}>
              <Ionicons name="chevron-back" size={28} color={C.white} />
            </TouchableOpacity>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{(preview || 0) + 1}/{items.length}</Text>
            <TouchableOpacity onPress={() => setPreview(p => p !== null && p < items.length - 1 ? p + 1 : p)} style={[s.navBtn, preview === items.length - 1 && { opacity: 0.3 }]}>
              <Ionicons name="chevron-forward" size={28} color={C.white} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => current && handleDownload(current)} style={s.downloadBtn} disabled={downloading}>
            {downloading
              ? <ActivityIndicator color={C.white} size="small" />
              : <><Ionicons name="download-outline" size={20} color={C.white} /><Text style={s.downloadText}>Scarica</Text></>}
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  tabs:       { maxHeight: 48, marginVertical: 10 },
  chip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border },
  chipActive: { backgroundColor: C.babyBlue, borderColor: 'transparent' },
  chipText:   { fontSize: 13, fontWeight: '600', color: C.muted },
  chipTextActive: { color: C.white, fontWeight: '700' },
  grid:       { paddingHorizontal: 10, paddingBottom: 20 },
  thumb:      { width: IMG, height: IMG, margin: 4, borderRadius: 14, overflow: 'hidden', backgroundColor: C.border },
  thumbImg:   { width: IMG, height: IMG },
  playBtn:    { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  empty:      { alignItems: 'center', paddingTop: 60 },
  emptyText:  { fontSize: 14, color: C.muted, marginTop: 12 },
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeBtn:   { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  previewImg: { width: width - 40, height: height * 0.6 },
  navRow:     { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 16 },
  navBtn:     { padding: 10 },
  downloadBtn:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  downloadText:{ color: C.white, fontWeight: '700', fontSize: 14 },
});
