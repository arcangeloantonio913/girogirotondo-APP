import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, ScrollView, Pressable, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';
import { navigate as globalNavigate, navigateToTab } from '../../navigation/NavigationService';

const { width: W } = Dimensions.get('window');
const SIDEBAR_W = Math.min(300, W * 0.82);

const LOGOS: Record<string, any> = {
  'girogirotondo':   require('../../../assets/logo-girogirotondo.png'),
  'il-magico-mondo': require('../../../assets/logo-magico-mondo.png'),
};

const NAV: Record<string, { icon: string; label: string; screen: string; isTab: boolean }[]> = {
  parent: [
    { icon: 'home-outline',          label: 'Home',            screen: 'Home',          isTab: true  },
    { icon: 'images-outline',        label: 'Foto e Video',    screen: 'Foto',          isTab: true  },
    { icon: 'grid-outline',          label: 'Griglia Pasti',   screen: 'Griglia',       isTab: true  },
    { icon: 'restaurant-outline',    label: 'Menu Mensa',      screen: 'Dieta',         isTab: true  },
    { icon: 'book-outline',          label: 'Diario di Bordo', screen: 'Diario',        isTab: true  },
    { icon: 'notifications-outline', label: 'Avvisi & Notifiche', screen: 'Notifiche',  isTab: false },
    { icon: 'calendar-outline',      label: 'Prenotazioni',    screen: 'Appuntamenti',  isTab: false },
    { icon: 'document-text-outline', label: 'Modulistica',     screen: 'Modulistica',   isTab: false },
    { icon: 'person-outline',        label: 'Il mio Profilo',  screen: 'Profilo',       isTab: false },
  ],
  teacher: [
    { icon: 'home-outline',      label: 'Home',              screen: 'Home',     isTab: true  },
    { icon: 'clipboard-outline', label: 'Presenze',          screen: 'Presenze', isTab: true  },
    { icon: 'grid-outline',      label: 'Griglia Pasti',     screen: 'Griglia',  isTab: true  },
    { icon: 'book-outline',      label: 'Diario di Bordo',   screen: 'Diario',   isTab: true  },
    { icon: 'camera-outline',    label: 'Carica Media',      screen: 'Media',    isTab: true  },
    { icon: 'notifications-outline', label: 'Avvisi & Notifiche', screen: 'Notifiche', isTab: false },
    { icon: 'person-outline',    label: 'Il mio Profilo',    screen: 'Profilo',  isTab: false },
  ],
  admin: [
    { icon: 'home-outline',           label: 'Home',            screen: 'Home',          isTab: true  },
    { icon: 'clipboard-outline',      label: 'Presenze',        screen: 'Presenze',      isTab: true  },
    { icon: 'people-outline',         label: 'Gestione Utenti', screen: 'Utenti',        isTab: true  },
    { icon: 'book-outline',           label: 'Gestione Classi', screen: 'Classi',        isTab: true  },
    { icon: 'megaphone-outline',      label: 'Avvisi',          screen: 'Avvisi',        isTab: true  },
    { icon: 'calendar-outline',       label: 'Appuntamenti',    screen: 'Appuntamenti',  isTab: false },
    { icon: 'restaurant-outline',     label: 'Menu Mensa',      screen: 'Mensa',         isTab: false },
    { icon: 'document-text-outline',  label: 'Modulistica',     screen: 'Modulistica',   isTab: false },
    { icon: 'person-outline',         label: 'Il mio Profilo',  screen: 'Profilo',       isTab: false },
  ],
};

const ROLE_COLORS: Record<string, string> = { admin: '#4169E1', teacher: '#FF69B4', parent: '#32CD32' };
const ROLE_LABELS: Record<string, string> = { admin: 'Amministratore', teacher: 'Maestra', parent: 'Genitore' };

type Sede = { id: string; name: string; color?: string };

interface Props {
  visible: boolean;
  onClose: () => void;
  navigation: any;
  currentScreen?: string;
}

export default function Sidebar({ visible, onClose, navigation, currentScreen }: Props) {
  const { user, logout, sede, updateSede, isSuperAdmin, childIds, activeChildId, setActiveChildId } = useAuth();
  const slideAnim = useRef(new Animated.Value(SIDEBAR_W)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const [sedi, setSedi] = useState<Sede[]>([]);

  useEffect(() => {
    api.get('/api/sedi')
      .then(r => setSedi(r.data ?? []))
      .catch(() => setSedi([]));   // fail-closed
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SIDEBAR_W, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible && (slideAnim as any)._value >= SIDEBAR_W - 1) return null;

  const role = user?.role || 'parent';
  const color = ROLE_COLORS[role];
  const items = NAV[role] || [];
  const sedeKey = (role === 'admin' ? sede : user?.sede_id) || 'girogirotondo';

  const TAB_CONTAINER: Record<string, string> = {
    admin: 'AdminTabs', teacher: 'TeacherTabs', parent: 'ParentTabs',
  };

  // Navigazione tramite ref globale — funziona da qualsiasi schermata
  const navigate = (screen: string, isTab: boolean) => {
    onClose();
    const role = user?.role || 'parent';
    const tabsName = TAB_CONTAINER[role];
    setTimeout(() => {
      if (isTab) {
        // Per i tab: naviga al container dei tab specificando lo schermo
        navigateToTab(tabsName, screen);
      } else {
        // Per le schermate stack: navigazione globale diretta
        globalNavigate(screen);
      }
    }, 200);
  };

  const handleLogout = () => {
    onClose();
    setTimeout(() => logout(), 200);
  };

  return (
    <View style={s.container} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[s.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>

          {/* Header utente */}
          <View style={[s.userSection, { borderBottomColor: color + '30' }]}>
            <View style={[s.avatar, { backgroundColor: color + '20' }]}>
              <Text style={[s.avatarText, { color }]}>{user?.name?.charAt(0) || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.userName}>{user?.name} {user?.cognome}</Text>
              <View style={[s.roleBadge, { backgroundColor: color + '15' }]}>
                <Text style={[s.roleText, { color }]}>{ROLE_LABELS[role]}</Text>
              </View>
            </View>
            {(LOGOS[sedeKey] ?? tenant.logo) ? (
              <Image source={LOGOS[sedeKey] ?? tenant.logo} style={s.sedeLogo} resizeMode="contain" />
            ) : (
              <View style={[s.sedeLogo, { backgroundColor: tenant.colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{tenant.appName.charAt(0)}</Text>
              </View>
            )}
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Sede switcher — solo superadmin */}
          {role === 'admin' && isSuperAdmin && (
            <View style={s.sedeSection}>
              <Text style={s.sectionLabel}>Sede attiva</Text>
              {sedi.map(sd => {
                const sdColor = sd.color ?? '#4169E1';
                return (
                  <TouchableOpacity key={sd.id} onPress={() => updateSede(sd.id)}
                    style={[s.sedeItem, sede === sd.id && { backgroundColor: sdColor + '12', borderColor: sdColor }]}>
                    {LOGOS[sd.id] ? (
                      <Image source={LOGOS[sd.id]} style={s.sedeItemLogo} resizeMode="contain" />
                    ) : (
                      <View style={[s.sedeItemLogo, { backgroundColor: sd.color ?? '#9CA3AF', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{sd.name.charAt(0)}</Text>
                      </View>
                    )}
                    <Text style={[s.sedeLabel, sede === sd.id && { color: sdColor, fontWeight: '700' }]}>{sd.name}</Text>
                    {sede === sd.id && <Ionicons name="checkmark" size={16} color={sdColor} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Nav items */}
          <View style={s.navSection}>
            {items.map((item, i) => {
              const isActive = currentScreen === item.screen || currentScreen === item.label;
              return (
                <TouchableOpacity key={i} onPress={() => navigate(item.screen, item.isTab)}
                  style={[s.navItem, isActive && { backgroundColor: color + '12' }]}>
                  <View style={[s.navIconBox, isActive && { backgroundColor: color + '20' }]}>
                    <Ionicons name={item.icon as any} size={20} color={isActive ? color : '#9CA3AF'} />
                  </View>
                  <Text style={[s.navLabel, isActive && { color, fontWeight: '700' }]}>{item.label}</Text>
                  {isActive && <View style={[s.activeBar, { backgroundColor: color }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Logout */}
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={s.logoutText}>Esci dall'account</Text>
          </TouchableOpacity>

          <Text style={s.footer}>© 2026 {tenant.appName} — GDPR compliant</Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer:       { position: 'absolute', top: 0, right: 0, bottom: 0, width: SIDEBAR_W, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: -4, height: 0 }, elevation: 20 },
  userSection:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18, paddingTop: 54, borderBottomWidth: 1 },
  avatar:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 18, fontWeight: '800' },
  userName:     { fontSize: 14, fontWeight: '700', color: '#1A202C' },
  roleBadge:    { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, marginTop: 2 },
  roleText:     { fontSize: 10, fontWeight: '700' },
  sedeLogo:     { width: 32, height: 32, borderRadius: 16 },
  closeBtn:     { padding: 6 },
  sedeSection:  { padding: 14, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  sedeItem:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 10, marginBottom: 3, borderWidth: 1, borderColor: 'transparent' },
  sedeItemLogo: { width: 24, height: 24, borderRadius: 12 },
  sedeLabel:    { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
  navSection:   { padding: 10 },
  navItem:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 12, marginBottom: 1, position: 'relative', overflow: 'hidden' },
  navIconBox:   { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  navLabel:     { fontSize: 14, color: '#374151', fontWeight: '500', flex: 1 },
  activeBar:    { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  logoutBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 10, marginTop: 6, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 12 },
  logoutText:   { fontSize: 14, color: '#EF4444', fontWeight: '700' },
  footer:       { fontSize: 10, color: '#D1D5DB', textAlign: 'center', marginTop: 18, paddingHorizontal: 14 },
});
