import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { primary: '#4169E1', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6', red: '#EF4444' };
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:   { bg: '#EBF0FF', text: '#4169E1' },
  teacher: { bg: '#FFF0F7', text: '#FF69B4' },
  parent:  { bg: '#F0FFF0', text: '#32CD32' },
};

function generatePassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function AdminUsers() {
  const { sede } = useAuth();
  const [users,   setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'parent', password: generatePassword() });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  const filtered = users.filter(u => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!form.name || !form.email) { Alert.alert('Attenzione', 'Nome e email obbligatori'); return; }
    setSaving(true);
    try {
      const res = await api.post('/users', form);
      setUsers(prev => [res.data, ...prev]);
      setShowForm(false);
      Alert.alert('Utente creato', `Email: ${form.email}\nPassword: ${form.password}`);
      setForm({ name: '', email: '', role: 'parent', password: generatePassword() });
    } catch (err: any) { Alert.alert('Errore', err.response?.data?.detail || 'Impossibile creare'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Elimina utente', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/users/${id}`); setUsers(prev => prev.filter(u => u.id !== id)); }
        catch { Alert.alert('Errore', 'Impossibile eliminare'); }
      }},
    ]);
  };

  return (
    <ScreenLayout title="Gestione Utenti" showBack color={C.primary} loading={loading} scrollable={false}>
      <FlatList
        data={filtered}
        keyExtractor={u => u.id}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <>
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
              <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Cerca utenti..." placeholderTextColor={C.muted} />
            </View>
            <TouchableOpacity onPress={() => setShowForm(true)} style={s.addBtn}>
              <Ionicons name="person-add-outline" size={18} color={C.white} />
              <Text style={s.addBtnText}>Nuovo Utente</Text>
            </TouchableOpacity>
          </>
        }
        ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 48 }}>👥</Text><Text style={s.emptyText}>Nessun utente trovato</Text></View>}
        renderItem={({ item }) => {
          const rc = ROLE_COLORS[item.role] || ROLE_COLORS.parent;
          return (
            <View style={s.card}>
              <View style={[s.avatar, { backgroundColor: rc.bg }]}>
                <Text style={[s.avatarText, { color: rc.text }]}>{item.name?.charAt(0) || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.userName}>{item.name} {item.cognome}</Text>
                <Text style={s.userEmail}>{item.email}</Text>
                <View style={[s.roleBadge, { backgroundColor: rc.bg }]}>
                  <Text style={[s.roleText, { color: rc.text }]}>{item.role}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color={C.red} />
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuovo Utente</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity>
          </View>
          {[
            { key: 'name', label: 'Nome', placeholder: 'Nome e cognome' },
            { key: 'email', label: 'Email', placeholder: 'email@esempio.it', keyboard: 'email-address' as any },
            { key: 'password', label: 'Password', placeholder: 'Password' },
          ].map(f => (
            <View key={f.key}>
              <Text style={s.formLabel}>{f.label}</Text>
              <TextInput style={s.input} value={(form as any)[f.key]} onChangeText={t => setForm(prev => ({ ...prev, [f.key]: t }))}
                placeholder={f.placeholder} keyboardType={f.keyboard} autoCapitalize="none" />
            </View>
          ))}
          <Text style={s.formLabel}>Ruolo</Text>
          <View style={s.roleRow}>
            {['parent', 'teacher', 'admin'].map(r => (
              <TouchableOpacity key={r} onPress={() => setForm(prev => ({ ...prev, role: r }))}
                style={[s.roleBtn, form.role === r && { backgroundColor: C.primary, borderColor: C.primary }]}>
                <Text style={[s.roleBtnText, form.role === r && { color: C.white }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.submitBtn} onPress={handleCreate} disabled={saving}>
            <Text style={s.submitText}>{saving ? 'Creazione...' : 'Crea Account'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border, height: 44 },
  searchInput:{ flex: 1, fontSize: 14, color: C.text },
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12, justifyContent: 'center' },
  addBtnText:{ color: C.white, fontWeight: '700', fontSize: 14 },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: C.muted, marginTop: 12 },
  card:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  avatar:    { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText:{ fontSize: 16, fontWeight: '800' },
  userName:  { fontSize: 14, fontWeight: '700', color: C.text },
  userEmail: { fontSize: 12, color: C.muted },
  roleBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  roleText:  { fontSize: 10, fontWeight: '700' },
  deleteBtn: { padding: 8 },
  modal:     { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:{ fontSize: 20, fontWeight: '800', color: C.text },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8, marginTop: 14 },
  input:     { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white },
  roleRow:   { flexDirection: 'row', gap: 10 },
  roleBtn:   { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  roleBtnText:{ fontSize: 13, fontWeight: '700', color: C.muted },
  submitBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText:{ color: C.white, fontWeight: '700', fontSize: 15 },
});
