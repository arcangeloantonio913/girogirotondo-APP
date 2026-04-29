import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token)            return setError('Link non valido o scaduto.');
    if (password.length < 6) return setError('La password deve essere di almeno 6 caratteri.');
    if (password !== confirm)  return setError('Le password non corrispondono.');

    setLoading(true);
    setError('');
    try {
      await axios.post(`${BACKEND}/api/auth/reset-password`, { token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Link non valido o scaduto. Richiedi un nuovo link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#FFFDD0' }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: '#EBF0FF' }}>
            <KeyRound className="w-7 h-7" style={{ color: '#4169E1' }} />
          </div>
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>
            Nuova Password
          </h1>
          <p className="text-sm text-gray-500 mt-1">Scegli una nuova password sicura</p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <CheckCircle className="w-14 h-14 mx-auto" style={{ color: '#32CD32' }} />
            <p className="text-base font-bold text-gray-900">Password aggiornata!</p>
            <p className="text-sm text-gray-500">Ora puoi accedere con la nuova password.</p>
            <Button onClick={() => navigate('/login')}
              className="w-full rounded-2xl h-11 font-bold" style={{ backgroundColor: '#4169E1' }}>
              Vai al Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Nuova password</Label>
              <div className="relative mt-1">
                <Input type={showPwd ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="rounded-xl pr-10" placeholder="Minimo 6 caratteri"
                  autoComplete="new-password" required />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Conferma password</Label>
              <Input type="password" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="rounded-xl mt-1" placeholder="Ripeti la password"
                autoComplete="new-password" required />
            </div>
            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}
            <Button type="submit" disabled={loading || !password || !confirm}
              className="w-full rounded-2xl h-11 font-bold" style={{ backgroundColor: '#4169E1' }}>
              {loading ? 'Salvataggio...' : 'Imposta nuova password'}
            </Button>
            <button type="button" onClick={() => navigate('/login')}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-1">
              Torna al login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
