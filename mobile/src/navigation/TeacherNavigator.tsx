import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import TeacherDashboard from '../screens/teacher/DashboardScreen';
import TeacherPresenze  from '../screens/teacher/PresenzeScreen';
import TeacherGriglia   from '../screens/teacher/GrigliaScreen';
import TeacherDiario    from '../screens/teacher/DiarioScreen';
import TeacherMedia     from '../screens/teacher/MediaScreen';

const Tab = createBottomTabNavigator();
const COLORS = { active: '#FF69B4', inactive: '#9CA3AF' };

export default function TeacherNavigator() {
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
            Presenze: 'clipboard',
            Griglia:  'grid',
            Diario:   'book',
            Media:    'camera',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={size - 2} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"     component={TeacherDashboard} />
      <Tab.Screen name="Presenze" component={TeacherPresenze} />
      <Tab.Screen name="Griglia"  component={TeacherGriglia} />
      <Tab.Screen name="Diario"   component={TeacherDiario} />
      <Tab.Screen name="Media"    component={TeacherMedia} />
    </Tab.Navigator>
  );
}
