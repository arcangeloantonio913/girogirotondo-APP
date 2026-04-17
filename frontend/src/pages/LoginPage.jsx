import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { SEDI } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Mail, Eye, EyeOff, KeyRound } from 'lucide-react';

const SEDE_LOGOS = {
  'girogirotondo': '/logo-girogirotondo.png',
  'il-magico-mondo': '/logo-magico-mondo.png',
};

function getLoginErrorMessage(err) {
  const code = err?.code;
  if (code === 'auth/invalid-email') return 'Indirizzo email non valido.';
  if (code === 'auth/user-disabled') return 'Questo account è stato disabilitato.';
  if (code === 'auth/user-not-found') return 'Nessun account trovato con questa email.';
  if (code === 'auth/wrong-password') return 'Password errata.';
  if (code === 'auth/invalid-credential') return 'Email o password non corretti.';
  if (code === 'auth/too-many-requests') return 'Troppi tentativi. Riprova più tardi.';
  if (code === 'auth/network-request-failed') return 'Errore di rete. Controlla la connessione.';
  if (err?.message === 'NO_PROFILE') {
    return 'Profilo utente non trovato. Contatta la direzione.';
  }
  if (err?.message === 'INVALID_ROLE') {
    return 'Ruolo non riconosciuto. Contatta la direzione.';
  }
  return 'Errore di accesso. Riprova.';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { login, sede, updateSede } = useAuth();
  const navigate = useNavigate();

  const sedeInfo = SEDI.find((s) => s.id === sede) || SEDI[1];
  const currentLogo = SEDE_LOGOS[sede] || SEDE_LOGOS['girogirotondo'];

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(email, password);
      if (userData.role === 'admin') navigate('/admin');
      else if (userData.role === 'teacher') navigate('/teacher');
      else if (userData.role === 'parent') navigate('/parent');
      else setError('Ruolo non riconosciuto. Contatta la direzione.');
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    setResetMessage('');
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('Email di reimpostazione inviata! Controlla la tua casella di posta.');
    } catch (err) {
      if (err?.code === 'auth/user-not-found') {
        setResetMessage('Nessun account trovato con questa email. Contatta la direzione.');
      } else if (err?.code === 'auth/invalid-email') {
        setResetMessage('Indirizzo email non valido.');
      } else {
        setResetMessage('Errore nell\'invio. Riprova più tardi o contatta la direzione.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #FFFDD0 0%, #FFF8E1 100%)' }}>
      {/* Decorative circles */}
      <div className="absolute top-[-60px] left-[-60px] w-[180px] h-[180px] rounded-full opacity-10" style={{ backgroundColor: sedeInfo.color }} />
      <div className="absolute bottom-[-40px] right-[-40px] w-[140px] h-[140px] rounded-full bg-[#FF69B4] opacity-10" />
      <div className="absolute top-[30%] right-[-30px] w-[100px] h-[100px] rounded-full bg-[#32CD32] opacity-10" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logos - Both schools side by side, active one highlighted */}
        <div className="flex items-center justify-center gap-4 mb-4" data-testid="login-logos">
          {SEDI.map((s) => {
            const isActive = sede === s.id;
            const logoSrc = SEDE_LOGOS[s.id];
            return (
              <button
                key={s.id}
                type="button"
                data-testid={`logo-${s.id}`}
                onClick={() => updateSede(s.id)}
                className="transition-all duration-300 rounded-2xl p-2"
                style={{
                  opacity: isActive ? 1 : 0.35,
                  transform: isActive ? 'scale(1)' : 'scale(0.8)',
                  filter: isActive ? 'none' : 'grayscale(60%)',
                  boxShadow: isActive ? `0 4px 20px ${s.color}40` : 'none',
                  border: isActive ? `3px solid ${s.color}` : '3px solid transparent',
                  backgroundColor: isActive ? 'white' : 'transparent',
                }}
              >
                <img
                  src={logoSrc}
                  alt={s.label}
                  className="w-28 h-28 object-contain"
                />
              </button>
            );
          })}
        </div>

        {/* School Name */}
        <div className="text-center mb-6">
          <h1 data-testid="school-name" className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: 'Nunito, sans-serif', background: 'linear-gradient(90deg, #A7C7E7 0%, #F4C2C2 50%, #98FB98 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Girogirotondo
          </h1>
          <p
            data-testid="school-branch"
            className="text-base font-semibold mt-1 transition-all duration-300"
            style={{ fontFamily: 'Poppins, sans-serif', color: sedeInfo.color }}
          >
            {sedeInfo.label}
          </p>
          <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            La tua scuola a portata di mano
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8" data-testid="login-card">

          {/* Sede Selector */}
          <div className="mb-5" data-testid="sede-selector">
            <p className="text-xs font-semibold text-gray-400 text-center uppercase tracking-wider mb-2">
              Seleziona la sede
            </p>
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
              {SEDI.map((s) => {
                const isActive = sede === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-testid={`sede-btn-${s.id}`}
                    onClick={() => updateSede(s.id)}
                    className="flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all duration-200"
                    style={{
                      backgroundColor: isActive ? s.color : 'transparent',
                      color: isActive ? 'white' : '#6B7280',
                      boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {!showResetForm ? (
            <>
              <h2 className="text-xl font-bold text-center mb-6" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
                Accedi al Portale
              </h2>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      data-testid="login-email-input"
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@email.it"
                      className="pl-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      data-testid="login-password-input"
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="La tua password"
                      className="pl-10 pr-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white h-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      data-testid="toggle-password-visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div data-testid="login-error" className="text-sm text-red-500 text-center bg-red-50 p-2 rounded-xl">
                    {error}
                  </div>
                )}

                <Button
                  data-testid="login-submit-button"
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-2xl font-bold text-white shadow-sm"
                  style={{ backgroundColor: sedeInfo.color }}
                >
                  {loading ? 'Accesso in corso...' : 'Accedi'}
                </Button>
              </form>

              <button
                type="button"
                data-testid="forgot-password-link"
                onClick={() => { setShowResetForm(true); setResetEmail(email); }}
                className="w-full text-xs text-center text-gray-400 hover:text-gray-600 mt-3 underline underline-offset-2 transition-colors"
              >
                Password dimenticata?
              </button>

              <p className="text-xs text-center text-gray-400 mt-3 leading-relaxed">
                Gli account sono generati dalla direzione.<br />
                Usa le credenziali fornite.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-center mb-2" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
                Reimpostazione Password
              </h2>
              <p className="text-xs text-center text-gray-500 mb-5">
                Inserisci la tua email per ricevere il link di reimpostazione.
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-medium text-gray-700">Email</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      data-testid="reset-email-input"
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="nome@email.it"
                      className="pl-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white h-11"
                      required
                    />
                  </div>
                </div>

                {resetMessage && (
                  <div
                    data-testid="reset-message"
                    className={`text-sm text-center p-2 rounded-xl ${resetMessage.includes('inviata') ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}
                  >
                    {resetMessage}
                  </div>
                )}

                <Button
                  data-testid="reset-submit-button"
                  type="submit"
                  disabled={resetLoading}
                  className="w-full h-11 rounded-2xl font-bold text-white shadow-sm"
                  style={{ backgroundColor: sedeInfo.color }}
                >
                  {resetLoading ? 'Invio in corso...' : 'Invia Link di Reset'}
                </Button>
              </form>

              <button
                type="button"
                data-testid="back-to-login"
                onClick={() => { setShowResetForm(false); setResetMessage(''); }}
                className="w-full text-xs text-center text-gray-400 hover:text-gray-600 mt-3 underline underline-offset-2 transition-colors"
              >
                Torna al login
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-[10px] text-center text-gray-400 mt-8 leading-relaxed px-4">
          &copy; 2026 Omnia - Piattaforma Istituzionale Girogirotondo. Conforme alle normative GDPR, tutela dei minori e standard digitali EU.
        </p>
      </div>
    </div>
  );
}
