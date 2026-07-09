import React, { useEffect, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:   { bg: C.tintBlue,  text: C.primary },
  teacher: { bg: C.tintPink,  text: C.accentPink },
  parent:  { bg: C.tintGreen, text: C.accentGreen },
};
const CHILD_COLOR = { bg: C.tintOrange, text: C.accentOrange };
const ROLE_LABEL: Record<string, string> = { admin: 'Amministratore', teacher: 'Maestra', parent: 'Genitore' };

type Section = { title: string; kind: 'user' | 'child'; color: { bg: string; text: string }; data: any[] };

function genPwd(len = 10) {
  const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => ch[Math.floor(Math.random() * ch.length)]).join('');
}

type ModalType = 'staff' | 'iscrizione' | 'edit' | null;

export default function AdminUsers() {
  const { sede } = useAuth();
  const [users,   setUsers]   = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState<ModalType>(null);
  const [saving,  setSaving]  = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [iscResult, setIscResult] = useState<any>(null);

  // Form staff
  const [staffForm, setStaff] = useState({ name: '', cognome: '', email: '', role: 'teacher', password: genPwd(), class_id: '' });
  // Form iscrizione
  const [iscForm, setIsc] = useState({
    bambino_nome: '', bambino_cognome: '', bambino_data_nascita: '', class_id: '',
    genitore_nome: '', genitore_cognome: '', genitore_email: '', genitore_password: genPwd(),
    // Secondo genitore (opzionale)
    genitore2_nome: '', genitore2_cognome: '', genitore2_email: '', genitore2_password: '',
    show_second_parent: false,
    bambino2_nome: '', bambino2_cognome: '', bambino2_class_id: '',
  });
  // Edit form
  const [editForm, setEdit] = useState({ name: '', cognome: '', email: '', password: '', class_id: '' });

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/classes'), api.get('/students')])
      .then(([uR, cR, sR]) => { setUsers(uR.data || []); setClasses(cR.data || []); setStudents(sR.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  const q = search.toLowerCase();
  const matchUser = (u: any) => `${u.name} ${u.cognome} ${u.email}`.toLowerCase().includes(q);
  const matchChild = (c: any) => `${c.name} ${c.cognome}`.toLowerCase().includes(q);

  const allSections: Section[] = [
    { title: 'Amministrazione', kind: 'user',  color: ROLE_COLORS.admin,   data: users.filter(u => u.role === 'admin'   && matchUser(u)) },
    { title: 'Maestre',         kind: 'user',  color: ROLE_COLORS.teacher, data: users.filter(u => u.role === 'teacher' && matchUser(u)) },
    { title: 'Genitori',        kind: 'user',  color: ROLE_COLORS.parent,  data: users.filter(u => u.role === 'parent'  && matchUser(u)) },
    { title: 'Bambini',         kind: 'child', color: CHILD_COLOR,         data: students.filter(matchChild) },
  ];
  const sections = allSections.filter(sec => sec.data.length > 0);

  const openEdit = (user: any) => {
    setEditUser(user);
    setEdit({ name: user.name || '', cognome: user.cognome || '', email: user.email || '', password: '', class_id: user.class_id || '' });
    setModal('edit');
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const payload: any = { name: editForm.name, cognome: editForm.cognome };
      if (editForm.email && editForm.email !== editUser.email) payload.email = editForm.email;
      if (editForm.password) payload.password = editForm.password;
      if (editForm.class_id) payload.class_id = editForm.class_id;
      await api.patch(`/users/${editUser.id}`, payload);
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...payload } : u));
      Alert.alert('Salvato', 'Dati aggiornati con successo');
      setModal(null);
    } catch (e: any) { Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile aggiornare'); }
    finally { setSaving(false); }
  };

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
    if (!iscForm.bambino_nome || !iscForm.genitore_email) {
      Alert.alert('Attenzione', 'Nome bambino e email genitore obbligatori'); return;
    }
    setSaving(true);
    try {
      const payload: any = {
        bambino_nome: iscForm.bambino_nome, bambino_cognome: iscForm.bambino_cognome,
        bambino_data_nascita: iscForm.bambino_data_nascita, class_id: iscForm.class_id,
        genitore_nome: iscForm.genitore_nome, genitore_cognome: iscForm.genitore_cognome,
        genitore_email: iscForm.genitore_email, genitore_password: iscForm.genitore_password,
        sede_id: sede,
      };
      const res = await api.post('/users/iscrizione', payload);
      setIscResult(res.data);

      // Secondo genitore (se inserito)
      if (iscForm.show_second_parent && iscForm.genitore2_email && res.data.student?.id) {
        try {
          await api.post('/users/secondo-genitore', {
            student_id: res.data.student.id,
            genitore_email: iscForm.genitore2_email,
            genitore_nome: iscForm.genitore2_nome,
            genitore_password: iscForm.genitore2_password || genPwd(),
          });
        } catch {}
      }

      // Secondo bambino (opzionale)
      if (iscForm.bambino2_nome && res.data.parent?.id && iscForm.bambino2_class_id) {
        try {
          await api.post('/users/iscrizione', {
            bambino_nome: iscForm.bambino2_nome,
            bambino_cognome: iscForm.bambino2_cognome || iscForm.bambino_cognome,
            class_id: iscForm.bambino2_class_id,
            genitore_email: iscForm.genitore_email,
            genitore_nome: iscForm.genitore_nome,
            parent_id_existing: res.data.parent?.id, // collega al genitore già creato
            sede_id: sede,
          });
        } catch {}
      }

      const uR = await api.get('/users');
      setUsers(uR.data || []);
    } catch (e: any) { Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile completare'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Elimina utente', 'Questa azione è irreversibile.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/users/${id}`); setUsers(prev => prev.filter(u => u.id !== id)); }
        catch { Alert.alert('Errore'); }
      }},
    ]);
  };

  const handleDeleteStudent = (id: string) => {
    Alert.alert('Elimina bambino', 'Questa azione è irreversibile.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/students/${id}`); setStudents(prev => prev.filter(x => x.id !== id)); }
        catch { Alert.alert('Errore'); }
      }},
    ]);
  };

  const closeIsc = () => {
    setModal(null); setIscResult(null);
    setIsc({ bambino_nome:'',bambino_cognome:'',bambino_data_nascita:'',class_id:'',
      genitore_nome:'',genitore_cognome:'',genitore_email:'',genitore_password:genPwd(),
      genitore2_nome:'',genitore2_cognome:'',genitore2_email:'',genitore2_password:'',
      show_second_parent: false });
  };

  return (
    <ScreenLayout title="Gestione Utenti" showBack color={C.primary} loading={loading} scrollable={false}>
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch}
          placeholder="Cerca utenti..." placeholderTextColor={C.muted} />
      </View>
      <View style={s.actionRow}>
        <TouchableOpacity onPress={() => setModal('staff')} style={[s.actionBtn, { backgroundColor: C.primary }]}>
          <Ionicons name="person-add-outline" size={16} color={C.white} />
          <Text style={s.actionBtnText}>Staff</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setIscResult(null); setModal('iscrizione'); }}
          style={[s.actionBtn, { backgroundColor: C.accentGreen }]}>
          <Ionicons name="happy-outline" size={16} color={C.white} />
          <Text style={s.actionBtnText}>Iscrivi Bambino</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => (item.role ? 'u' : 'c') + item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
        ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 40 }}>👥</Text><Text style={s.emptyText}>Nessun utente</Text></View>}
        renderSectionHeader={({ section }) => (
          <View style={[s.sectionHeader, { backgroundColor: section.color.bg }]}>
            <Text style={[s.sectionHeaderText, { color: section.color.text }]}>{section.title} ({section.data.length})</Text>
          </View>
        )}
        renderItem={({ item, section }) => {
          if (section.kind === 'child') {
            const cls = classes.find(c => c.id === item.class_id);
            return (
              <View style={s.userCard}>
                <View style={[s.avatar, { backgroundColor: CHILD_COLOR.bg }]}>
                  <Text style={[s.avatarText, { color: CHILD_COLOR.text }]}>{item.name?.charAt(0) || '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{item.name} {item.cognome}</Text>
                  <Text style={s.userEmail}>{cls?.name || 'Nessuna classe'}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteStudent(item.id)} style={s.delBtn}>
                  <Ionicons name="trash-outline" size={14} color={C.red} />
                </TouchableOpacity>
              </View>
            );
          }
          const rc = ROLE_COLORS[item.role] || ROLE_COLORS.parent;
          return (
            <TouchableOpacity onPress={() => openEdit(item)} style={s.userCard} activeOpacity={0.8}>
              <View style={[s.avatar, { backgroundColor: rc.bg }]}>
                <Text style={[s.avatarText, { color: rc.text }]}>{item.name?.charAt(0) || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.userName}>{item.name} {item.cognome}</Text>
                <Text style={s.userEmail}>{item.email}</Text>
                {item.admin_password && <Text style={s.userPwd}>pwd: {item.admin_password}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={[s.roleBadge, { backgroundColor: rc.bg }]}>
                  <Text style={[s.roleText, { color: rc.text }]}>{ROLE_LABEL[item.role] ?? item.role}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={s.editHint}><Ionicons name="pencil-outline" size={12} color={C.primary}/></View>
                  <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleDelete(item.id); }} style={s.delBtn}>
                    <Ionicons name="trash-outline" size={14} color={C.red} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── MODIFICA UTENTE ─────────────────────────────────────────────── */}
      <Modal visible={modal === 'edit'} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setModal(null)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Modifica Utente</Text>
            <TouchableOpacity onPress={() => setModal(null)}><Ionicons name="close" size={24} color={C.text}/></TouchableOpacity>
          </View>
          <ScrollView>
            <View style={[s.userInfoBox, { backgroundColor: ROLE_COLORS[editUser?.role || 'parent'].bg }]}>
              <Text style={[s.userInfoRole, { color: ROLE_COLORS[editUser?.role || 'parent'].text }]}>
                {editUser?.role} — {editUser?.email}
              </Text>
            </View>
            {[
              { key: 'name',     label: 'Nome',             ph: editUser?.name || '' },
              { key: 'cognome',  label: 'Cognome',          ph: editUser?.cognome || '' },
              { key: 'email',    label: 'Nuova email',      ph: 'Lascia vuoto per non cambiare', kbd: 'email-address' as any },
              { key: 'password', label: 'Nuova password',   ph: 'Lascia vuoto per non cambiare' },
            ].map(f => (
              <View key={f.key}>
                <Text style={s.fl}>{f.label}</Text>
                <TextInput style={s.input} value={(editForm as any)[f.key]}
                  onChangeText={t => setEdit(p => ({ ...p, [f.key]: t }))}
                  placeholder={f.ph} keyboardType={f.kbd} autoCapitalize="none"
                  secureTextEntry={f.key === 'password'} />
              </View>
            ))}
            {editUser?.role === 'teacher' && (
              <>
                <Text style={s.fl}>Classe assegnata</Text>
                <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                  {classes.map(cls => (
                    <TouchableOpacity key={cls.id} onPress={() => setEdit(p => ({ ...p, class_id: cls.id }))}
                      style={[s.chip, editForm.class_id === cls.id && { backgroundColor: C.primary, borderColor: C.primary }]}>
                      <Text style={[s.chipText, editForm.class_id === cls.id && { color: C.white }]}>{cls.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={saving}>
              <Text style={s.submitText}>{saving ? 'Salvataggio...' : 'Salva Modifiche'}</Text>
            </TouchableOpacity>
            {editUser?.role === 'parent' && (
              <TouchableOpacity style={[s.submitBtn, { backgroundColor: '#FF9500', marginTop: 8 }]}
                onPress={() => {
                  // Trova il bambino associato e aggiungi secondo genitore
                  const childId = editUser?.child_ids?.[0] || editUser?.child_id;
                  if (!childId) { Alert.alert('Attenzione', 'Nessun bambino associato a questo genitore'); return; }
                  Alert.prompt('Aggiungi secondo genitore', 'Email del secondo genitore:', async (email) => {
                    if (!email) return;
                    try {
                      await api.post('/users/secondo-genitore', {
                        student_id: childId,
                        genitore_email: email.trim(),
                      });
                      Alert.alert('Fatto', 'Secondo genitore aggiunto. Riceverà le credenziali via email.');
                      const uR = await api.get('/users');
                      setUsers(uR.data || []);
                      setModal(null);
                    } catch (e: any) {
                      Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile aggiungere');
                    }
                  }, 'plain-text', '', 'email-address');
                }}>
                <Text style={s.submitText}>+ Aggiungi Secondo Genitore</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── NUOVO STAFF ─────────────────────────────────────────────────── */}
      <Modal visible={modal === 'staff'} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setModal(null)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuovo Account Staff</Text>
            <TouchableOpacity onPress={() => setModal(null)}><Ionicons name="close" size={24} color={C.text}/></TouchableOpacity>
          </View>
          <ScrollView>
            {[
              { key: 'name',     label: 'Nome *',   ph: 'Mario' },
              { key: 'cognome',  label: 'Cognome',  ph: 'Rossi' },
              { key: 'email',    label: 'Email *',  ph: 'mario@scuola.it', kbd: 'email-address' as any },
              { key: 'password', label: 'Password', ph: 'Auto-generata' },
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

      {/* ── ISCRIZIONE BAMBINO ──────────────────────────────────────────── */}
      <Modal visible={modal === 'iscrizione'} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={closeIsc}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Iscrizione Bambino</Text>
            <TouchableOpacity onPress={closeIsc}><Ionicons name="close" size={24} color={C.text}/></TouchableOpacity>
          </View>
          {iscResult ? (
            <ScrollView>
              <View style={{ alignItems: 'center', padding: 20 }}>
                <Text style={{ fontSize: 52 }}>🎉</Text>
                <Text style={[s.modalTitle, { marginTop: 12 }]}>Iscrizione completata!</Text>
                {[
                  { label: 'Bambino', value: `${iscResult.student?.name} ${iscResult.student?.cognome}` },
                  { label: 'Email genitore', value: iscResult.parent?.email },
                  { label: 'Password', value: iscResult.new_password || iscForm.genitore_password },
                ].map((row, i) => (
                  <View key={i} style={[s.resultRow, { marginTop: 10 }]}>
                    <Text style={s.fl}>{row.label}</Text>
                    <Text style={[s.input, { color: C.primary, fontWeight: '700' }]}>{row.value}</Text>
                  </View>
                ))}
                {iscResult.email_inviata && (
                  <View style={[s.input, { backgroundColor: '#F0FFF4', marginTop: 10 }]}>
                    <Text style={{ color: '#065F46', fontWeight: '600' }}>✅ Email credenziali inviata al genitore</Text>
                  </View>
                )}
                <TouchableOpacity style={[s.submitBtn, { marginTop: 20 }]} onPress={closeIsc}>
                  <Text style={s.submitText}>Chiudi</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <ScrollView>
              {/* BAMBINO */}
              <Text style={[s.sectionHead, { color: C.accentGreen }]}>👶 Dati bambino</Text>
              {[
                { key: 'bambino_nome',         label: 'Nome *',          ph: 'Marco' },
                { key: 'bambino_cognome',       label: 'Cognome',         ph: 'Rossi' },
                { key: 'bambino_data_nascita',  label: 'Data di nascita', ph: 'YYYY-MM-DD' },
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
                    style={[s.chip, iscForm.class_id === cls.id && { backgroundColor: C.accentGreen, borderColor: C.accentGreen }]}>
                    <Text style={[s.chipText, iscForm.class_id === cls.id && { color: C.white }]}>{cls.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* GENITORE 1 */}
              <Text style={[s.sectionHead, { color: C.primary }]}>👨‍👩‍👦 Genitore</Text>
              {[
                { key: 'genitore_nome',     label: 'Nome',     ph: 'Luca' },
                { key: 'genitore_cognome',  label: 'Cognome',  ph: 'Rossi' },
                { key: 'genitore_email',    label: 'Email *',  ph: 'luca@email.it', kbd: 'email-address' as any },
                { key: 'genitore_password', label: 'Password', ph: 'Auto-generata' },
              ].map(f => (
                <View key={f.key}>
                  <Text style={s.fl}>{f.label}</Text>
                  <TextInput style={s.input} value={(iscForm as any)[f.key]}
                    onChangeText={t => setIsc(p => ({ ...p, [f.key]: t }))}
                    placeholder={f.ph} keyboardType={f.kbd} autoCapitalize="none" />
                </View>
              ))}

              {/* SECONDO GENITORE (toggle) */}
              <TouchableOpacity onPress={() => setIsc(p => ({ ...p, show_second_parent: !p.show_second_parent }))}
                style={[s.toggleBtn, iscForm.show_second_parent && { backgroundColor: '#EBF0FF', borderColor: C.primary }]}>
                <Ionicons name={iscForm.show_second_parent ? 'remove-circle-outline' : 'add-circle-outline'} size={18}
                  color={iscForm.show_second_parent ? C.red : C.primary} />
                <Text style={{ fontSize: 13, color: iscForm.show_second_parent ? C.red : C.primary, fontWeight: '700' }}>
                  {iscForm.show_second_parent ? 'Rimuovi secondo genitore' : '+ Aggiungi secondo genitore (separati/divorziati)'}
                </Text>
              </TouchableOpacity>

              {iscForm.show_second_parent && (
                <>
                  <Text style={[s.sectionHead, { color: '#FF9500' }]}>👤 Secondo Genitore (opzionale)</Text>
                  {[
                    { key: 'genitore2_nome',    label: 'Nome',     ph: 'Maria' },
                    { key: 'genitore2_cognome', label: 'Cognome',  ph: 'Bianchi' },
                    { key: 'genitore2_email',   label: 'Email *',  ph: 'maria@email.it', kbd: 'email-address' as any },
                    { key: 'genitore2_password',label: 'Password', ph: 'Auto-generata se vuoto' },
                  ].map(f => (
                    <View key={f.key}>
                      <Text style={s.fl}>{f.label}</Text>
                      <TextInput style={s.input} value={(iscForm as any)[f.key]}
                        onChangeText={t => setIsc(p => ({ ...p, [f.key]: t }))}
                        placeholder={f.ph} keyboardType={f.kbd} autoCapitalize="none" />
                    </View>
                  ))}
                </>
              )}

              {/* Secondo bambino (opzionale) */}
              <Text style={[s.sectionHead, { color: '#FF9500', marginTop: 16 }]}>👶 Secondo bambino (opzionale)</Text>
              <Text style={{fontSize:11,color:C.muted,marginBottom:8}}>Se la famiglia ha un altro bambino nella stessa scuola, aggiungilo qui e riceverà lo stesso account genitore.</Text>
              {[
                { key: 'bambino2_nome',    label: 'Nome secondo bambino',  ph: 'Sofia' },
                { key: 'bambino2_cognome', label: 'Cognome',               ph: 'Rossi' },
                { key: 'bambino2_class_id',label: 'Classe',                ph: '' },
              ].filter(f => f.ph !== 'SKIP').map(f => (
                f.key === 'bambino2_class_id' ? (
                  <View key={f.key}>
                    <Text style={s.fl}>Classe secondo bambino</Text>
                    <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                      <TouchableOpacity onPress={() => setIsc(p => ({ ...p, bambino2_class_id: '' }))}
                        style={[s.chip, !iscForm.bambino2_class_id && { backgroundColor: '#E5E7EB' }]}>
                        <Text style={s.chipText}>—</Text>
                      </TouchableOpacity>
                      {classes.map(cls => (
                        <TouchableOpacity key={cls.id} onPress={() => setIsc(p => ({ ...p, bambino2_class_id: cls.id }))}
                          style={[s.chip, iscForm.bambino2_class_id === cls.id && { backgroundColor: '#FF9500', borderColor: '#FF9500' }]}>
                          <Text style={[s.chipText, iscForm.bambino2_class_id === cls.id && { color: C.white }]}>{cls.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View key={f.key}>
                    <Text style={s.fl}>{f.label}</Text>
                    <TextInput style={s.input} value={(iscForm as any)[f.key] || ''}
                      onChangeText={t => setIsc(p => ({ ...p, [f.key]: t }))} placeholder={f.ph} />
                  </View>
                )
              ))}

              <TouchableOpacity style={[s.submitBtn, { backgroundColor: C.accentGreen }, saving && { opacity: 0.6 }]}
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
  searchRow:   { flexDirection:'row',alignItems:'center',backgroundColor:C.white,borderRadius:12,paddingHorizontal:12,marginHorizontal:10,marginTop:10,borderWidth:0.5,borderColor:C.border,height:44 },
  searchInput: { flex:1,fontSize:14,color:C.text },
  actionRow:   { flexDirection:'row',gap:10,padding:10 },
  actionBtn:   { flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:11,borderRadius:12 },
  actionBtnText:{ color:C.white,fontWeight:'700',fontSize:13 },
  empty:       { alignItems:'center',paddingTop:50 },
  emptyText:   { color:C.muted,fontSize:14,marginTop:10 },
  sectionHeader:{ paddingHorizontal:12,paddingVertical:6,borderRadius:8,marginTop:10,marginBottom:6 },
  sectionHeaderText:{ fontSize:13,fontWeight:'800' },
  userCard:    { flexDirection:'row',alignItems:'center',gap:10,backgroundColor:C.white,borderRadius:12,padding:10,marginBottom:6,borderWidth:0.5,borderColor:C.border },
  avatar:      { width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center' },
  avatarText:  { fontSize:16,fontWeight:'800' },
  userName:    { fontSize:13,fontWeight:'700',color:C.text },
  userEmail:   { fontSize:11,color:C.muted },
  userPwd:     { fontSize:10,color:C.primary,fontWeight:'500' },
  roleBadge:   { borderRadius:20,paddingHorizontal:8,paddingVertical:2 },
  roleText:    { fontSize:10,fontWeight:'700' },
  editHint:    { padding:4,backgroundColor:'#EBF0FF',borderRadius:6 },
  delBtn:      { padding:4 },
  modal:       { flex:1,padding:20,backgroundColor:'#FFFDD0' },
  modalHeader: { flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12 },
  modalTitle:  { fontSize:20,fontWeight:'800',color:C.text },
  userInfoBox: { borderRadius:10,padding:10,marginBottom:8 },
  userInfoRole:{ fontSize:12,fontWeight:'700' },
  fl:          { fontSize:12,fontWeight:'700',color:'#6B7280',marginBottom:5,marginTop:12 },
  input:       { borderWidth:1,borderColor:C.border,borderRadius:12,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:C.text,backgroundColor:C.white },
  chipRow:     { flexDirection:'row',gap:8 },
  chip:        { paddingHorizontal:12,paddingVertical:7,borderRadius:20,borderWidth:1,borderColor:C.border,backgroundColor:C.white },
  chipText:    { fontSize:13,fontWeight:'600',color:C.text },
  submitBtn:   { backgroundColor:C.primary,borderRadius:14,paddingVertical:14,alignItems:'center',marginTop:20 },
  submitText:  { color:C.white,fontWeight:'700',fontSize:15 },
  sectionHead: { fontSize:14,fontWeight:'800',marginTop:20,marginBottom:4 },
  toggleBtn:   { flexDirection:'row',alignItems:'center',gap:8,borderWidth:1,borderColor:C.border,borderRadius:12,padding:12,marginTop:16,backgroundColor:C.white },
  resultRow:   { width:'100%' },
});
