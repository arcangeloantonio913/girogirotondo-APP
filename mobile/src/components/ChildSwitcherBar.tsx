// Barra selettore-figli SEMPRE VISIBILE per i genitori con più di un bambino.
// Prima lo switch era un modal nascosto dietro l'avatar (solo nella Dashboard) → poco
// intuitivo. Ora: pillole col nome di ogni figlio, quella attiva evidenziata, un tap cambia.
// Si auto-nasconde se il genitore ha 0/1 figlio (quindi innocua per maestre/admin).
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/AuthContext';
import api from '../lib/api';
import { tenant } from '../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };

// Cache nomi figli (evita di rifare la fetch su ogni schermata).
const _nameCache: Record<string, { name: string; cognome?: string }> = {};

export default function ChildSwitcherBar() {
  const { childIds, activeChildId, setActiveChildId } = useAuth();
  const [kids, setKids] = useState<{ id: string; name: string; cognome?: string }[]>([]);

  useEffect(() => {
    if (!childIds || childIds.length <= 1) { setKids([]); return; }
    let cancelled = false;
    (async () => {
      const result: { id: string; name: string; cognome?: string }[] = [];
      for (const id of childIds) {
        if (_nameCache[id]) { result.push({ id, ..._nameCache[id] }); continue; }
        try {
          const d = (await api.get(`/students/${id}`)).data || {};
          _nameCache[id] = { name: d.name || 'Bambino', cognome: d.cognome };
        } catch {
          _nameCache[id] = { name: 'Bambino' };
        }
        result.push({ id, ..._nameCache[id] });
      }
      if (!cancelled) setKids(result);
    })();
    return () => { cancelled = true; };
  }, [childIds.join(',')]);

  // Niente barra se c'è un solo figlio (o nessuno → maestre/admin).
  if (!childIds || childIds.length <= 1 || kids.length <= 1) return null;
  const active = activeChildId || childIds[0];

  return (
    <View style={st.wrap} testID="child-switcher-bar">
      <Text style={st.label}>I tuoi bambini · tocca per cambiare</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
        {kids.map(k => {
          const isActive = k.id === active;
          const first = (k.name || '').split(' ')[0] || 'Bambino';
          return (
            <TouchableOpacity
              key={k.id}
              onPress={() => setActiveChildId(k.id)}
              activeOpacity={0.8}
              style={[st.pill, isActive ? st.pillActive : st.pillIdle]}
              testID={`child-pill-${k.id}`}
            >
              <View style={[st.ava, { backgroundColor: isActive ? '#FFFFFF' : C.primary }]}>
                <Text style={{ color: isActive ? C.primary : '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                  {first.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[st.name, { color: isActive ? '#FFFFFF' : C.text }]} numberOfLines={1}>{first}</Text>
              {isActive && <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap:       { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6, backgroundColor: C.bg },
  label:      { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 7, marginLeft: 4, letterSpacing: 0.2 },
  row:        { gap: 8, paddingRight: 14 },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1.5 },
  pillActive: { backgroundColor: C.primary, borderColor: C.primary },
  pillIdle:   { backgroundColor: C.white, borderColor: C.border },
  ava:        { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  name:       { fontSize: 14, fontWeight: '700', maxWidth: 120 },
});
