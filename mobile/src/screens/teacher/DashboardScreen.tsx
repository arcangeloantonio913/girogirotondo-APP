import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const CARDS = [
  { icon: 'clipboard',  label: 'Registro Presenze', color: '#4169E1', bg: '#EBF0FF', tab: 'Presenze' },
  { icon: 'grid',       label: 'Griglia Pasti',     color: '#FF69B4', bg: '#FFF0F7', tab: 'Griglia' },
  { icon: 'book',       label: 'Diario di Bordo',   color: '#A7C7E7', bg: '#EBF0FF', tab: 'Diario' },
  { icon: 'camera',     label: 'Carica Foto',        color: '#32CD32', bg: '#F0FFF0', tab: 'Media' },
];

export default function TeacherDashboard({ navigation }: any) {
  const { user, logout } = useAuth();
  const [className, setClassName] = useState('');
  const [studentCount, setStudentCount] = useState(0);

  const classId = user?.class_ids?.[0] || user?.class_id;

  useEffect(() => {
    if (!classId) return;
    api.get('/classes').then(r => {
      const cls = r.data.find((c: any) => c.id === classId);
      if (cls) setClassName(cls.name);
    }).catch(() => {});
    api.get('/students').then(r => setStudentCount(r.data?.length || 0)).catch(() => {});
  }, [classId]);

  const todayFormatted = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDD0' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFDD0" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 13, color: '#9CA3AF' }}>Ciao Maestra,</Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#1A202C' }}>{user?.name}</Text>
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' }}>{todayFormatted}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={{ padding: 8, borderRadius: 12, backgroundColor: '#FEE2E2' }}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Classe */}
        <View style={{
          backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 20,
          shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFF0F7', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="school" size={22} color="#FF69B4" />
            </View>
            <View>
              <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase' }}>La tua classe</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#FF69B4' }}>Classe {className || '...'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '900', color: '#FF69B4' }}>{studentCount}</Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Alunni</Text>
            </View>
          </View>
        </View>

        {/* Card sezioni */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 12 }}>Sezioni</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {CARDS.map(card => (
            <TouchableOpacity
              key={card.tab}
              onPress={() => navigation.navigate(card.tab)}
              style={{
                width: '47%', backgroundColor: card.bg, borderRadius: 18, padding: 18,
                shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
              }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${card.color}25`, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name={card.icon as any} size={22} color={card.color} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A202C' }}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
