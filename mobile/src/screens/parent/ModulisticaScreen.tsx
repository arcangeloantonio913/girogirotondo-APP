import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Linking, Modal, ActivityIndicator } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { babyBlue: '#A7C7E7', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6', green: '#32CD32' };

export default function ParentModulistica() {
  const { user } = useAuth();
  const [docs,     setDocs]     = useState<any[]>([]);
  const [receipts, setReceipts] = useState<string[]>([]); // doc ids letti
  const [loading,  setLoading]  = useState(true);
  const [acking,   setAcking]   = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/documents'),
      api.get(`/read-receipts?parent_id=${user?.id}`),
    ]).then(([dR, rR]) => {
      setDocs(dR.data || []);
      setReceipts((rR.data || []).map((r: any) => r.document_id));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDownload = async (doc: any) => {
    if (doc.file_url) {
      await Linking.openURL(doc.file_url);
    } else if (doc.data) {
      Alert.alert('Documento', 'Anteprima non disponibile su mobile. Accedi dalla webapp per scaricarlo.');
    }
  };

  const handleAck = async (docId: string) => {
    if (receipts.includes(docId)) return;
    setAcking(docId);
    try {
      await api.post('/read-receipts', { document_id: docId, parent_id: user?.id });
      setReceipts(prev => [...prev, docId]);
    } catch { Alert.alert('Errore', 'Impossibile confermare la lettura'); }
    finally { setAcking(null); }
  };

  return (
    <ScreenLayout title="Modulistica" showBack color={C.babyBlue} loading={loading} scrollable={false}>
      <FlatList
        data={docs}
        keyExtractor={d => d.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View style={s.banner}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#1a3a9e" />
            <Text style={s.bannerText}>I documenti sono trattati in conformità al GDPR e alle normative EU.</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}><Text style={{ fontSize: 48 }}>📁</Text><Text style={s.emptyText}>Nessun documento disponibile</Text></View>
        }
        renderItem={({ item }) => {
          const isRead = receipts.includes(item.id);
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={s.docIcon}>
                  <Ionicons name="document-text-outline" size={22} color={C.babyBlue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.docTitle}>{item.title}</Text>
                  {item.description && <Text style={s.docDesc} numberOfLines={2}>{item.description}</Text>}
                </View>
              </View>
              <View style={s.cardActions}>
                {(item.file_url || item.data) && (
                  <TouchableOpacity onPress={() => handleDownload(item)} style={s.downloadBtn}>
                    <Ionicons name="download-outline" size={16} color={C.babyBlue} />
                    <Text style={s.downloadText}>Apri / Scarica</Text>
                  </TouchableOpacity>
                )}
                {isRead ? (
                  <View style={s.readBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={C.green} />
                    <Text style={s.readText}>Letto</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => handleAck(item.id)} style={s.ackBtn}
                    disabled={acking === item.id}>
                    <Ionicons name="eye-outline" size={16} color={C.white} />
                    <Text style={s.ackText}>{acking === item.id ? '...' : 'Presa Visione'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  banner:       { flexDirection: 'row', gap: 8, backgroundColor: '#EBF0FF', borderRadius: 12, padding: 10, marginBottom: 12 },
  bannerText:   { fontSize: 11, color: '#1a3a9e', flex: 1, lineHeight: 16 },
  empty:        { alignItems: 'center', paddingTop: 60 },
  emptyText:    { fontSize: 14, color: C.muted, marginTop: 12 },
  card:         { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: C.border },
  cardTop:      { flexDirection: 'row', gap: 12, marginBottom: 12 },
  docIcon:      { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EBF0FF', alignItems: 'center', justifyContent: 'center' },
  docTitle:     { fontSize: 14, fontWeight: '700', color: C.text },
  docDesc:      { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 16 },
  cardActions:  { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  downloadBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: C.babyBlue },
  downloadText: { fontSize: 12, color: C.babyBlue, fontWeight: '600' },
  readBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F0FFF4' },
  readText:     { fontSize: 12, color: C.green, fontWeight: '600' },
  ackBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.babyBlue },
  ackText:      { fontSize: 12, color: C.white, fontWeight: '600' },
});
