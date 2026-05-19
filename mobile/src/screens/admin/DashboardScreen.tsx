import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const SEDI = [
  { id: 'girogirotondo',  label: 'Girogirotondo',  color: '#4169E1' },
  { id: 'il-magico-mondo', label: 'Il Magico Mondo', color: '#FF69B4' },
];

const CARDS = [
  { icon: 'people',     label: 'Gestione Utenti', color: '#4169E1', bg: '#EBF0FF', tab: 'Utenti' },
  { icon: 'clipboard',  label: 'Presenze',         color: '#FF9500', bg: '#FFF7E6', tab: 'Presenze' },
  { icon: 'restaurant', label: 'Menu Mensa',        color: '#32CD32', bg: '#F0FFF0', tab: 'Mensa' },
];

export default function AdminDashboard({ navigation }: any) {
  const { user, sede, updateSede, logout, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState({ users: 0, students: 0, classes: 0 });

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/students'), api.get('/classes')])
      .then(([u, s, c]) => setStats({ users: u.data.length, students: s.data.length, classes: c.data.length }))
      .catch(() => {});
  }, [sede]);

  const sedeInfo = SEDI.find(s => s.id === sede) || SEDI[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDD0' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFDD0" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#1A202C' }}>Dashboard</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Amministrazione</Text>
          </View>
          <TouchableOpacity onPress={logout} style={{ padding: 8, borderRadius: 12, backgroundColor: '#FEE2E2' }}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Sede switcher — solo superadmin */}
        {isSuperAdmin && (
          <View style={{ backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10 }}>Sede attiva</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {SEDI.map(s => (
                <TouchableOpacity key={s.id} onPress={() => updateSede(s.id)}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: sede === s.id ? s.color : '#F3F4F6' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: sede === s.id ? '#FFF' : '#6B7280' }}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Statistiche */}
        <View style={{ backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A202C', marginBottom: 14 }}>
            📍 {sedeInfo.label}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'Utenti',   value: stats.users,    color: '#4169E1' },
              { label: 'Alunni',   value: stats.students, color: '#FF69B4' },
              { label: 'Classi',   value: stats.classes,  color: '#32CD32' },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, alignItems: 'center', backgroundColor: `${s.color}15`, borderRadius: 14, paddingVertical: 12 }}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: s.color }}>{s.value}</Text>
                <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Sezioni */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 12 }}>Sezioni</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {CARDS.map(card => (
            <TouchableOpacity key={card.tab} onPress={() => navigation.navigate(card.tab)}
              style={{ width: '47%', backgroundColor: card.bg, borderRadius: 18, padding: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
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
