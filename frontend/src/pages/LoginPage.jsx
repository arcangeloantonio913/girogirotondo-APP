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
  if (err?.message === 'NO_PROFILE') return 'Profilo utente non trovato. Contatta la direzione.';
  if (err?.message === 'INVALID_ROLE') return 'Ruolo non riconosciuto. Contatta la direzione.';
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
        setResetMessage("Errore nell'invio. Riprova più tardi o contatta la direzione.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #FFFDD0 0%, #FFF0F7 50%, #F0FFF0 100%)' }}
    >
      {/* Soft decorative blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full opacity-25 blur-3xl pointer-events-none" style={{ backgroundColor: '#A7C7E7', transform: 'translate(-40%, -40%)' }} />
      <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full opacity-25 blur-3xl pointer-events-none" style={{ backgroundColor: '#F4C2C2', transform: 'translate(30%, 30%)' }} />
      <div className="absolute top-1/2 left-0 w-44 h-44 rounded-full opacity-20 blur-2xl pointer-events-none" style={{ backgroundColor: '#98FB98', transform: 'translate(-50%, -50%)' }} />

      <div className="w-full max-w-sm relative z-10">

        {/* ── Logo + header ── */}
        <div className="flex flex-col items-center mb-7" data-testid="login-logos">

          {/* Active sede logo — small & perfectly round */}
          <div
            className="w-20 h-20 rounded-full overflow-hidden border-4 border-white mb-3"
            style={{ boxShadow: `0 8px 28px ${sedeInfo.color}45` }}
          >
            <img
              src={SEDE_LOGOS[sede] || SEDE_LOGOS['girogirotondo']}
              alt={sedeInfo.label}
              className="w-full h-full object-cover"
              data-testid={`logo-${sede}`}
            />
          </div>

          <h1
            className="text-3xl font-black tracking-tight text-center"
            style={{
              fontFamily: 'Nunito, sans-serif',
              background: 'linear-gradient(90deg, #4169E1 0%, #FF69B4 55%, #32CD32 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
            data-testid="school-name"
          >
            Girogirotondo
          </h1>

          <p className="text-xs text-gray-400 mt-1 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            La tua scuola a portata di mano
          </p>

          {/* Sede switcher — pill buttons with mini logos */}
          <div className="flex gap-2" data-testid="sede-selector">
            {SEDI.map((s) => {
              const isActive = sede === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`sede-btn-${s.id}`}
                  onClick={() => updateSede(s.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border"
                  style={{
                    backgroundColor: isActive ? s.color : 'white',
                    color: isActive ? 'white' : '#9CA3AF',
                    borderColor: isActive ? s.color : '#E5E7EB',
                    boxShadow: isActive ? `0 3px 12px ${s.color}45` : 'none',
                    transform: isActive ? 'scale(1.04)' : 'scale(1)',
                  }}
                >
                  <img
                    src={SEDE_LOGOS[s.id]}
                    alt={s.label}
                    className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                  />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Login / Reset card ── */}
        <div
          className="bg-white rounded-3xl shadow-xl p-7"
          data-testid="login-card"
          style={{ border: '1px solid #F3F4F6' }}
        >
          {!showResetForm ? (
            <>
              <h2 className="text-base font-bold text-center mb-5 text-gray-800" style={{ fontFamily: 'Nunito' }}>
                Accedi al Portale
              </h2>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <Input
                      data-testid="login-email-input"
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@email.it"
                      className="pl-10 rounded-xl border-gray-100 bg-gray-50 focus:bg-white h-11 text-sm transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <Input
                      data-testid="login-password-input"
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10 pr-10 rounded-xl border-gray-100 bg-gray-50 focus:bg-white h-11 text-sm transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                      data-testid="toggle-password-visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    data-testid="login-error"
                    className="text-xs text-red-500 text-center bg-red-50 px-3 py-2.5 rounded-xl border border-red-100"
                  >
                    {error}
                  </div>
                )}

                <Button
                  data-testid="login-submit-button"
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-2xl font-bold text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all mt-1"
                  style={{ background: `linear-gradient(135deg, ${sedeInfo.color} 0%, ${sedeInfo.color}CC 100%)` }}
                >
                  {loading ? 'Accesso in corso...' : 'Accedi →'}
                </Button>
              </form>

              <button
                type="button"
                data-testid="forgot-password-link"
                onClick={() => { setShowResetForm(true); setResetEmail(email); }}
                className="w-full text-[11px] text-center text-gray-400 hover:text-gray-600 mt-4 transition-colors"
              >
                Password dimenticata?
              </button>

              <p className="text-[10px] text-center text-gray-300 mt-3 leading-relaxed">
                Gli account sono generati dalla direzione.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-bold text-center mb-1 text-gray-800" style={{ fontFamily: 'Nunito' }}>
                Reset Password
              </h2>
              <p className="text-[11px] text-center text-gray-400 mb-5">
                Ti invieremo un link per reimpostare la password.
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Email
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <Input
                      data-testid="reset-email-input"
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="nome@email.it"
                      className="pl-10 rounded-xl border-gray-100 bg-gray-50 focus:bg-white h-11 text-sm"
                      required
                    />
                  </div>
                </div>

                {resetMessage && (
                  <div
                    data-testid="reset-message"
                    className={`text-xs text-center px-3 py-2.5 rounded-xl border ${
                      resetMessage.includes('inviata')
                        ? 'text-green-600 bg-green-50 border-green-100'
                        : 'text-red-500 bg-red-50 border-red-100'
                    }`}
                  >
                    {resetMessage}
                  </div>
                )}

                <Button
                  data-testid="reset-submit-button"
                  type="submit"
                  disabled={resetLoading}
                  className="w-full h-11 rounded-2xl font-bold text-white shadow-md"
                  style={{ background: `linear-gradient(135deg, ${sedeInfo.color} 0%, ${sedeInfo.color}CC 100%)` }}
                >
                  {resetLoading ? 'Invio...' : 'Invia Link di Reset'}
                </Button>
              </form>

              <button
                type="button"
                data-testid="back-to-login"
                onClick={() => { setShowResetForm(false); setResetMessage(''); }}
                className="w-full text-[11px] text-center text-gray-400 hover:text-gray-600 mt-4 transition-colors"
              >
                ← Torna al login
              </button>
            </>
          )}
        </div>

        {/* GDPR footer */}
        <p className="text-[10px] text-center text-gray-300 mt-5 leading-relaxed px-4">
          © 2026 Omnia · Piattaforma Girogirotondo · Conforme GDPR e standard digitali EU.
        </p>
      </div>
    </div>
  );
}
