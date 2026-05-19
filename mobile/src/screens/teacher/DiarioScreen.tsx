import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const TODAY = new Date().toISOString().split('T')[0];

const MOODS = ['😊','😢','😴','🤒','😤','🎉','😍','😮'];
const ACTIVITIES = ['Lettura','Pittura','Musica','Sport','Natura','Cucina','Teatro','Puzzle'];

export default function TeacherDiario() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;
  const [entries, setEntries]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote]         = useState('');
  const [mood, setMood]         = useState('');
  const [activities, setActivities] = useState<string[]>([]);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    api.get(`/diary?class_id=${classId}`)
      .then(r => setEntries(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [classId]);

  const toggleActivity = (a: string) => {
    setActivities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  const save = async () => {
    if (!classId || !note.trim()) { Alert.alert('Attenzione', 'Inserisci una nota.'); return; }
    setSaving(true);
    try {
      const res = await api.post('/diary', { class_id: classId, date: TODAY, note: note.trim(), mood, activities });
      setEntries(prev => [res.data, ...prev]);
      setShowForm(false); setNote(''); setMood(''); setActivities([]);
    } catch { Alert.alert('Errore', 'Impossibile salvare.'); }
    finally { setSaving(false); }
  };

  if (loading) return <ScreenLayout title="Diario di Bordo" loading />;

  return (
    <ScreenLayout title="Diario di Bordo" scrollable={false}
      rightAction={
        <TouchableOpacity onPress={() => setShowForm(!showForm)}>
          <Text style={{ fontSize: 24, color: '#A7C7E7' }}>{showForm ? '✕' : '+'}</Text>
        </TouchableOpacity>
      }>
      {showForm && (
        <View style={{ backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#1A202C', marginBottom: 12 }}>Nuova nota — oggi</Text>

          {/* Mood */}
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 }}>Umore della classe</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {MOODS.map(m => (
              <TouchableOpacity key={m} onPress={() => setMood(m === mood ? '' : m)}
                style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: mood === m ? '#EBF0FF' : '#F9FAFB', justifyContent: 'center', alignItems: 'center', borderWidth: mood === m ? 2 : 0, borderColor: '#4169E1' }}>
                <Text style={{ fontSize: 22 }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Attività */}
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 }}>Attività svolte</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {ACTIVITIES.map(a => (
              <TouchableOpacity key={a} onPress={() => toggleActivity(a)}
                style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: activities.includes(a) ? '#EBF0FF' : '#F3F4F6', borderWidth: activities.includes(a) ? 1.5 : 0, borderColor: '#4169E1' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: activities.includes(a) ? '#4169E1' : '#6B7280' }}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Nota */}
          <TextInput value={note} onChangeText={setNote} multiline numberOfLines={3}
            placeholder="Racconta come è andata la giornata..." placeholderTextColor="#D1D5DB"
            style={{ borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#1A202C', minHeight: 80, textAlignVertical: 'top', marginBottom: 12 }} />

          <TouchableOpacity onPress={save} disabled={saving}
            style={{ backgroundColor: saving ? '#93C5FD' : '#4169E1', borderRadius: 12, height: 46, justifyContent: 'center', alignItems: 'center' }}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>Pubblica nota</Text>}
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={entries}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: '#FFF', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'capitalize' }}>
                {new Date(item.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
              {item.mood && <Text style={{ fontSize: 22 }}>{item.mood}</Text>}
            </View>
            {item.activities?.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {item.activities.map((a: string, i: number) => (
                  <View key={i} style={{ backgroundColor: '#EBF0FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, color: '#4169E1', fontWeight: '600' }}>{a}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={{ fontSize: 14, color: '#374151', lineHeight: 20 }}>{item.note}</Text>
          </View>
        )}
      />
    </ScreenLayout>
  );
}
