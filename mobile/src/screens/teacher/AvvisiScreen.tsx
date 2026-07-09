import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };

export default function TeacherAvvisi() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;
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

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [aR, pR] = await Promise.all([
          api.get('/avvisi'),
          api.get('/users').then(r => (r.data || []).filter((u: any) => u.role === 'parent')),
        ]);
        setAvvisi(aR.data || []);
        setParents(pR);
      } catch {} finally { setLoading(false); }
    };
    loadAll();
  }, []);

  const reset = () => {
    setTitle(''); setBody(''); setTargetType('class'); setSelParents([]);
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Attenzione', 'Inserisci un titolo'); return; }
    setSaving(true);
    try {
      const payload: any = {
        title, body,
        class_ids: classId ? [classId] : [],
        target_roles: ['parent'],
        sedi: [user?.sede_id || 'girogirotondo'],
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
        catch { Alert.alert('Errore'); }
      }},
    ]);
  };

  const toggleParent = (id: string) =>
    setSelParents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <ScreenLayout title="Avvisi" showBack color={C.accentPink} loading={loading} scrollable={false}>
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
                <Text style={s.cardTitle}>{item.title}</Text>
                {(item.body || item.message) && (
                  <Text style={s.cardBody} numberOfLines={2}>{item.body || item.message}</Text>
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
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color={C.red} />
              </TouchableOpacity>
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
