import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import ParentDashboard    from '../screens/parent/DashboardScreen';
import ParentGallery      from '../screens/parent/GalleryScreen';
import ParentGriglia      from '../screens/parent/GrigliaScreen';
import ParentDieta        from '../screens/parent/DietaScreen';
import ParentDiario       from '../screens/parent/DiarioScreen';
import ParentAvvisi       from '../screens/parent/AvvisiScreen';
import ParentAppuntamenti from '../screens/parent/AppuntamentiScreen';
import ParentProfile      from '../screens/parent/ProfileScreen';
import ParentModulistica  from '../screens/parent/ModulisticaScreen';
import NotificheScreen    from '../screens/shared/NotificheScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const COLORS = { active: '#32CD32', inactive: '#9CA3AF' };

type IName = React.ComponentProps<typeof Ionicons>['name'];
const TABS: { name: string; component: React.ComponentType<any>; icon: IName; iconActive: IName; label: string }[] = [
  { name:'Home',    component:ParentDashboard, icon:'home-outline',       iconActive:'home',        label:'Home'   },
  { name:'Foto',    component:ParentGallery,   icon:'images-outline',     iconActive:'images',      label:'Foto'   },
  { name:'Griglia', component:ParentGriglia,   icon:'grid-outline',       iconActive:'grid',        label:'Griglia'},
  { name:'Dieta',   component:ParentDieta,     icon:'restaurant-outline', iconActive:'restaurant',  label:'Menu'   },
  { name:'Diario',  component:ParentDiario,    icon:'book-outline',       iconActive:'book',        label:'Diario' },
];

function ParentTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: { backgroundColor:'#FFF', borderTopColor:'#F3F4F6', height:60, paddingBottom:8 },
        tabBarLabelStyle: { fontSize:10, fontWeight:'600' },
        tabBarIcon: ({ focused, color }) => {
          const tab = TABS.find(t => t.name === route.name);
          return <Ionicons name={focused ? tab?.iconActive! : tab?.icon!} size={22} color={color}/>;
        },
      })}
    >
      {TABS.map(tab => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component} options={{ tabBarLabel: tab.label }}/>
      ))}
    </Tab.Navigator>
  );
}

export default function ParentNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ParentTabs"    component={ParentTabs}/>
      <Stack.Screen name="Avvisi"        component={ParentAvvisi}/>
      <Stack.Screen name="Appuntamenti"  component={ParentAppuntamenti}/>
      <Stack.Screen name="Profilo"       component={ParentProfile}/>
      <Stack.Screen name="Modulistica"   component={ParentModulistica}/>
      <Stack.Screen name="Notifiche"     component={NotificheScreen}/>
    </Stack.Navigator>
  );
}
