import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Attenzione', 'Inserisci email e password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password.trim());
    } catch {
      Alert.alert('Errore', 'Email o password non corretti.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FFFDD0' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFDD0" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo + Titolo */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 24,
            backgroundColor: '#4169E1', justifyContent: 'center', alignItems: 'center',
            marginBottom: 16, shadowColor: '#4169E1', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
          }}>
            <Text style={{ fontSize: 36 }}>🎪</Text>
          </View>
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#1A202C', letterSpacing: -0.5 }}>
            Girogirotondo
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
            Portale Famiglie & Scuola
          </Text>
        </View>

        {/* Form */}
        <View style={{
          backgroundColor: '#FFF', borderRadius: 20,
          padding: 24, shadowColor: '#000', shadowOpacity: 0.06,
          shadowRadius: 16, elevation: 4,
        }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A202C', marginBottom: 20 }}>
            Accedi al tuo account
          </Text>

          {/* Email */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>
              Email
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
              backgroundColor: '#F9FAFB', paddingHorizontal: 12,
            }}>
              <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, height: 48, fontSize: 15, color: '#1A202C' }}
                placeholder="tua@email.it"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Password */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>
              Password
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
              backgroundColor: '#F9FAFB', paddingHorizontal: 12,
            }}>
              <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, height: 48, fontSize: 15, color: '#1A202C' }}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPwd(v => !v)}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottone login */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#93C5FD' : '#4169E1',
              borderRadius: 14, height: 52,
              justifyContent: 'center', alignItems: 'center',
              shadowColor: '#4169E1', shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>
                Accedi
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 11, marginTop: 24 }}>
          © 2026 Girogirotondo — Portale istituzionale{'\n'}
          Conforme GDPR e normative tutela minori
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
