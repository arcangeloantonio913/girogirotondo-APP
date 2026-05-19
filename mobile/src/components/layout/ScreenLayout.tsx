import React from 'react';
import {
  View, Text, TouchableOpacity, StatusBar,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

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
  loading = false, color = '#4169E1', scrollable = true,
}: Props) {
  const navigation = useNavigation();

  const Content = scrollable ? ScrollView : View;
  const contentProps = scrollable
    ? { contentContainerStyle: { padding: 16, paddingBottom: 32 }, showsVerticalScrollIndicator: false }
    : { style: { flex: 1, padding: 16 } };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDD0' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFDD0" />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
      }}>
        {showBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={24} color="#374151" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 32 }} />
        )}
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A202C', flex: 1, textAlign: 'center' }}>
          {title}
        </Text>
        <View style={{ width: 32, alignItems: 'flex-end' }}>
          {rightAction || null}
        </View>
      </View>

      {/* Contenuto */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={color} />
        </View>
      ) : (
        <Content {...contentProps}>
          {children}
        </Content>
      )}
    </SafeAreaView>
  );
}
