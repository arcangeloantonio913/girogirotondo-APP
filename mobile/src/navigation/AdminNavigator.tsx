import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import AdminDashboard     from '../screens/admin/DashboardScreen';
import AdminPresenze      from '../screens/admin/PresenzeScreen';
import AdminUsers         from '../screens/admin/UsersScreen';
import AdminClasses       from '../screens/admin/ClassesScreen';
import AdminMensa         from '../screens/admin/MensaScreen';
import AdminAvvisi        from '../screens/admin/AvvisiScreen';
import AdminProfile       from '../screens/admin/ProfileScreen';
import AdminModulistica   from '../screens/admin/ModulisticaScreen';
import AdminAppuntamenti  from '../screens/admin/AppuntamentiScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const COLORS = { active:'#4169E1', inactive:'#9CA3AF' };

type IName = React.ComponentProps<typeof Ionicons>['name'];
const TABS: { name:string; component:React.ComponentType<any>; icon:IName; iconActive:IName; label:string }[] = [
  { name:'Home',     component:AdminDashboard, icon:'home-outline',      iconActive:'home',       label:'Home'    },
  { name:'Presenze', component:AdminPresenze,  icon:'clipboard-outline', iconActive:'clipboard',  label:'Presenze'},
  { name:'Utenti',   component:AdminUsers,     icon:'people-outline',    iconActive:'people',     label:'Utenti'  },
  { name:'Classi',   component:AdminClasses,   icon:'book-outline',      iconActive:'book',       label:'Classi'  },
  { name:'Avvisi',   component:AdminAvvisi,    icon:'megaphone-outline', iconActive:'megaphone',  label:'Avvisi'  },
];

function AdminTabs() {
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
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component} options={{ tabBarLabel:tab.label }}/>
      ))}
    </Tab.Navigator>
  );
}

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown:false }}>
      <Stack.Screen name="AdminTabs"      component={AdminTabs}/>
      <Stack.Screen name="Mensa"          component={AdminMensa}/>
      <Stack.Screen name="Modulistica"    component={AdminModulistica}/>
      <Stack.Screen name="Appuntamenti"   component={AdminAppuntamenti}/>
      <Stack.Screen name="Profilo"        component={AdminProfile}/>
    </Stack.Navigator>
  );
}
