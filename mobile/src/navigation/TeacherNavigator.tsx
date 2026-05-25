import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import TeacherDashboard from '../screens/teacher/DashboardScreen';
import TeacherPresenze  from '../screens/teacher/PresenzeScreen';
import TeacherGriglia   from '../screens/teacher/GrigliaScreen';
import TeacherDiario    from '../screens/teacher/DiarioScreen';
import TeacherMedia     from '../screens/teacher/MediaScreen';
import TeacherAvvisi    from '../screens/teacher/AvvisiScreen';
import TeacherProfile   from '../screens/teacher/ProfileScreen';
import NotificheScreen  from '../screens/shared/NotificheScreen';

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

export default function TeacherNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown:false }}>
      <Stack.Screen name="TeacherTabs" component={TeacherTabs}/>
      <Stack.Screen name="Avvisi"      component={TeacherAvvisi}/>
      <Stack.Screen name="Profilo"     component={TeacherProfile}/>
      <Stack.Screen name="Notifiche"   component={NotificheScreen}/>
    </Stack.Navigator>
  );
}
