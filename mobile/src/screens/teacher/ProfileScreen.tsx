import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { babyPink: '#FF69B4', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6', red: '#EF4444' };

export default function TeacherProfile() {
  const { user, logout } = useAuth();
  const [newPwd,    setNewPwd]    = useState('');
  const [confirmPwd,setConfirmPwd]= useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [pwdMsg,    setPwdMsg]    = useState('');
  const [saving,    setSaving]    = useState(false);

  const handleChangePwd = async () => {
    if (newPwd.length < 6) { setPwdMsg('❌ Minimo 6 caratteri'); return; }
    if (newPwd !== confirmPwd) { setPwdMsg('❌ Le password non coincidono'); return; }
    setSaving(true);
    try {
      await api.put(`/users/${user?.id}/credentials`, { password: newPwd });
      setPwdMsg('✅ Password aggiornata con successo');
      setNewPwd(''); setConfirmPwd('');
    } catch (e: any) {
      setPwdMsg('❌ ' + (e?.response?.data?.detail || 'Errore'));
    } finally { setSaving(false); }
  };

  return (
    <ScreenLayout title="Il mio Profilo" showBack color={C.babyPink}>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>

        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user?.name?.charAt(0) || '?'}</Text>
          </View>
          <Text style={s.userName}>{user?.name} {user?.cognome}</Text>
          <View style={s.roleBadge}><Text style={s.roleText}>Maestra</Text></View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Informazioni Account</Text>
          <View style={s.card}>
            <View style={s.infoRow}>
              <Ionicons name="mail-outline" size={16} color={C.muted} />
              <Text style={s.infoLabel}>Email</Text>
              <Text style={s.infoValue}>{user?.email}</Text>
            </View>
            {(user?.class_ids?.length || user?.class_id) && (
              <View style={[s.infoRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: C.border }]}>
                <Ionicons name="book-outline" size={16} color={C.muted} />
                <Text style={s.infoLabel}>Classe</Text>
                <Text style={s.infoValue}>{user?.class_id || user?.class_ids?.join(', ')}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Cambia Password</Text>
          <View style={s.card}>
            <Text style={s.fieldLabel}>Nuova password</Text>
            <View style={s.inputRow}>
              <TextInput style={s.input} value={newPwd} onChangeText={setNewPwd}
                secureTextEntry={!showPwd} placeholder="Min. 6 caratteri" placeholderTextColor={C.muted} autoCapitalize="none" />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
              </TouchableOpacity>
            </View>
            <Text style={[s.fieldLabel, { marginTop: 12 }]}>Conferma password</Text>
            <TextInput style={[s.input, { marginTop: 4 }]} value={confirmPwd} onChangeText={setConfirmPwd}
              secureTextEntry={!showPwd} placeholder="Ripeti la password" placeholderTextColor={C.muted} autoCapitalize="none" />
            {!!pwdMsg && <Text style={[s.msg, { color: pwdMsg.startsWith('✅') ? '#166534' : '#991B1B' }]}>{pwdMsg}</Text>}
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleChangePwd} disabled={saving}>
              <Text style={s.saveBtnText}>{saving ? 'Salvataggio...' : 'Salva Nuova Password'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={() => Alert.alert('Logout', 'Sei sicuro di voler uscire?', [
          { text: 'Annulla', style: 'cancel' }, { text: 'Esci', style: 'destructive', onPress: logout }
        ])}>
          <Ionicons name="log-out-outline" size={18} color={C.red} />
          <Text style={s.logoutText}>Esci dall'account</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  avatarSection:{ alignItems: 'center', paddingVertical: 20 },
  avatar:       { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFE4F0', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText:   { fontSize: 28, fontWeight: '800', color: '#BE185D' },
  userName:     { fontSize: 18, fontWeight: '700', color: '#1A202C' },
  roleBadge:    { backgroundColor: '#FFF0F7', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3, marginTop: 4 },
  roleText:     { fontSize: 11, fontWeight: '700', color: '#BE185D' },
  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card:         { backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: C.border },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel:    { fontSize: 12, color: C.muted, width: 50 },
  infoValue:    { fontSize: 14, color: '#1A202C', fontWeight: '600', flex: 1 },
  fieldLabel:   { fontSize: 12, color: C.muted, fontWeight: '600', marginBottom: 4 },
  inputRow:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, height: 44 },
  input:        { flex: 1, fontSize: 14, color: '#1A202C' },
  msg:          { fontSize: 12, marginTop: 8 },
  saveBtn:      { backgroundColor: C.babyPink, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  saveBtnText:  { color: C.white, fontWeight: '700', fontSize: 14 },
  logoutBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 8, padding: 14, backgroundColor: '#FEF2F2', borderRadius: 14, borderWidth: 0.5, borderColor: '#FECACA' },
  logoutText:   { color: C.red, fontWeight: '700', fontSize: 14 },
});
