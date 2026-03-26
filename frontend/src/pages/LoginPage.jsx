import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
      setError(err.response?.data?.detail || 'Errore di accesso');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (preset) => {
    const creds = {
      admin: { email: 'admin@girogirotondo.it', password: 'admin123' },
      teacher: { email: 'giulia@girogirotondo.it', password: 'teacher123' },
      parent: { email: 'paolo@famiglia.it', password: 'parent123' },
    };
    setEmail(creds[preset].email);
    setPassword(creds[preset].password);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #FFFDD0 0%, #FFF8E1 100%)' }}>
      {/* Decorative circles */}
      <div className="absolute top-[-60px] left-[-60px] w-[180px] h-[180px] rounded-full bg-[#4169E1] opacity-10" />
      <div className="absolute bottom-[-40px] right-[-40px] w-[140px] h-[140px] rounded-full bg-[#FF69B4] opacity-10" />
      <div className="absolute top-[30%] right-[-30px] w-[100px] h-[100px] rounded-full bg-[#32CD32] opacity-10" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo / School Name */}
        <div className="text-center mb-8">
          <img
            src="https://customer-assets.emergentagent.com/job_early-learning-hub-14/artifacts/s6dyubjw_logo_girogirotondo-removebg-preview.png"
            alt="Girogirotondo"
            className="w-32 h-32 mx-auto object-contain mb-2"
            data-testid="login-logo"
          />
          <h1 data-testid="school-name" className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: 'Nunito, sans-serif' }}>
            <span style={{ color: '#4169E1' }}>Giro</span>
            <span style={{ color: '#FF69B4' }}>giro</span>
            <span style={{ color: '#32CD32' }}>tondo</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Scuola dell'infanzia
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-6 sm:p-8" data-testid="login-card">
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
              style={{ backgroundColor: '#4169E1' }}
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </Button>
          </form>

          <p className="text-xs text-center text-gray-400 mt-4 leading-relaxed">
            Gli account sono generati dalla direzione.<br />
            Usa le credenziali fornite.
          </p>
        </div>

        {/* Quick Login (Demo) */}
        <div className="mt-6 bg-white/60 backdrop-blur-sm rounded-2xl p-4" data-testid="quick-login-section">
          <p className="text-xs font-semibold text-gray-500 text-center mb-3 uppercase tracking-wider">Accesso rapido demo</p>
          <div className="flex gap-2">
            <button
              data-testid="quick-login-admin"
              onClick={() => quickLogin('admin')}
              className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: '#4169E1', color: 'white' }}
            >
              Admin
            </button>
            <button
              data-testid="quick-login-teacher"
              onClick={() => quickLogin('teacher')}
              className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: '#FF69B4', color: 'white' }}
            >
              Maestra
            </button>
            <button
              data-testid="quick-login-parent"
              onClick={() => quickLogin('parent')}
              className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: '#32CD32', color: 'white' }}
            >
              Genitore
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-center text-gray-400 mt-8 leading-relaxed px-4">
          &copy; 2026 Omnia - Piattaforma Istituzionale Girogirotondo. Conforme alle normative GDPR, tutela dei minori e standard digitali EU.
        </p>
      </div>
    </div>
  );
}
