import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar, SafeAreaView,
  ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import Sidebar from './Sidebar';

const C = { bg: '#FFFDD0', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6' };

const ROLE_COLORS: Record<string, string> = {
  admin: '#4169E1', teacher: '#FF69B4', parent: '#32CD32',
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
  const nav      = useNavigation() as any;
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const accentColor = color || ROLE_COLORS[user?.role || 'parent'] || '#A7C7E7';

  const Wrapper = scrollable ? ScrollView : View;
  const wrapperProps = scrollable
    ? { showsVerticalScrollIndicator: false, contentContainerStyle: { flexGrow: 1, paddingBottom: 20 } }
    : { style: { flex: 1 } };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        {/* Left: back OR hamburger */}
        {showBack ? (
          <TouchableOpacity onPress={() => nav.goBack()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setSidebarOpen(true)} style={s.iconBtn}>
            <Ionicons name="menu" size={24} color={C.text} />
          </TouchableOpacity>
        )}

        {/* Center: dot + title */}
        <View style={s.titleRow}>
          <View style={[s.dot, { backgroundColor: accentColor }]} />
          <Text style={s.title} numberOfLines={1}>{title}</Text>
        </View>

        {/* Right: custom action OR empty spacer */}
        {rightAction ?? <View style={{ width: 36 }} />}
      </View>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {loading
        ? <ActivityIndicator size="large" color={accentColor} style={{ flex: 1 }} />
        : <Wrapper {...(wrapperProps as any)}>{children}</Wrapper>
      }

      {/* ── Sidebar overlay ────────────────────────────────────────────────── */}
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
  root:     { flex: 1, backgroundColor: C.bg },
  header:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: C.white,
    borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  iconBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', marginHorizontal: 8 },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  title:    { fontSize: 17, fontWeight: '800', color: C.text },
});
