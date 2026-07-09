import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Modal, Dimensions, StyleSheet, ActivityIndicator, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const { width, height } = Dimensions.get('window');
const IMG = (width - 48) / 2;
const PAGE = 24;
const C = { ...tenant.colors, border: tenant.colors.divider };

export default function ParentGallery() {
  const { activeChildId, user } = useAuth();
  const [tab,         setTab]         = useState<'personale'|'classe'>('personale');
  const [items,       setItems]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,        setPage]        = useState(0);
  const [hasMore,     setHasMore]     = useState(true);
  const [preview,     setPreview]     = useState<number|null>(null); // index
  const [downloading, setDownloading] = useState(false);

  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;

  const load = useCallback(async (reset=false) => {
    const offset = reset ? 0 : page * PAGE;
    if(!reset && !hasMore) return;
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const url = tab==='personale'
        ? `/gallery?student_id=${childId}&limit=${PAGE}&offset=${offset}`
        : `/gallery?limit=${PAGE}&offset=${offset}`;
      const r = await api.get(url);
      const data = r.data || [];
      setItems(prev => reset ? data : [...prev, ...data]);
      setPage(reset ? 1 : page + 1);
      setHasMore(data.length === PAGE);
    } catch {} finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [tab, childId, page, hasMore]);

  useEffect(() => { load(true); }, [tab, childId]);

  const handleDownload = async (item: any) => {
    const url = item.media_url || item.url;
    if (!url) return;
    setDownloading(true);
    try {
      if (url.startsWith('data:')) {
        // base64 — share directly
        const ext = url.includes('image/png') ? 'png' : 'jpg';
        const path = new FileSystem.File(FileSystem.Paths.cache, `foto.${ext}`).uri;
        const base64 = url.split(',')[1];
        await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' });
        await Sharing.shareAsync(path, { mimeType: `image/${ext}` });
      } else {
        const path = new FileSystem.File(FileSystem.Paths.cache, 'foto.jpg').uri;
        await FileSystem.downloadAsync(url, path);
        await Sharing.shareAsync(path, { mimeType: 'image/jpeg' });
      }
    } catch {} finally { setDownloading(false); }
  };

  const current = preview !== null ? items[preview] : null;

  return (
    <ScreenLayout title="Galleria Foto" showBack color={C.babyPink} loading={false} scrollable={false}>
      {/* Tabs */}
      <View style={s.tabs}>
        {(['personale','classe'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => { setTab(t); }} style={[s.tab, tab===t && s.tabActive]}>
            <Text style={[s.tabText, tab===t && s.tabTextActive]}>{t==='personale'?'👤 Personale':'🏫 Classe'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <ActivityIndicator size="large" color={C.babyPink} style={{flex:1}}/>
        : <FlatList
            data={items}
            numColumns={2}
            keyExtractor={(_,i)=>String(i)}
            contentContainerStyle={s.grid}
            onEndReached={()=>load(false)}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingMore?<ActivityIndicator color={C.babyPink} style={{padding:10}}/>:null}
            ListEmptyComponent={<View style={s.empty}><Text style={{fontSize:48}}>📷</Text><Text style={s.emptyText}>Nessuna foto disponibile</Text></View>}
            renderItem={({item,index})=>(
              <TouchableOpacity onPress={()=>setPreview(index)} style={s.thumb}>
                <Image source={{uri:item.media_url||item.url}} style={s.thumbImg}/>
                {item.media_type==='video'&&(
                  <View style={s.playBtn}><Ionicons name="play" size={20} color={C.white}/></View>
                )}
              </TouchableOpacity>
            )}
          />
      }

      {/* Lightbox */}
      <Modal visible={preview!==null} transparent animationType="fade" onRequestClose={()=>setPreview(null)}>
        <View style={s.overlay}>
          <TouchableOpacity onPress={()=>setPreview(null)} style={s.closeBtn}>
            <Ionicons name="close" size={28} color={C.white}/>
          </TouchableOpacity>

          {current&&<Image source={{uri:current.media_url||current.url}} style={s.previewImg} resizeMode="contain"/>}

          {/* Caption */}
          {current?.caption&&(
            <Text style={s.caption}>{current.caption}</Text>
          )}

          {/* Navigation */}
          <View style={s.navRow}>
            <TouchableOpacity onPress={()=>setPreview(p=>p!==null&&p>0?p-1:p)} style={[s.navBtn,preview===0&&{opacity:0.3}]}>
              <Ionicons name="chevron-back" size={28} color={C.white}/>
            </TouchableOpacity>
            <Text style={{color:'rgba(255,255,255,0.6)',fontSize:13}}>{(preview||0)+1}/{items.length}</Text>
            <TouchableOpacity onPress={()=>setPreview(p=>p!==null&&p<items.length-1?p+1:p)} style={[s.navBtn,preview===items.length-1&&{opacity:0.3}]}>
              <Ionicons name="chevron-forward" size={28} color={C.white}/>
            </TouchableOpacity>
          </View>

          {/* Download */}
          <TouchableOpacity onPress={()=>current&&handleDownload(current)} style={s.downloadBtn} disabled={downloading}>
            {downloading
              ? <ActivityIndicator color={C.white} size="small"/>
              : <><Ionicons name="download-outline" size={20} color={C.white}/><Text style={s.downloadText}>Scarica</Text></>
            }
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  tabs:       {flexDirection:'row',margin:12,backgroundColor:C.white,borderRadius:12,padding:4,borderWidth:0.5,borderColor:C.border},
  tab:        {flex:1,paddingVertical:8,alignItems:'center',borderRadius:10},
  tabActive:  {backgroundColor:C.babyPink},
  tabText:    {fontSize:13,fontWeight:'600',color:C.muted},
  tabTextActive:{color:C.white,fontWeight:'700'},
  grid:       {paddingHorizontal:10,paddingBottom:20},
  thumb:      {width:IMG,height:IMG,margin:4,borderRadius:14,overflow:'hidden',backgroundColor:C.border},
  thumbImg:   {width:IMG,height:IMG},
  playBtn:    {position:'absolute',inset:0,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,0.3)'},
  empty:      {alignItems:'center',paddingTop:60},
  emptyText:  {fontSize:14,color:C.muted,marginTop:12},
  overlay:    {flex:1,backgroundColor:'rgba(0,0,0,0.95)',justifyContent:'center',alignItems:'center'},
  closeBtn:   {position:'absolute',top:50,right:20,zIndex:10,padding:8},
  previewImg: {width:width-40,height:height*0.6},
  caption:    {color:'rgba(255,255,255,0.8)',fontSize:13,marginTop:10,textAlign:'center',paddingHorizontal:20},
  navRow:     {flexDirection:'row',alignItems:'center',gap:20,marginTop:16},
  navBtn:     {padding:10},
  downloadBtn:{flexDirection:'row',alignItems:'center',gap:8,marginTop:16,backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,paddingHorizontal:20,paddingVertical:10},
  downloadText:{color:C.white,fontWeight:'700',fontSize:14},
});
