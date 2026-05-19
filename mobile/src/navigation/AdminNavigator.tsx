import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AdminDashboard from '../screens/admin/DashboardScreen';
import AdminUsers     from '../screens/admin/UsersScreen';
import AdminPresenze  from '../screens/admin/PresenzeScreen';
import AdminMensa     from '../screens/admin/MensaScreen';

const Tab = createBottomTabNavigator();
const COLORS = { active: '#4169E1', inactive: '#9CA3AF' };

export default function AdminNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: { backgroundColor: '#FFF', borderTopColor: '#F3F4F6', height: 60, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, any> = {
            Home:     'home',
            Utenti:   'people',
            Presenze: 'clipboard',
            Mensa:    'restaurant',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={size - 2} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"     component={AdminDashboard} />
      <Tab.Screen name="Utenti"   component={AdminUsers} />
      <Tab.Screen name="Presenze" component={AdminPresenze} />
      <Tab.Screen name="Mensa"    component={AdminMensa} />
    </Tab.Navigator>
  );
}
