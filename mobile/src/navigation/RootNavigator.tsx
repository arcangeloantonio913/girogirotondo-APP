import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import ParentNavigator from './ParentNavigator';
import TeacherNavigator from './TeacherNavigator';
import AdminNavigator from './AdminNavigator';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFDD0' }}>
        <ActivityIndicator size="large" color="#4169E1" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.role === 'parent' ? (
          <Stack.Screen name="Parent" component={ParentNavigator} />
        ) : user.role === 'teacher' ? (
          <Stack.Screen name="Teacher" component={TeacherNavigator} />
        ) : (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
