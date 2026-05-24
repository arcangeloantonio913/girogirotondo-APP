import React from 'react';
import { View, Text, TouchableOpacity, StatusBar, SafeAreaView, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const C = { bg: '#FFFDD0', white: '#FFFFFF', babyBlue: '#A7C7E7', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6' };

interface Props {
  title: string; showBack?: boolean; rightAction?: React.ReactNode;
  children: React.ReactNode; loading?: boolean; color?: string; scrollable?: boolean;
}

export default function ScreenLayout({ title, showBack = false, rightAction, children, loading = false, color = C.babyBlue, scrollable = true }: Props) {
  const nav = useNavigation() as any;
  const Wrapper = scrollable ? ScrollView : View;
  const wrapperProps = scrollable ? { showsVerticalScrollIndicator: false, contentContainerStyle: { flexGrow: 1, paddingBottom: 20 } } : { style: { flex: 1 } };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      {/* Header */}
      <View style={s.header}>
        {showBack ? (
          <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
        <View style={s.titleContainer}>
          <View style={[s.titleDot, { backgroundColor: color }]} />
          <Text style={s.title}>{title}</Text>
        </View>
        {rightAction ?? <View style={{ width: 36 }} />}
      </View>

      {loading
        ? <ActivityIndicator size="large" color={color} style={{ flex: 1 }} />
        : <Wrapper {...wrapperProps as any}>{children}</Wrapper>
      }
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  titleContainer:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleDot:{ width: 8, height: 8, borderRadius: 4 },
  title:  { fontSize: 17, fontWeight: '800', color: C.text },
});
