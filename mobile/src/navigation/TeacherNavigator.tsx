import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import TeacherDashboard from '../screens/teacher/DashboardScreen';
import TeacherPresenze  from '../screens/teacher/PresenzeScreen';
import TeacherGriglia   from '../screens/teacher/GrigliaScreen';
import TeacherDiario    from '../screens/teacher/DiarioScreen';
import TeacherMedia     from '../screens/teacher/MediaScreen';
import TeacherMensa     from '../screens/teacher/MensaScreen';
import TeacherAvvisi    from '../screens/teacher/AvvisiScreen';
import TeacherProfile   from '../screens/teacher/ProfileScreen';
import NotificheScreen  from '../screens/shared/NotificheScreen';
import { useAuth } from '../lib/AuthContext';

// Gating: la direzione può disabilitare funzioni alla maestra (funzioni_disabilitate).
// Mappa il tab → chiave-modulo; Home non è mai gateabile.
const TAB_MODULE: Record<string, string> = {
  Presenze: 'presenze', Griglia: 'griglia', Diario: 'diario', Media: 'foto',
};

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const COLORS = { active:'#FF69B4', inactive:'#9CA3AF' };

type IName = React.ComponentProps<typeof Ionicons>['name'];
const TABS: { name:string; component:React.ComponentType<any>; icon:IName; iconActive:IName; label:string }[] = [
  { name:'Home',     component:TeacherDashboard, icon:'home-outline',      iconActive:'home',       label:'Home'    },
  { name:'Presenze', component:TeacherPresenze,  icon:'clipboard-outline', iconActive:'clipboard',  label:'Presenze'},
  { name:'Griglia',  component:TeacherGriglia,   icon:'grid-outline',      iconActive:'grid',       label:'Griglia' },
  { name:'Diario',   component:TeacherDiario,    icon:'book-outline',      iconActive:'book',       label:'Diario'  },
  { name:'Media',    component:TeacherMedia,     icon:'camera-outline',    iconActive:'camera',     label:'Media'   },
];

function TeacherTabs() {
  const { user } = useAuth();
  const disabled: string[] = Array.isArray(user?.funzioni_disabilitate) ? user!.funzioni_disabilitate : [];
  const tabs = TABS.filter(t => { const m = TAB_MODULE[t.name]; return !(m && disabled.includes(m)); });
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
      {tabs.map(tab => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component} options={{ tabBarLabel:tab.label }}/>
      ))}
    </Tab.Navigator>
  );
}

export default function TeacherNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown:false }}>
      <Stack.Screen name="TeacherTabs" component={TeacherTabs}/>
      <Stack.Screen name="Mensa"       component={TeacherMensa}/>
      <Stack.Screen name="Avvisi"      component={TeacherAvvisi}/>
      <Stack.Screen name="Profilo"     component={TeacherProfile}/>
      <Stack.Screen name="Notifiche"   component={NotificheScreen}/>
    </Stack.Navigator>
  );
}
