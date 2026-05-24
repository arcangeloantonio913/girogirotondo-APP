import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, ScrollView, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';

const { width: W } = Dimensions.get('window');
const SIDEBAR_W = Math.min(300, W * 0.82);

// ── Nav items per ruolo ──────────────────────────────────────────────────────
const NAV: Record<string, { icon: string; label: string; screen: string; tab?: string }[]> = {
  parent: [
    { icon: 'home-outline',           label: 'Home',           screen: 'Home'         },
    { icon: 'images-outline',         label: 'Foto e Video',   screen: 'Foto'         },
    { icon: 'grid-outline',           label: 'Griglia Pasti',  screen: 'Griglia'      },
    { icon: 'restaurant-outline',     label: 'Menu Mensa',     screen: 'Dieta'        },
    { icon: 'book-outline',           label: 'Diario di Bordo',screen: 'Diario'       },
    { icon: 'megaphone-outline',      label: 'Avvisi',         screen: 'Avvisi'       },
    { icon: 'calendar-outline',       label: 'Prenotazioni',   screen: 'Appuntamenti' },
    { icon: 'document-text-outline',  label: 'Modulistica',    screen: 'Modulistica'  },
    { icon: 'person-outline',         label: 'Il mio Profilo', screen: 'Profilo'      },
  ],
  teacher: [
    { icon: 'home-outline',      label: 'Home',             screen: 'Home'     },
    { icon: 'clipboard-outline', label: 'Registro Presenze',screen: 'Presenze' },
    { icon: 'grid-outline',      label: 'Griglia Pasti',    screen: 'Griglia'  },
    { icon: 'book-outline',      label: 'Diario di Bordo',  screen: 'Diario'   },
    { icon: 'camera-outline',    label: 'Carica Media',     screen: 'Media'    },
    { icon: 'megaphone-outline', label: 'Avvisi',           screen: 'Avvisi'   },
    { icon: 'person-outline',    label: 'Il mio Profilo',   screen: 'Profilo'  },
  ],
  admin: [
    { icon: 'home-outline',           label: 'Home',            screen: 'Home'         },
    { icon: 'clipboard-outline',      label: 'Presenze',        screen: 'Presenze'     },
    { icon: 'people-outline',         label: 'Gestione Utenti', screen: 'Utenti'       },
    { icon: 'book-outline',           label: 'Gestione Classi', screen: 'Classi'       },
    { icon: 'megaphone-outline',      label: 'Avvisi',          screen: 'Avvisi'       },
    { icon: 'calendar-outline',       label: 'Appuntamenti',    screen: 'Appuntamenti' },
    { icon: 'restaurant-outline',     label: 'Menu Mensa',      screen: 'Mensa'        },
    { icon: 'document-text-outline',  label: 'Modulistica',     screen: 'Modulistica'  },
    { icon: 'person-outline',         label: 'Il mio Profilo',  screen: 'Profilo'      },
  ],
};

const ROLE_COLORS: Record<string, string> = {
  admin:   '#4169E1',
  teacher: '#FF69B4',
  parent:  '#32CD32',
};
const ROLE_LABELS: Record<string, string> = {
  admin: 'Amministratore', teacher: 'Maestra', parent: 'Genitore',
};

const SEDI = [
  { id: 'girogirotondo',   label: 'Girogirotondo',   color: '#4169E1' },
  { id: 'il-magico-mondo', label: 'Il Magico Mondo', color: '#FF69B4' },
];

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

  // Non renderizzare nulla se non visibile e animazione completata
  if (!visible && (slideAnim as any)._value >= SIDEBAR_W - 1) return null;

  const role = user?.role || 'parent';
  const color = ROLE_COLORS[role] || '#4169E1';
  const items = NAV[role] || [];

  const navigate = (screen: string) => {
    onClose();
    setTimeout(() => navigation.navigate(screen), 150);
  };

  const handleLogout = () => {
    onClose();
    setTimeout(() => logout(), 200);
  };

  return (
    <View style={s.container} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Overlay */}
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
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
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Sede switcher — solo admin */}
          {role === 'admin' && isSuperAdmin && (
            <View style={s.sedeSection}>
              <Text style={s.sectionLabel}>Sede attiva</Text>
              {SEDI.map(s_ => (
                <TouchableOpacity key={s_.id} onPress={() => updateSede(s_.id)}
                  style={[s.sedeItem, sede === s_.id && { backgroundColor: s_.color + '12', borderColor: s_.color }]}>
                  <View style={[s.sedeDot, { backgroundColor: s_.color }]} />
                  <Text style={[s.sedeLabel, sede === s_.id && { color: s_.color, fontWeight: '700' }]}>{s_.label}</Text>
                  {sede === s_.id && <Ionicons name="checkmark" size={16} color={s_.color} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Child switcher — solo genitore con più figli */}
          {role === 'parent' && childIds.length > 1 && (
            <View style={s.sedeSection}>
              <Text style={s.sectionLabel}>Bambino attivo</Text>
              {childIds.map(cid => (
                <TouchableOpacity key={cid} onPress={() => setActiveChildId(cid)}
                  style={[s.sedeItem, activeChildId === cid && { backgroundColor: '#32CD3212', borderColor: '#32CD32' }]}>
                  <View style={[s.sedeDot, { backgroundColor: '#32CD32' }]} />
                  <Text style={[s.sedeLabel, activeChildId === cid && { color: '#32CD32', fontWeight: '700' }]}>{cid}</Text>
                  {activeChildId === cid && <Ionicons name="checkmark" size={16} color="#32CD32" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Nav items */}
          <View style={s.navSection}>
            {items.map((item, i) => {
              const isActive = currentScreen === item.screen || currentScreen === item.label;
              return (
                <TouchableOpacity key={i} onPress={() => navigate(item.screen)}
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

          {/* Footer */}
          <Text style={s.footer}>© 2026 Girogirotondo — GDPR compliant</Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer:       { position: 'absolute', top: 0, right: 0, bottom: 0, width: SIDEBAR_W, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: -4, height: 0 }, elevation: 20 },

  userSection:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingTop: 56, borderBottomWidth: 1 },
  avatar:       { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 20, fontWeight: '800' },
  userName:     { fontSize: 15, fontWeight: '700', color: '#1A202C' },
  roleBadge:    { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  roleText:     { fontSize: 10, fontWeight: '700' },
  closeBtn:     { padding: 6 },

  sedeSection:  { padding: 16, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  sedeItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4, borderWidth: 1, borderColor: 'transparent' },
  sedeDot:      { width: 8, height: 8, borderRadius: 4 },
  sedeLabel:    { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },

  navSection:   { padding: 12 },
  navItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, marginBottom: 2, position: 'relative', overflow: 'hidden' },
  navIconBox:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navLabel:     { fontSize: 14, color: '#374151', fontWeight: '500', flex: 1 },
  activeBar:    { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },

  logoutBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginTop: 8, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 12 },
  logoutText:   { fontSize: 14, color: '#EF4444', fontWeight: '700' },
  footer:       { fontSize: 10, color: '#D1D5DB', textAlign: 'center', marginTop: 20, paddingHorizontal: 16 },
});
