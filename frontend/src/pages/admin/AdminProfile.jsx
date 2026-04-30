import { useState } from 'react';
import { useAuth, SEDI } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Shield, Building2, Mail, Key, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function AdminProfile() {
  const { user, sedeInfo } = useAuth();
  const [showPwd, setShowPwd]       = useState(false);
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');

  const handleChangePwd = async () => {
    if (!newPwd || newPwd.length < 6) {
      setError('La password deve essere di almeno 6 caratteri');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('Le password non corrispondono');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.put(`/users/${user?.id}/credentials`, { password: newPwd });
      setSaved(true);
      setNewPwd('');
      setConfirmPwd('');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = user?.is_superadmin ? 'Super Amministratore' : 'Amministratore';
  const initials = (user?.name || 'A').charAt(0).toUpperCase();

  return (
    <AppLayout title="Il mio Profilo" showBack>
      <div className="max-w-lg mx-auto space-y-4" data-testid="admin-profile-page">

        {/* Avatar + info */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: '#A7C7E7' }}>
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
                {user?.name}
              </h2>
              <div className="flex items-center gap-1.5 mt-1">
                <Shield className="w-3.5 h-3.5" style={{ color: '#4169E1' }} />
                <span className="text-xs font-semibold" style={{ color: '#4169E1' }}>{roleLabel}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <Mail className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Email</p>
                <p className="text-sm font-semibold text-gray-900">{user?.email}</p>
              </div>
            </div>

            {user?.is_superadmin ? (
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                <Building2 className="w-5 h-5 flex-shrink-0" style={{ color: '#8B5CF6' }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: '#8B5CF6' }}>Accesso</p>
                  <p className="text-sm font-semibold" style={{ color: '#8B5CF6' }}>
                    Tutte le sedi (Girogirotondo + Il Magico Mondo)
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl"
                style={{ backgroundColor: `${sedeInfo?.color}12` }}>
                <Building2 className="w-5 h-5 flex-shrink-0" style={{ color: sedeInfo?.color }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: sedeInfo?.color }}>Sede</p>
                  <p className="text-sm font-semibold" style={{ color: sedeInfo?.color }}>
                    {sedeInfo?.label}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cambio password */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-4 h-4" style={{ color: '#4169E1' }} />
            <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>
              Cambia Password
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-gray-600">Nuova Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPwd ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  className="rounded-xl pr-10"
                  placeholder="Minimo 6 caratteri"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-gray-600">Conferma Password</Label>
              <Input
                type="password"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Ripeti la password"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}

            {saved && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-700 font-semibold">Password aggiornata!</span>
              </div>
            )}

            <Button
              onClick={handleChangePwd}
              disabled={saving || !newPwd || !confirmPwd}
              className="w-full rounded-2xl h-11 font-bold"
              style={{ backgroundColor: '#4169E1' }}
            >
              {saving ? 'Salvataggio...' : 'Aggiorna Password'}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
