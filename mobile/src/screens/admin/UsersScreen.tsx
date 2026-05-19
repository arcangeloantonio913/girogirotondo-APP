import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

function generatePassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function AdminUsers() {
  const { sede } = useAuth();
  const [users, setUsers]       = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [tab, setTab]           = useState<'users' | 'students'>('users');

  // Dialog iscrizione
  const [showIsc, setShowIsc]   = useState(false);
  const [iscForm, setIscForm]   = useState({
    bambino_nome: '', bambino_cognome: '', class_id: '',
    genitore_email: '', genitore_nome: '', genitore_password: generatePassword(),
  });
  const [iscLoading, setIscLoading] = useState(false);
  const [iscResult, setIscResult]   = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/users'),
      api.get('/students'),
      api.get('/classes'),
    ]).then(([u, s, c]) => {
      setUsers(u.data || []);
      setStudents(s.data || []);
      setClasses(c.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  const filteredUsers = users.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredStudents = students.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.cognome?.toLowerCase().includes(search.toLowerCase())
  );

  const deleteUser = (id: string, name: string) => {
    Alert.alert('Elimina utente', `Elimina ${name}?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/users/${id}`);
            setUsers(prev => prev.filter(u => u.id !== id));
          } catch { Alert.alert('Errore', 'Impossibile eliminare.'); }
        },
      },
    ]);
  };

  const deleteStudent = (id: string, name: string) => {
    Alert.alert('Elimina alunno', `Elimina ${name}?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/students/${id}`);
            setStudents(prev => prev.filter(s => s.id !== id));
          } catch { Alert.alert('Errore', 'Impossibile eliminare.'); }
        },
      },
    ]);
  };

  const handleIscrizione = async () => {
    if (!iscForm.bambino_nome || !iscForm.bambino_cognome || !iscForm.class_id || !iscForm.genitore_email) {
      Alert.alert('Attenzione', 'Compila tutti i campi obbligatori.');
      return;
    }
    setIscLoading(true);
    try {
      const res = await api.post('/users/iscrizione', { ...iscForm, sede_id: sede });
      setIscResult(res.data);
      setStudents(prev => [...prev, res.data.student]);
      if (res.data.parent) setUsers(prev => [...prev, res.data.parent]);
    } catch (e: any) {
      Alert.alert('Errore', e.response?.data?.detail || 'Iscrizione fallita.');
    } finally { setIscLoading(false); }
  };

  const roleColor: Record<string, string> = { admin: '#4169E1', teacher: '#FF69B4', parent: '#32CD32' };
  const roleLabel: Record<string, string> = { admin: 'Admin', teacher: 'Maestra', parent: 'Genitore' };

  if (loading) return <ScreenLayout title="Gestione Utenti" loading />;

  return (
    <ScreenLayout title="Gestione Utenti" scrollable={false}
      rightAction={
        <TouchableOpacity onPress={() => { setShowIsc(true); setIscResult(null); }}
          style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#EBF0FF', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="person-add" size={18} color="#4169E1" />
        </TouchableOpacity>
      }>

      {/* Search */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 16, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Cerca..." placeholderTextColor="#D1D5DB"
          style={{ flex: 1, height: 44, fontSize: 15, color: '#1A202C' }} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color="#9CA3AF" /></TouchableOpacity> : null}
      </View>

      {/* Tab */}
      <View style={{ flexDirection: 'row', margin: 16, marginBottom: 8, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 3 }}>
        {(['users', 'students'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: tab === t ? '#FFF' : 'transparent' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: tab === t ? '#1A202C' : '#9CA3AF' }}>
              {t === 'users' ? `Utenti (${users.length})` : `Alunni (${students.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'users' ? (
        <FlatList
          data={filteredUsers}
          keyExtractor={u => u.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item: u }) => (
            <View style={{ backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${roleColor[u.role]}25`, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: roleColor[u.role] }}>{u.name?.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A202C' }}>{u.name}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{u.email}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <View style={{ backgroundColor: `${roleColor[u.role]}20`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: roleColor[u.role] }}>{roleLabel[u.role]}</Text>
                  </View>
                </View>
              </View>
              {!u.is_superadmin && (
                <TouchableOpacity onPress={() => deleteUser(u.id, u.name)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={s => s.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item: s }) => {
            const cls = classes.find(c => c.id === s.class_id);
            return (
              <View style={{ backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EBF0FF', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#4169E1' }}>{s.name?.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A202C' }}>{s.name} {s.cognome || ''}</Text>
                  {cls && <Text style={{ fontSize: 12, color: '#FF69B4', fontWeight: '600' }}>{cls.name}</Text>}
                </View>
                <TouchableOpacity onPress={() => deleteStudent(s.id, s.name)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Modal Iscrizione */}
      <Modal visible={showIsc} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowIsc(false)}>
        <View style={{ flex: 1, backgroundColor: '#FFFDD0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A202C' }}>Iscrivi Bambino</Text>
            <TouchableOpacity onPress={() => setShowIsc(false)}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {iscResult ? (
            <View style={{ padding: 24, gap: 16 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 40 }}>✅</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A202C', marginTop: 12 }}>
                  {iscResult.student?.name} iscritto!
                </Text>
                <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
                  {iscResult.email_inviata ? '📧 Email inviata al genitore' : '📧 Consegna manuale credenziali'}
                </Text>
              </View>
              <View style={{ backgroundColor: '#EBF0FF', borderRadius: 16, padding: 16, gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#4169E1', textTransform: 'uppercase' }}>Credenziali genitore</Text>
                <Text style={{ fontSize: 14, color: '#374151' }}>Email: {iscResult.genitore_email}</Text>
                <Text style={{ fontSize: 14, color: '#374151' }}>Password: <Text style={{ fontWeight: '800', color: '#4169E1' }}>{iscForm.genitore_password}</Text></Text>
              </View>
              <TouchableOpacity onPress={() => { setShowIsc(false); setIscResult(null); setIscForm({ bambino_nome: '', bambino_cognome: '', class_id: '', genitore_email: '', genitore_nome: '', genitore_password: generatePassword() }); }}
                style={{ backgroundColor: '#4169E1', borderRadius: 14, height: 50, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Chiudi</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={[1]}
              keyExtractor={() => 'form'}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              renderItem={() => (
                <View style={{ gap: 12 }}>
                  {[
                    { key: 'bambino_nome', label: 'Nome bambino *', placeholder: 'Nome' },
                    { key: 'bambino_cognome', label: 'Cognome bambino *', placeholder: 'Cognome' },
                    { key: 'genitore_nome', label: 'Nome genitore', placeholder: 'Nome Cognome' },
                    { key: 'genitore_email', label: 'Email genitore *', placeholder: 'email@esempio.it', keyboard: 'email-address' },
                  ].map(f => (
                    <View key={f.key}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>{f.label}</Text>
                      <TextInput
                        value={iscForm[f.key as keyof typeof iscForm]}
                        onChangeText={t => setIscForm(prev => ({ ...prev, [f.key]: t }))}
                        placeholder={f.placeholder} placeholderTextColor="#D1D5DB"
                        keyboardType={(f.keyboard || 'default') as any}
                        autoCapitalize={f.keyboard === 'email-address' ? 'none' : 'words'}
                        style={{ borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#1A202C', backgroundColor: '#FFF' }} />
                    </View>
                  ))}

                  {/* Classe */}
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 }}>Classe *</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {classes.map(c => (
                        <TouchableOpacity key={c.id} onPress={() => setIscForm(prev => ({ ...prev, class_id: c.id }))}
                          style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: iscForm.class_id === c.id ? '#4169E1' : '#F3F4F6' }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: iscForm.class_id === c.id ? '#FFF' : '#374151' }}>{c.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Password */}
                  <View style={{ backgroundColor: '#EBF0FF', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>Password:</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#4169E1' }}>{iscForm.genitore_password}</Text>
                    <TouchableOpacity onPress={() => setIscForm(prev => ({ ...prev, genitore_password: generatePassword() }))}>
                      <Ionicons name="refresh" size={18} color="#4169E1" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={handleIscrizione} disabled={iscLoading}
                    style={{ backgroundColor: iscLoading ? '#86EFAC' : '#32CD32', borderRadius: 14, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
                    {iscLoading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>✓ Iscrivi</Text>}
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </ScreenLayout>
  );
}
