import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { openFileUrl } from '../../lib/openFile';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };

async function openAttachment(id?: string, url?: string, name?: string) {
  try {
    let u = url;
    // La lista /avvisi strippa attachment_url (perf) → recupero l'allegato pieno per id.
    if (!u && id) {
      const r = await api.get(`/avvisi/${id}`);
      u = r.data?.attachment_url;
    }
    if (!u) { Alert.alert('Allegato non disponibile'); return; }
    await openFileUrl(u, name);
  } catch { Alert.alert('Errore', 'Impossibile aprire l\'allegato.'); }
}

export default function TeacherAvvisi() {
  const { user } = useAuth();
  // Una maestra può avere PIÙ classi: niente più class_ids[0] fisso → selettore.
  const classIds = React.useMemo(() => {
    const ids = [...(user?.class_ids || [])];
    if (user?.class_id && !ids.includes(user.class_id)) ids.push(user.class_id);
    return ids;
  }, [user]);
  const [classId, setClassId] = useState<string | undefined>(classIds[0]);
  useEffect(() => { setClassId(prev => (prev && classIds.includes(prev)) ? prev : classIds[0]); }, [classIds]);
  const [classes,  setClasses]  = useState<any[]>([]);
  const [avvisi,   setAvvisi]   = useState<any[]>([]);
  const [parents,  setParents]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [title,      setTitle]      = useState('');
  const [body,       setBody]       = useState('');
  const [targetType, setTargetType] = useState<'class' | 'specific'>('class');
  const [selParents, setSelParents] = useState<string[]>([]);
  const [saving,     setSaving]     = useState(false);

  // Nomi classi per il selettore (solo quelle della maestra)
  useEffect(() => {
    if (!classIds.length) return;
    api.get('/classes').then(r => setClasses((r.data || []).filter((c: any) => classIds.includes(c.id)))).catch(() => {});
  }, [classIds]);

  useEffect(() => {
    const loadAll = async () => {
      // allSettled: la lista avvisi si carica anche se il recupero genitori fallisce.
      // I genitori vanno presi da /users/by-class (accessibile alle maestre), NON da
      // /users (admin-only → 403 che prima azzerava tutta la schermata).
      const [aR, pR] = await Promise.allSettled([
        api.get('/avvisi'),
        classId ? api.get(`/users/by-class/${classId}`) : Promise.resolve({ data: [] } as any),
      ]);
      if (aR.status === 'fulfilled') setAvvisi(aR.value.data || []);
      if (pR.status === 'fulfilled') setParents((pR.value.data || []).filter((u: any) => u.role === 'parent'));
      setLoading(false);
    };
    loadAll();
  }, [classId]);

  const reset = () => {
    setTitle(''); setBody(''); setTargetType('class'); setSelParents([]);
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Attenzione', 'Inserisci un titolo'); return; }
    setSaving(true);
    try {
      const payload: any = {
        titolo: title,
        testo: body,
        target_class_ids: classId ? [classId] : [],
        target_roles: ['parent'],
        // Sede dell'utente (il backend sovrascrive comunque per i teacher)
        target_sedi: user?.sede_id ? [user.sede_id] : [],
      };
      if (targetType === 'specific' && selParents.length > 0) {
        payload.target_parent_ids = selParents;
      }
      const res = await api.post('/avvisi', payload);
      setAvvisi(prev => [res.data, ...prev]);
      setShowForm(false); reset();
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile pubblicare');
    }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Elimina avviso', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/avvisi/${id}`); setAvvisi(prev => prev.filter(a => a.id !== id)); }
        catch (e: any) { Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile eliminare'); }
      }},
    ]);
  };

  const toggleParent = (id: string) =>
    setSelParents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <ScreenLayout title="Avvisi" showBack color={C.accentPink} loading={loading} scrollable={false}>
      {/* Selettore classe (solo se la maestra ha più classi) */}
      {classes.length > 1 && (
        <View style={s.classRow}>
          {classes.map(c => (
            <TouchableOpacity key={c.id} onPress={() => setClassId(c.id)}
              style={[s.classChip, classId === c.id && { backgroundColor: C.accentPink, borderColor: C.accentPink }]}>
              <Text style={[s.classChipTxt, classId === c.id && { color: C.white }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <FlatList
        data={avvisi}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={() => { reset(); setShowForm(true); }} style={s.addBtn}>
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
                  {item.created_at ? new Date(item.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : ''}
                </Text>
                <Text style={s.cardTitle}>{item.titolo || item.title}</Text>
                {(item.testo || item.body || item.message) && (
                  <Text style={s.cardBody} numberOfLines={2}>{item.testo || item.body || item.message}</Text>
                )}
                {/* Destinatari */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {item.target_parent_ids?.length > 0 ? (
                    <View style={s.targetBadge}>
                      <Text style={s.targetText}>👨‍👩‍👧 {item.target_parent_ids.length} famiglie</Text>
                    </View>
                  ) : (
                    <View style={s.targetBadge}>
                      <Text style={s.targetText}>🏫 Tutta la classe</Text>
                    </View>
                  )}
                </View>
                {/* Allegato */}
                {item.attachment_name && (
                  <TouchableOpacity onPress={() => openAttachment(item.id, item.attachment_url, item.attachment_name)}
                    style={s.attachChip}>
                    <Ionicons name="attach-outline" size={14} color={C.accentPink} />
                    <Text style={s.attachChipText} numberOfLines={1}>{item.attachment_name}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {/* Elimina: solo i propri avvisi */}
              {item.author_id === user?.id && (
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn}>
                  <Ionicons name="trash-outline" size={16} color={C.red} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { setShowForm(false); reset(); }}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuovo Avviso</Text>
            <TouchableOpacity onPress={() => { setShowForm(false); reset(); }}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fl}>Titolo *</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Titolo avviso..." />

            <Text style={s.fl}>Messaggio</Text>
            <TextInput style={[s.input, { height: 100 }]} value={body} onChangeText={setBody}
              multiline placeholder="Testo avviso..." textAlignVertical="top" />

            {/* Destinatari */}
            <Text style={s.fl}>A chi è rivolto</Text>
            <TouchableOpacity onPress={() => { setTargetType('class'); setSelParents([]); }}
              style={[s.targetBtn, targetType === 'class' && s.targetBtnActive]}>
              <Ionicons name="people-outline" size={18} color={targetType === 'class' ? C.white : C.accentPink} />
              <View style={{ flex: 1 }}>
                <Text style={[s.targetBtnTitle, targetType === 'class' && { color: C.white }]}>Tutta la classe</Text>
                <Text style={[s.targetBtnSub, targetType === 'class' && { color: 'rgba(255,255,255,0.8)' }]}>
                  Tutti i genitori vedranno questo avviso
                </Text>
              </View>
              {targetType === 'class' && <Ionicons name="checkmark-circle" size={20} color={C.white} />}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setTargetType('specific')}
              style={[s.targetBtn, targetType === 'specific' && s.targetBtnActive]}>
              <Ionicons name="person-outline" size={18} color={targetType === 'specific' ? C.white : C.accentPink} />
              <View style={{ flex: 1 }}>
                <Text style={[s.targetBtnTitle, targetType === 'specific' && { color: C.white }]}>Famiglie specifiche</Text>
                <Text style={[s.targetBtnSub, targetType === 'specific' && { color: 'rgba(255,255,255,0.8)' }]}>
                  Solo i genitori selezionati
                </Text>
              </View>
              {targetType === 'specific' && <Ionicons name="checkmark-circle" size={20} color={C.white} />}
            </TouchableOpacity>

            {/* Lista genitori */}
            {targetType === 'specific' && (
              <>
                <Text style={[s.fl, { marginTop: 16 }]}>Seleziona famiglie</Text>
                {parents.length === 0 ? (
                  <Text style={{ color: C.muted, fontSize: 12, fontStyle: 'italic' }}>Nessun genitore trovato</Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {parents.map(p => (
                      <TouchableOpacity key={p.id} onPress={() => toggleParent(p.id)}
                        style={[s.parentRow, selParents.includes(p.id) && s.parentRowActive]}>
                        <View style={[s.parentAvatar, selParents.includes(p.id) && { backgroundColor: C.accentPink }]}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: selParents.includes(p.id) ? C.white : '#374151' }}>
                            {p.name?.charAt(0) || '?'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.parentName}>{p.name} {p.cognome}</Text>
                          <Text style={s.parentEmail}>{p.email}</Text>
                        </View>
                        {selParents.includes(p.id) && <Ionicons name="checkmark-circle" size={20} color={C.accentPink} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {selParents.length > 0 && (
                  <Text style={{ fontSize: 12, color: C.accentPink, fontWeight: '600', marginTop: 8 }}>
                    {selParents.length} famili{selParents.length === 1 ? 'a' : 'e'} selezionata/e
                  </Text>
                )}
              </>
            )}

            <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave} disabled={saving}>
              <Text style={s.submitText}>{saving ? 'Pubblicazione...' : 'Pubblica Avviso'}</Text>
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
  addBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accentPink, borderRadius: 14, paddingVertical: 12, marginBottom: 12, justifyContent: 'center' },
  addBtnText:      { color: C.white, fontWeight: '700', fontSize: 14 },
  empty:           { alignItems: 'center', paddingTop: 60 },
  emptyText:       { fontSize: 14, color: C.muted, marginTop: 12 },
  card:            { backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: C.border },
  cardTop:         { flexDirection: 'row', gap: 10 },
  cardDate:        { fontSize: 10, color: C.muted, marginBottom: 2 },
  cardTitle:       { fontSize: 14, fontWeight: '700', color: C.text },
  cardBody:        { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 17 },
  targetBadge:     { backgroundColor: '#FFF0F7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  targetText:      { fontSize: 10, color: C.accentPink, fontWeight: '700' },
  attachChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#FFF0F7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '90%' },
  attachChipText:  { fontSize: 12, color: C.accentPink, fontWeight: '600', flexShrink: 1 },
  deleteBtn:       { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8, alignSelf: 'flex-start' },
  modal:           { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:      { fontSize: 20, fontWeight: '800', color: C.text },
  fl:              { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 7, marginTop: 14 },
  input:           { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white },
  targetBtn:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white, marginBottom: 8 },
  targetBtnActive: { backgroundColor: C.accentPink, borderColor: C.accentPink },
  targetBtnTitle:  { fontSize: 14, fontWeight: '700', color: C.text },
  targetBtnSub:    { fontSize: 11, color: C.muted, marginTop: 2 },
  parentRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.white },
  parentRowActive: { borderColor: C.accentPink, backgroundColor: '#FFF0F7' },
  parentAvatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  parentName:      { fontSize: 13, fontWeight: '700', color: C.text },
  parentEmail:     { fontSize: 11, color: C.muted },
  submitBtn:       { backgroundColor: C.accentPink, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText:      { color: C.white, fontWeight: '700', fontSize: 15 },
});
