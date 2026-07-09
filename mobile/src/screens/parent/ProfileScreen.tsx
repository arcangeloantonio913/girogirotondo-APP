import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };

export default function ParentProfile() {
  const { user, refreshUser, sede } = useAuth();
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail]         = useState(user?.email || '');
  const [emailMsg, setEmailMsg]         = useState('');
  const [saving, setSaving]             = useState(false);

  const sedePhone = sede === 'il-magico-mondo' ? '+39 081 000 0002' : '+39 081 000 0001';
  const sedeEmail = sede === 'il-magico-mondo' ? 'info@ilmagicomondo.it' : 'info@girogirotondo.it';

  const handleSaveEmail = async () => {
    if (!newEmail.trim() || newEmail === user?.email) { setEditingEmail(false); return; }
    setSaving(true);
    try {
      await api.patch(`/users/${user?.id}`, { email: newEmail.trim().toLowerCase() });
      await refreshUser();
      setEmailMsg('✅ Email aggiornata con successo');
      setEditingEmail(false);
    } catch (e: any) {
      setEmailMsg('❌ ' + (e?.response?.data?.detail || 'Errore durante il salvataggio'));
    } finally { setSaving(false); }
  };

  const child = user; // il profilo genitore include i dati del figlio tramite child_ids

  return (
    <ScreenLayout title="Il mio Profilo" showBack color={C.accentGreen}>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user?.name?.charAt(0) || '?'}</Text>
          </View>
          <Text style={s.userName}>{user?.name} {user?.cognome}</Text>
          <View style={s.roleBadge}><Text style={s.roleText}>Genitore</Text></View>
        </View>

        {/* Account */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>
          <View style={s.card}>
            <View style={s.row}>
              <Ionicons name="mail-outline" size={18} color={C.muted} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.label}>Email</Text>
                {editingEmail ? (
                  <TextInput style={s.input} value={newEmail} onChangeText={setNewEmail}
                    keyboardType="email-address" autoCapitalize="none" autoFocus />
                ) : (
                  <Text style={s.value}>{user?.email}</Text>
                )}
              </View>
              {editingEmail ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => { setEditingEmail(false); setEmailMsg(''); }} style={s.cancelBtn}>
                    <Text style={{ color: C.muted, fontSize: 12 }}>Annulla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveEmail} style={s.saveBtn} disabled={saving}>
                    <Text style={{ color: C.white, fontSize: 12, fontWeight: '700' }}>{saving ? '...' : 'Salva'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => { setEditingEmail(true); setNewEmail(user?.email || ''); }}>
                  <Ionicons name="pencil-outline" size={18} color={C.accentGreen} />
                </TouchableOpacity>
              )}
            </View>
            {!!emailMsg && <Text style={[s.msg, { color: emailMsg.startsWith('✅') ? '#166534' : '#991B1B' }]}>{emailMsg}</Text>}
          </View>
        </View>

        {/* Contatti scuola */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contatti Scuola</Text>
          <View style={s.card}>
            {[
              { icon: 'mail-outline', label: 'Email segreteria', value: sedeEmail },
              { icon: 'call-outline',  label: 'Telefono', value: sedePhone },
            ].map((item, i) => (
              <View key={i} style={[s.row, i > 0 && { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: C.border }]}>
                <Ionicons name={item.icon as any} size={18} color={C.muted} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.label}>{item.label}</Text>
                  <Text style={[s.value, { color: C.primary }]}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Privacy */}
        <View style={s.privacyBox}>
          <Ionicons name="shield-checkmark-outline" size={16} color={C.muted} />
          <Text style={s.privacyText}>I dati sono trattati in conformità al GDPR e alle normative EU sulla tutela dei minori.</Text>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  avatarSection:{ alignItems: 'center', paddingVertical: 20 },
  avatar:       { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText:   { fontSize: 28, fontWeight: '800', color: '#166534' },
  userName:     { fontSize: 18, fontWeight: '700', color: C.text },
  roleBadge:    { backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3, marginTop: 4 },
  roleText:     { fontSize: 11, fontWeight: '700', color: '#166534' },
  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card:         { backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: C.border },
  row:          { flexDirection: 'row', alignItems: 'center' },
  label:        { fontSize: 11, color: C.muted, fontWeight: '500' },
  value:        { fontSize: 14, color: C.text, fontWeight: '600', marginTop: 1 },
  input:        { fontSize: 14, color: C.text, borderBottomWidth: 1, borderBottomColor: C.accentGreen, paddingBottom: 2, marginTop: 1 },
  saveBtn:      { backgroundColor: C.accentGreen, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  cancelBtn:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  msg:          { fontSize: 12, marginTop: 8 },
  privacyBox:   { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12, marginTop: 8 },
  privacyText:  { fontSize: 11, color: C.muted, flex: 1, lineHeight: 16 },
});
