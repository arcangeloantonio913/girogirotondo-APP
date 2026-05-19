import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const TODAY = new Date().toISOString().split('T')[0];

interface Card {
  icon: string; label: string; color: string; bg: string; tab: string;
}

const CARDS: Card[] = [
  { icon: 'images',      label: 'Galleria Foto',     color: '#FF69B4', bg: '#FFF0F7', tab: 'Foto' },
  { icon: 'grid',        label: 'Griglia Pasti',     color: '#F4C2C2', bg: '#FFF5F5', tab: 'Griglia' },
  { icon: 'restaurant',  label: 'Menu Mensa',        color: '#32CD32', bg: '#F0FFF0', tab: 'Dieta' },
  { icon: 'book',        label: 'Diario di Bordo',   color: '#A7C7E7', bg: '#EBF0FF', tab: 'Diario' },
];

export default function ParentDashboard({ navigation }: any) {
  const { user, activeChildId, childIds, setActiveChildId, logout, refreshUser } = useAuth();
  const [child, setChild] = useState<any>(null);
  const [griglia, setGriglia] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);

  const childId = activeChildId || childIds[0];

  useEffect(() => {
    if (!childId) return;
    // Refresh profilo utente per dati aggiornati
    refreshUser();
    // Carica dati bambino
    api.get(`/students/${childId}`).then(r => setChild(r.data)).catch(() => {});
    api.get(`/griglia?student_id=${childId}&date=${TODAY}`).then(r => setGriglia(r.data?.[0] || null)).catch(() => {});
    // Carica tutti i figli se ce ne sono più di uno
    if (childIds.length > 1) {
      api.get('/students').then(r => setChildren(r.data?.filter((s: any) => childIds.includes(s.id)) || [])).catch(() => {});
    }
  }, [childId]);

  const todayFormatted = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDD0' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFDD0" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#1A202C' }}>
              Ciao! 👋
            </Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' }}>
              {todayFormatted}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { logout(); }}
            style={{ padding: 8, borderRadius: 12, backgroundColor: '#FEE2E2' }}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Child switcher (se più figli) */}
        {childIds.length > 1 && children.length > 0 && (
          <View style={{
            backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 16,
            shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>
              Figlio attivo
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {children.map(c => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setActiveChildId(c.id)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                    backgroundColor: c.id === childId ? '#32CD32' : '#F3F4F6',
                  }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: c.id === childId ? '#FFF' : '#374151' }}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Card bambino */}
        <View style={{
          backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 20,
          shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{
              width: 54, height: 54, borderRadius: 27,
              backgroundColor: '#F4C2C2', justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#7A3B3B' }}>
                {child?.name?.charAt(0) || '?'}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A202C' }}>
                {child?.name} {child?.cognome || ''}
              </Text>
              {child?.date_of_birth && (
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  Cod. {child?.child_code || '—'}
                </Text>
              )}
            </View>
          </View>

          {/* Riepilogo griglia oggi */}
          {griglia && (
            <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>
                Pasti di oggi
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { key: 'merenda', label: 'Merenda', color: '#FFB347' },
                  { key: 'pasta',   label: 'Pasta',   color: '#F4C2C2' },
                  { key: 'secondo', label: 'Secondo', color: '#A7C7E7' },
                  { key: 'frutta',  label: 'Frutta',  color: '#98FB98' },
                ].map(p => (
                  <View key={p.key} style={{
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                    backgroundColor: griglia[p.key] ? `${p.color}40` : '#F3F4F6',
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: griglia[p.key] ? '#374151' : '#9CA3AF' }}>
                      {p.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Griglia sezioni */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 12 }}>
          Sezioni
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {CARDS.map(card => (
            <TouchableOpacity
              key={card.tab}
              onPress={() => navigation.navigate(card.tab)}
              style={{
                width: '47%', backgroundColor: card.bg, borderRadius: 18,
                padding: 18, shadowColor: '#000', shadowOpacity: 0.04,
                shadowRadius: 8, elevation: 2,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: `${card.color}25`, justifyContent: 'center', alignItems: 'center', marginBottom: 10,
              }}>
                <Ionicons name={card.icon as any} size={22} color={card.color} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A202C' }}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* GDPR */}
        <Text style={{ textAlign: 'center', color: '#D1D5DB', fontSize: 10, marginTop: 24 }}>
          🔒 Dati trattati nel rispetto del GDPR e della tutela dei minori.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
