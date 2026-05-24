import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, StatusBar, KeyboardAvoidingView,
  Platform, StyleSheet, Image,
} from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const C = {
  bg: '#FFFDD0', white: '#FFFFFF', primary: '#4169E1',
  babyBlue: '#A7C7E7', babyPink: '#F4C2C2', babyGreen: '#98FB98',
  text: '#1A202C', muted: '#9CA3AF', gray: '#6B7280',
  red: '#EF4444', redBg: '#FEF2F2', border: '#E5E7EB',
};

const SCHOOLS = [
  {
    id: 'girogirotondo',
    name: 'Girogirotondo',
    logo: require('../../../assets/logo-girogirotondo.png'),
  },
  {
    id: 'il-magico-mondo',
    name: 'Il Magico Mondo',
    logo: require('../../../assets/logo-magico-mondo.png'),
  },
];

export default function LoginScreen() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);

  const [showReset,    setShowReset]    = useState(false);
  const [resetEmail,   setResetEmail]   = useState('');
  const [resetMsg,     setResetMsg]     = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Inserisci email e password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'Credenziali non valide. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setResetMsg('');
    try {
      const axios = (await import('axios')).default;
      await axios.post(
        'https://girogirotondo-app-production.up.railway.app/api/auth/forgot-password',
        { email: resetEmail.trim().toLowerCase() },
        { timeout: 10000 }
      );
    } catch {}
    setResetMsg('✅ Se l\'account esiste riceverai le istruzioni a breve.');
    setResetLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cerchi decorativi */}
        <View style={[s.circle, { top: -40, left: -40, width: 160, height: 160, backgroundColor: C.primary }]} />
        <View style={[s.circle, { bottom: 20, right: -30, width: 120, height: 120, backgroundColor: '#FF69B4' }]} />
        <View style={[s.circle, { top: '35%', right: -20, width: 80, height: 80, backgroundColor: '#32CD32' }]} />

        <View style={s.inner}>
          {/* School Selector con loghi reali */}
          <View style={s.schoolRow}>
            {SCHOOLS.map((school) => {
              const isSelected = selectedSchool === school.id;
              const isOther    = !!selectedSchool && selectedSchool !== school.id;
              return (
                <TouchableOpacity
                  key={school.id}
                  onPress={() => setSelectedSchool(school.id)}
                  activeOpacity={0.8}
                  style={[s.schoolBtn, isOther && { opacity: 0.4 }]}
                >
                  <View style={[
                    s.logoRing,
                    isSelected && {
                      borderColor: C.babyBlue,
                      borderWidth: 3,
                      transform: [{ scale: 1.08 }],
                    },
                  ]}>
                    <Image
                      source={school.logo}
                      style={s.logoImg}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={[s.schoolName, { color: isSelected ? C.primary : C.muted }]}>
                    {school.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Titolo */}
          <View style={s.titleRow}>
            <Text style={s.title}>
              <Text style={{ color: '#4169E1' }}>Giro</Text>
              <Text style={{ color: '#FF69B4' }}>giro</Text>
              <Text style={{ color: '#32CD32' }}>tondo</Text>
            </Text>
            <Text style={s.subtitle}>La tua scuola a portata di mano</Text>
          </View>

          {/* Card login / reset */}
          <View style={s.card}>
            {!showReset ? (
              <>
                <Text style={s.cardTitle}>Accedi al Portale</Text>

                {/* Email */}
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Email</Text>
                  <View style={s.inputRow}>
                    <Ionicons name="mail-outline" size={18} color={C.muted} style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      value={email}
                      onChangeText={(t) => { setEmail(t); setError(''); }}
                      placeholder="nome@email.it"
                      placeholderTextColor={C.muted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Password</Text>
                  <View style={s.inputRow}>
                    <Ionicons name="lock-closed-outline" size={18} color={C.muted} style={s.inputIcon} />
                    <TextInput
                      style={[s.input, { flex: 1, paddingRight: 40 }]}
                      value={password}
                      onChangeText={(t) => { setPassword(t); setError(''); }}
                      placeholder="La tua password"
                      placeholderTextColor={C.muted}
                      secureTextEntry={!showPwd}
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                    />
                    <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={s.eyeBtn}>
                      <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {!!error && (
                  <View style={s.errorBox}>
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    s.loginBtn,
                    // Azzurro acceso se entrambi i campi sono compilati, spento altrimenti
                    email.trim() && password.trim()
                      ? s.loginBtnActive
                      : s.loginBtnDisabled,
                    loading && { opacity: 0.6 },
                  ]}
                  onPress={handleLogin}
                  disabled={loading || (!email.trim() || !password.trim())}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={C.white} size="small" />
                    : <Text style={s.loginBtnText}>Accedi</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setShowReset(true); setResetEmail(email); }}>
                  <Text style={s.link}>Password dimenticata?</Text>
                </TouchableOpacity>

                <Text style={s.hint}>
                  Gli account sono generati dalla direzione.{'\n'}Usa le credenziali fornite.
                </Text>
              </>
            ) : (
              <>
                <Text style={s.cardTitle}>Reimposta Password</Text>
                <Text style={[s.hint, { marginBottom: 16, textAlign: 'center' }]}>
                  Inserisci la tua email per ricevere il link di reimpostazione.
                </Text>
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Email</Text>
                  <View style={s.inputRow}>
                    <Ionicons name="key-outline" size={18} color={C.muted} style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      placeholder="nome@email.it"
                      placeholderTextColor={C.muted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
                {!!resetMsg && (
                  <View style={[s.errorBox, { backgroundColor: '#F0FFF4', borderColor: '#86EFAC' }]}>
                    <Text style={{ color: '#166534', fontSize: 13, textAlign: 'center' }}>{resetMsg}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[s.loginBtn, resetLoading && { opacity: 0.7 }]}
                  onPress={handleReset}
                  disabled={resetLoading}
                >
                  {resetLoading
                    ? <ActivityIndicator color={C.white} size="small" />
                    : <Text style={s.loginBtnText}>Invia Link di Reset</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowReset(false); setResetMsg(''); }}>
                  <Text style={s.link}>← Torna al login</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Footer */}
          <Text style={s.footer}>
            © 2026 Piattaforma Istituzionale Girogirotondo — Conforme GDPR e normative EU.{'\n'}
            Realizzato da Omnia
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: 20, paddingTop: 50 },
  circle: { position: 'absolute', borderRadius: 999, opacity: 0.12 },
  inner:  { alignItems: 'center', paddingBottom: 30 },

  // School selector
  schoolRow:    { flexDirection: 'row', gap: 28, marginBottom: 20 },
  schoolBtn:    { alignItems: 'center', gap: 7 },
  logoRing:     { borderRadius: 999, padding: 3, borderWidth: 2, borderColor: 'transparent', backgroundColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  logoImg:      { width: 68, height: 68, borderRadius: 34, backgroundColor: '#F3F4F6' },
  schoolName:   { fontSize: 10, fontWeight: '700', textAlign: 'center', maxWidth: 80 },

  // Title
  titleRow: { alignItems: 'center', marginBottom: 24 },
  title:    { fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 4 },

  // Card
  card:     { width: '100%', backgroundColor: C.white, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  cardTitle:{ fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 20 },

  // Form
  fieldGroup: { marginBottom: 14 },
  label:      { fontSize: 13, fontWeight: '600', color: C.gray, marginBottom: 6 },
  inputRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 48 },
  inputIcon:  { marginRight: 8 },
  input:      { flex: 1, fontSize: 14, color: C.text, height: 46 },
  eyeBtn:     { position: 'absolute', right: 12, top: 15 },

  // Error
  errorBox:  { backgroundColor: C.redBg, borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: C.red, fontSize: 13, textAlign: 'center' },

  // Button
  loginBtn:         { borderRadius: 16, height: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  loginBtnActive:   { backgroundColor: '#4169E1', shadowColor: '#4169E1', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  loginBtnDisabled: { backgroundColor: '#C8D8F5' },
  loginBtnText:     { color: C.white, fontSize: 16, fontWeight: '800' },

  link:   { fontSize: 12, color: C.muted, textAlign: 'center', textDecorationLine: 'underline', marginBottom: 10 },
  hint:   { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 16 },
  footer: { fontSize: 12, color: '#374151', textAlign: 'center', marginTop: 20, lineHeight: 18 },
});
