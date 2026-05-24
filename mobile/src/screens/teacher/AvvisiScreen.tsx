import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { babyPink: '#FF69B4', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6' };

export default function TeacherAvvisi() {
  const { user } = useAuth();
  const [avvisi,   setAvvisi]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    api.get('/avvisi').then(r => setAvvisi(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Attenzione', 'Inserisci un titolo'); return; }
    setSaving(true);
    try {
      const res = await api.post('/avvisi', {
        title, body,
        class_ids: user?.class_ids || (user?.class_id ? [user.class_id] : []),
        target_roles: ['parent'],
        sedi: [user?.sede_id || 'girogirotondo'],
      });
      setAvvisi(prev => [res.data, ...prev]);
      setShowForm(false); setTitle(''); setBody('');
    } catch { Alert.alert('Errore', 'Impossibile pubblicare'); }
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

  return (
    <ScreenLayout title="Avvisi" showBack color={C.babyPink} loading={loading} scrollable={false}>
      <FlatList
        data={avvisi}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={() => setShowForm(true)} style={s.addBtn}>
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={s.addBtnText}>Nuovo Avviso</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={s.empty}><Text style={{ fontSize: 48 }}>📢</Text>
            <Text style={s.emptyText}>Nessun avviso al momento</Text></View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardDate}>{item.created_at ? new Date(item.created_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'}) : ''}</Text>
                <Text style={s.cardTitle}>{item.title}</Text>
                {(item.body||item.message) && <Text style={s.cardBody}>{item.body||item.message}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowForm(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuovo Avviso</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={C.text}/></TouchableOpacity>
          </View>
          <Text style={s.fieldLabel}>Titolo</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Titolo avviso..." />
          <Text style={s.fieldLabel}>Messaggio</Text>
          <TextInput style={[s.input,{height:120}]} value={body} onChangeText={setBody}
            multiline placeholder="Testo avviso..." textAlignVertical="top" />
          <TouchableOpacity style={[s.submitBtn,saving&&{opacity:0.6}]} onPress={handleSave} disabled={saving}>
            <Text style={s.submitText}>{saving?'Pubblicazione...':'Pubblica Avviso'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  addBtn:      {flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.babyPink,borderRadius:14,paddingVertical:12,marginBottom:12,justifyContent:'center'},
  addBtnText:  {color:C.white,fontWeight:'700',fontSize:14},
  empty:       {alignItems:'center',paddingTop:60},
  emptyText:   {fontSize:14,color:C.muted,marginTop:12},
  card:        {backgroundColor:C.white,borderRadius:14,padding:12,marginBottom:8,borderWidth:0.5,borderColor:C.border},
  cardTop:     {flexDirection:'row',gap:10},
  cardDate:    {fontSize:10,color:C.muted,marginBottom:2},
  cardTitle:   {fontSize:14,fontWeight:'700',color:C.text},
  cardBody:    {fontSize:12,color:C.muted,marginTop:3,lineHeight:17},
  deleteBtn:   {padding:8,backgroundColor:'#FEF2F2',borderRadius:8,alignSelf:'flex-start'},
  modal:       {flex:1,padding:20,backgroundColor:'#FFFDD0'},
  modalHeader: {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},
  modalTitle:  {fontSize:20,fontWeight:'800',color:C.text},
  fieldLabel:  {fontSize:12,fontWeight:'700',color:'#6B7280',marginBottom:6,marginTop:14},
  input:       {borderWidth:1,borderColor:C.border,borderRadius:12,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:C.text,backgroundColor:C.white},
  submitBtn:   {backgroundColor:C.babyPink,borderRadius:14,paddingVertical:14,alignItems:'center',marginTop:20},
  submitText:  {color:C.white,fontWeight:'700',fontSize:15},
});
