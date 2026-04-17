import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Mail, Eye, EyeOff, KeyRound } from 'lucide-react';

const SCHOOLS = [
  { id: 'girogirotondo', name: 'Girogirotondo', logo: '/logo-girogirotondo.png' },
  { id: 'magico-mondo', name: 'Il Magico Mondo', logo: '/logo-magico-mondo.png' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(email, password);
      if (userData.role === 'admin') navigate('/admin');
      else if (userData.role === 'teacher') navigate('/teacher');
      else navigate('/parent');
    } catch (err) {
      setError(err.response?.data?.detail || 'Credenziali non valide. Riprova.');
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
        setResetMessage('Nessun account trovato. Contatta la direzione.');
      } else if (err?.code === 'auth/invalid-email') {
        setResetMessage('Indirizzo email non valido.');
      } else {
        setResetMessage("Errore nell'invio. Contatta la direzione.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #FFFDD0 0%, #FFF8E1 100%)' }}
    >
      {/* Decorative circles */}
      <div className="absolute top-[-60px] left-[-60px] w-[180px] h-[180px] rounded-full bg-[#4169E1] opacity-10 pointer-events-none" />
      <div className="absolute bottom-[-40px] right-[-40px] w-[140px] h-[140px] rounded-full bg-[#FF69B4] opacity-10 pointer-events-none" />
      <div className="absolute top-[30%] right-[-30px] w-[100px] h-[100px] rounded-full bg-[#32CD32] opacity-10 pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">

        {/* School selector + titolo */}
        <div className="text-center mb-8">
          {/* I due loghi affiancati */}
          <div className="flex items-center justify-center gap-5 mb-4" data-testid="school-selector">
            {SCHOOLS.map((school) => {
              const isSelected = selectedSchool === school.id;
              const isOther = selectedSchool && selectedSchool !== school.id;
              return (
                <button
                  key={school.id}
                  data-testid={`school-btn-${school.id}`}
                  onClick={() => setSelectedSchool(school.id)}
                  className="flex flex-col items-center gap-1.5 transition-all duration-200 group focus:outline-none"
                  title={school.name}
                >
                  <div
                    className="rounded-full transition-all duration-200"
                    style={{
                      padding: isSelected ? '3px' : '2px',
                      background: isSelected
                        ? 'linear-gradient(135deg, #A7C7E7, #F4C2C2)'
                        : 'transparent',
                      boxShadow: isSelected
                        ? '0 0 0 2px #A7C7E7, 0 4px 12px rgba(167,199,231,0.5)'
                        : '0 2px 6px rgba(0,0,0,0.08)',
                      opacity: isOther ? 0.45 : 1,
                      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    <img
                      src={school.logo}
                      alt={school.name}
                      className="w-14 h-14 rounded-full object-cover bg-white block"
                    />
                  </div>
                  <span
                    className="text-[10px] font-semibold transition-all duration-200"
                    style={{
                      fontFamily: 'Nunito, sans-serif',
                      color: isSelected ? '#4169E1' : '#9CA3AF',
                      opacity: isOther ? 0.5 : 1,
                    }}
                  >
                    {school.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Titolo */}
          <h1
            data-testid="school-name"
            className="text-3xl sm:text-4xl font-black tracking-tight"
            style={{ fontFamily: 'Nunito, sans-serif' }}
          >
            <span style={{ color: '#A7C7E7' }}>Giro</span>
            <span style={{ color: '#F4C2C2' }}>giro</span>
            <span style={{ color: '#98FB98' }}>tondo</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            La tua scuola a portata di mano
          </p>
        </div>

        {/* Login / Reset Card */}
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8" data-testid="login-card">
          {!showResetForm ? (
            <>
              <h2
                className="text-xl font-bold text-center mb-6"
                style={{ fontFamily: 'Nunito', color: '#1A202C' }}
              >
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
                  style={{ backgroundColor: '#A7C7E7' }}
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
              <h2
                className="text-xl font-bold text-center mb-2"
                style={{ fontFamily: 'Nunito', color: '#1A202C' }}
              >
                Reimposta Password
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
                  style={{ backgroundColor: '#A7C7E7' }}
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
                ← Torna al login
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-[10px] text-center text-gray-400 mt-8 leading-relaxed px-4">
          &copy; 2026 Piattaforma Istituzionale Girogirotondo — Conforme GDPR e normative EU.<br />
          <span className="text-gray-300">Realizzato da Omnia</span>
        </p>
      </div>
    </div>
  );
}
