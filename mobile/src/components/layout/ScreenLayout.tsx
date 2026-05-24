import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar, SafeAreaView,
  ScrollView, ActivityIndicator, StyleSheet, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import Sidebar from './Sidebar';

const C = { bg: '#FFFDD0', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6' };

const ROLE_COLORS: Record<string, string> = {
  admin: '#4169E1', teacher: '#FF69B4', parent: '#32CD32',
};

const LOGOS: Record<string, any> = {
  'girogirotondo':   require('../../../assets/logo-girogirotondo.png'),
  'il-magico-mondo': require('../../../assets/logo-magico-mondo.png'),
};

interface Props {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  color?: string;
  scrollable?: boolean;
}

export default function ScreenLayout({
  title, showBack = false, rightAction, children,
  loading = false, color, scrollable = true,
}: Props) {
  const nav        = useNavigation() as any;
  const { user, sede } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const accentColor = color || ROLE_COLORS[user?.role || 'parent'] || '#A7C7E7';

  // Sede da mostrare: per admin usa sede attivo, per altri usa sede_id utente
  const sedeKey = (user?.role === 'admin' ? sede : user?.sede_id) || 'girogirotondo';
  const logoSrc = LOGOS[sedeKey] || LOGOS['girogirotondo'];

  const Wrapper = scrollable ? ScrollView : View;
  const wrapperProps = scrollable
    ? { showsVerticalScrollIndicator: false, contentContainerStyle: { flexGrow: 1, paddingBottom: 20 } }
    : { style: { flex: 1 } };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.header}>

        {/* Sinistra: back oppure spazio vuoto */}
        {showBack ? (
          <TouchableOpacity onPress={() => nav.goBack()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}

        {/* Centro: logo scuola + titolo pagina */}
        <View style={s.center}>
          <Image source={logoSrc} style={s.logo} resizeMode="contain" />
          <View style={s.titleRow}>
            <View style={[s.dot, { backgroundColor: accentColor }]} />
            <Text style={s.title} numberOfLines={1}>{title}</Text>
          </View>
        </View>

        {/* Destra: custom action + hamburger (o solo hamburger) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {rightAction}
          <TouchableOpacity onPress={() => setSidebarOpen(true)} style={s.iconBtn}>
            <Ionicons name="menu" size={26} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Contenuto ──────────────────────────────────────────────────── */}
      {loading
        ? <ActivityIndicator size="large" color={accentColor} style={{ flex: 1 }} />
        : <Wrapper {...(wrapperProps as any)}>{children}</Wrapper>
      }

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigation={nav}
        currentScreen={title}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.white,
    borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  center:  { flex: 1, alignItems: 'center', gap: 2 },
  logo:    { width: 28, height: 28, borderRadius: 14 },
  titleRow:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:     { width: 7, height: 7, borderRadius: 4 },
  title:   { fontSize: 15, fontWeight: '800', color: C.text },
});
