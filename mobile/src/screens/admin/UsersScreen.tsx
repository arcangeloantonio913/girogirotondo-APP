import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { primary: '#4169E1', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6', red: '#EF4444', green: '#32CD32' };

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:   { bg: '#EBF0FF', text: '#1a3a9e' },
  teacher: { bg: '#FFF0F7', text: '#BE185D' },
  parent:  { bg: '#F0FFF0', text: '#065F46' },
};

function genPwd(len = 10) {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

type ModalType = 'staff' | 'iscrizione' | null;

export default function AdminUsers() {
  const { sede } = useAuth();
  const [users,   setUsers]   = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState<ModalType>(null);
  const [saving,  setSaving]  = useState(false);

  // Form staff
  const [staffForm, setStaff] = useState({ name: '', cognome: '', email: '', role: 'teacher', password: genPwd(), class_id: '' });
  // Form iscrizione
  const [iscForm, setIsc] = useState({
    bambino_nome: '', bambino_cognome: '', bambino_data_nascita: '',
    class_id: '',
    genitore_nome: '', genitore_cognome: '', genitore_email: '', genitore_password: genPwd(),
  });
  const [iscResult, setIscResult] = useState<any>(null);

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/classes')])
      .then(([uR, cR]) => { setUsers(uR.data || []); setClasses(cR.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  const filtered = users.filter(u => `${u.name} ${u.cognome} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  const handleCreateStaff = async () => {
    if (!staffForm.name || !staffForm.email) { Alert.alert('Attenzione', 'Nome e email obbligatori'); return; }
    setSaving(true);
    try {
      const res = await api.post('/users', { ...staffForm, sede_id: sede });
      setUsers(prev => [res.data, ...prev]);
      Alert.alert('Account creato', `Email: ${staffForm.email}\nPassword: ${staffForm.password}`);
      setModal(null); setStaff({ name: '', cognome: '', email: '', role: 'teacher', password: genPwd(), class_id: '' });
    } catch (e: any) { Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile creare'); }
    finally { setSaving(false); }
  };

  const handleIscrizione = async () => {
    const { bambino_nome, bambino_cognome, class_id, genitore_email, genitore_password } = iscForm;
    if (!bambino_nome || !genitore_email) { Alert.alert('Attenzione', 'Nome bambino e email genitore obbligatori'); return; }
    setSaving(true);
    try {
      const res = await api.post('/users/iscrizione', { ...iscForm, sede_id: sede });
      setIscResult(res.data);
      // Aggiorna lista utenti
      const uR = await api.get('/users');
      setUsers(uR.data || []);
    } catch (e: any) { Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile completare l\'iscrizione'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Elimina utente', 'Questa azione è irreversibile.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/users/${id}`); setUsers(prev => prev.filter(u => u.id !== id)); }
        catch { Alert.alert('Errore', 'Impossibile eliminare'); }
      }},
    ]);
  };

  return (
    <ScreenLayout title="Gestione Utenti" showBack color={C.primary} loading={loading} scrollable={false}>
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch}
          placeholder="Cerca utenti..." placeholderTextColor={C.muted} />
      </View>

      {/* Pulsanti azione */}
      <View style={s.actionRow}>
        <TouchableOpacity onPress={() => setModal('staff')} style={[s.actionBtn, { backgroundColor: C.primary }]}>
          <Ionicons name="person-add-outline" size={16} color={C.white} />
          <Text style={s.actionBtnText}>Staff</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setIscResult(null); setModal('iscrizione'); }}
          style={[s.actionBtn, { backgroundColor: '#32CD32' }]}>
          <Ionicons name="happy-outline" size={16} color={C.white} />
          <Text style={s.actionBtnText}>Iscrivi Bambino</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={u => u.id}
        contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
        ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 40 }}>👥</Text><Text style={s.emptyText}>Nessun utente</Text></View>}
        renderItem={({ item }) => {
          const rc = ROLE_COLORS[item.role] || ROLE_COLORS.parent;
          return (
            <View style={s.userCard}>
              <View style={[s.avatar, { backgroundColor: rc.bg }]}>
                <Text style={[s.avatarText, { color: rc.text }]}>{item.name?.charAt(0) || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.userName}>{item.name} {item.cognome}</Text>
                <Text style={s.userEmail}>{item.email}</Text>
                {item.admin_password && (
                  <Text style={s.userPwd}>pwd: {item.admin_password}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={[s.roleBadge, { backgroundColor: rc.bg }]}>
                  <Text style={[s.roleText, { color: rc.text }]}>{item.role}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.delBtn}>
                  <Ionicons name="trash-outline" size={14} color={C.red} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Modale Staff */}
      <Modal visible={modal === 'staff'} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setModal(null)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuovo Account Staff</Text>
            <TouchableOpacity onPress={() => setModal(null)}><Ionicons name="close" size={24} color={C.text}/></TouchableOpacity>
          </View>
          <ScrollView>
            {[
              { key: 'name',     label: 'Nome *',         ph: 'Mario' },
              { key: 'cognome',  label: 'Cognome',        ph: 'Rossi' },
              { key: 'email',    label: 'Email *',        ph: 'mario@scuola.it', kbd: 'email-address' as any },
              { key: 'password', label: 'Password',       ph: 'Password auto-generata' },
            ].map(f => (
              <View key={f.key}>
                <Text style={s.fl}>{f.label}</Text>
                <TextInput style={s.input} value={(staffForm as any)[f.key]}
                  onChangeText={t => setStaff(p => ({ ...p, [f.key]: t }))}
                  placeholder={f.ph} keyboardType={f.kbd} autoCapitalize="none" />
              </View>
            ))}
            <Text style={s.fl}>Ruolo</Text>
            <View style={s.chipRow}>
              {['teacher', 'admin', 'parent'].map(r => (
                <TouchableOpacity key={r} onPress={() => setStaff(p => ({ ...p, role: r }))}
                  style={[s.chip, staffForm.role === r && { backgroundColor: C.primary, borderColor: C.primary }]}>
                  <Text style={[s.chipText, staffForm.role === r && { color: C.white }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {staffForm.role === 'teacher' && (
              <>
                <Text style={s.fl}>Classe</Text>
                <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                  {classes.map(cls => (
                    <TouchableOpacity key={cls.id} onPress={() => setStaff(p => ({ ...p, class_id: cls.id }))}
                      style={[s.chip, staffForm.class_id === cls.id && { backgroundColor: C.primary, borderColor: C.primary }]}>
                      <Text style={[s.chipText, staffForm.class_id === cls.id && { color: C.white }]}>{cls.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={handleCreateStaff} disabled={saving}>
              <Text style={s.submitText}>{saving ? 'Creazione...' : 'Crea Account'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modale Iscrizione Bambino */}
      <Modal visible={modal === 'iscrizione'} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { setModal(null); setIscResult(null); }}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Iscrizione Bambino</Text>
            <TouchableOpacity onPress={() => { setModal(null); setIscResult(null); }}>
              <Ionicons name="close" size={24} color={C.text}/>
            </TouchableOpacity>
          </View>

          {iscResult ? (
            <ScrollView>
              <View style={s.resultBox}>
                <Text style={{ fontSize: 48, textAlign: 'center' }}>🎉</Text>
                <Text style={s.resultTitle}>Iscrizione completata!</Text>
                <View style={s.resultCard}>
                  <Text style={s.resultLabel}>Bambino</Text>
                  <Text style={s.resultValue}>{iscResult.student?.name} {iscResult.student?.cognome}</Text>
                </View>
                <View style={s.resultCard}>
                  <Text style={s.resultLabel}>Email genitore</Text>
                  <Text style={s.resultValue}>{iscResult.parent?.email}</Text>
                </View>
                <View style={s.resultCard}>
                  <Text style={s.resultLabel}>Password genitore</Text>
                  <Text style={[s.resultValue, { fontFamily: 'monospace', color: C.primary }]}>
                    {iscResult.new_password || iscForm.genitore_password}
                  </Text>
                </View>
                {iscResult.email_inviata && (
                  <View style={[s.resultCard, { backgroundColor: '#F0FFF4' }]}>
                    <Text style={{ fontSize: 12, color: '#065F46', fontWeight: '600' }}>
                      ✅ Email con le credenziali è stata inviata al genitore
                    </Text>
                  </View>
                )}
                <TouchableOpacity style={s.submitBtn} onPress={() => { setModal(null); setIscResult(null); setIsc({ bambino_nome:'',bambino_cognome:'',bambino_data_nascita:'',class_id:'',genitore_nome:'',genitore_cognome:'',genitore_email:'',genitore_password:genPwd() }); }}>
                  <Text style={s.submitText}>Chiudi</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <ScrollView>
              <Text style={[s.sectionHeader, { color: '#32CD32' }]}>👶 Dati bambino</Text>
              {[
                { key: 'bambino_nome',            label: 'Nome *',          ph: 'Marco' },
                { key: 'bambino_cognome',          label: 'Cognome',         ph: 'Rossi' },
                { key: 'bambino_data_nascita',     label: 'Data di nascita', ph: 'YYYY-MM-DD' },
              ].map(f => (
                <View key={f.key}>
                  <Text style={s.fl}>{f.label}</Text>
                  <TextInput style={s.input} value={(iscForm as any)[f.key]}
                    onChangeText={t => setIsc(p => ({ ...p, [f.key]: t }))} placeholder={f.ph} />
                </View>
              ))}
              <Text style={s.fl}>Classe</Text>
              <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                {classes.map(cls => (
                  <TouchableOpacity key={cls.id} onPress={() => setIsc(p => ({ ...p, class_id: cls.id }))}
                    style={[s.chip, iscForm.class_id === cls.id && { backgroundColor: '#32CD32', borderColor: '#32CD32' }]}>
                    <Text style={[s.chipText, iscForm.class_id === cls.id && { color: C.white }]}>{cls.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.sectionHeader, { color: C.primary }]}>👨‍👩‍👦 Genitore</Text>
              {[
                { key: 'genitore_nome',     label: 'Nome genitore',  ph: 'Luca' },
                { key: 'genitore_cognome',  label: 'Cognome',        ph: 'Rossi' },
                { key: 'genitore_email',    label: 'Email *',        ph: 'luca@email.it', kbd: 'email-address' as any },
                { key: 'genitore_password', label: 'Password',       ph: 'Auto-generata' },
              ].map(f => (
                <View key={f.key}>
                  <Text style={s.fl}>{f.label}</Text>
                  <TextInput style={s.input} value={(iscForm as any)[f.key]}
                    onChangeText={t => setIsc(p => ({ ...p, [f.key]: t }))}
                    placeholder={f.ph} keyboardType={f.kbd} autoCapitalize="none" />
                </View>
              ))}

              <TouchableOpacity style={[s.submitBtn, { backgroundColor: '#32CD32' }, saving && { opacity: 0.6 }]}
                onPress={handleIscrizione} disabled={saving}>
                <Text style={s.submitText}>{saving ? 'Iscrizione...' : 'Completa Iscrizione'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  searchRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 12, marginHorizontal: 10, marginTop: 10, borderWidth: 0.5, borderColor: C.border, height: 44 },
  searchInput:  { flex: 1, fontSize: 14, color: C.text },
  actionRow:    { flexDirection: 'row', gap: 10, padding: 10 },
  actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  actionBtnText:{ color: C.white, fontWeight: '700', fontSize: 13 },
  empty:        { alignItems: 'center', paddingTop: 50 },
  emptyText:    { color: C.muted, fontSize: 14, marginTop: 10 },
  userCard:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: 0.5, borderColor: C.border },
  avatar:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 16, fontWeight: '800' },
  userName:     { fontSize: 13, fontWeight: '700', color: C.text },
  userEmail:    { fontSize: 11, color: C.muted },
  userPwd:      { fontSize: 10, color: C.primary, fontWeight: '500', fontFamily: 'monospace' },
  roleBadge:    { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  roleText:     { fontSize: 10, fontWeight: '700' },
  delBtn:       { padding: 4 },
  modal:        { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: C.text },
  fl:           { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6, marginTop: 14 },
  input:        { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white },
  chipRow:      { flexDirection: 'row', gap: 8 },
  chip:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  chipText:     { fontSize: 13, fontWeight: '600', color: C.text },
  submitBtn:    { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText:   { color: C.white, fontWeight: '700', fontSize: 15 },
  sectionHeader:{ fontSize: 14, fontWeight: '800', marginTop: 20, marginBottom: 4 },
  resultBox:    { padding: 10 },
  resultTitle:  { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center', marginVertical: 16 },
  resultCard:   { backgroundColor: C.white, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: C.border },
  resultLabel:  { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 3 },
  resultValue:  { fontSize: 14, fontWeight: '700', color: C.text },
});
