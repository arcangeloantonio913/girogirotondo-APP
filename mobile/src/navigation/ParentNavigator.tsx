import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import ParentDashboard  from '../screens/parent/DashboardScreen';
import ParentGallery    from '../screens/parent/GalleryScreen';
import ParentGriglia    from '../screens/parent/GrigliaScreen';
import ParentDieta      from '../screens/parent/DietaScreen';
import ParentDiario     from '../screens/parent/DiarioScreen';

const Tab = createBottomTabNavigator();

const COLORS = { active: '#32CD32', inactive: '#9CA3AF', bg: '#FFFFFF' };

export default function ParentNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: '#F3F4F6',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, any> = {
            Home:   'home',
            Foto:   'images',
            Griglia:'grid',
            Dieta:  'restaurant',
            Diario: 'book',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={size - 2} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"    component={ParentDashboard} />
      <Tab.Screen name="Foto"    component={ParentGallery} />
      <Tab.Screen name="Griglia" component={ParentGriglia} />
      <Tab.Screen name="Dieta"   component={ParentDieta} />
      <Tab.Screen name="Diario"  component={ParentDiario} />
    </Tab.Navigator>
  );
}
