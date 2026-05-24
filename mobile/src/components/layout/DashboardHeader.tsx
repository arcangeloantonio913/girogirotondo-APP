import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sidebar from './Sidebar';

interface Props {
  navigation: any;
  children: React.ReactNode;
  currentScreen?: string;
}

export default function DashboardHeader({ navigation, children, currentScreen = 'Home' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      {/* Hamburger button — posizionato in alto a sinistra, sopra al contenuto */}
      <TouchableOpacity onPress={() => setOpen(true)} style={s.hamburger}>
        <Ionicons name="menu" size={24} color="#1A202C" />
      </TouchableOpacity>
      {children}
      <Sidebar visible={open} onClose={() => setOpen(false)} navigation={navigation} currentScreen={currentScreen} />
    </View>
  );
}

const s = StyleSheet.create({
  hamburger: {
    position: 'absolute', top: 14, left: 14, zIndex: 100,
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
});
