import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { User, Phone, Mail, Hash, Shield, Pencil, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ParentProfile() {
  const { user, refreshUser } = useAuth();
  const [child, setChild] = useState(null);

  // Modifica email
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  useEffect(() => {
    const primaryChildId = (user?.child_ids && user.child_ids[0]) || user?.child_id;
    if (primaryChildId) {
      api.get(`/students/${primaryChildId}`).then(res => setChild(res.data));
    }
  }, [user]);

  const handleChangeEmail = async () => {
    if (!newEmail.trim() || newEmail === user?.email) return;
    setEmailLoading(true);
    setEmailResult(null);
    try {
      await api.patch(`/users/${user.id}/email`, { email: newEmail.trim().toLowerCase() });
      setEmailResult({ ok: true, msg: 'Email aggiornata! Al prossimo accesso usa la nuova email.' });
      setEditingEmail(false);
      if (refreshUser) refreshUser();
    } catch (err) {
      setEmailResult({ ok: false, msg: err.response?.data?.detail || 'Errore durante il cambio email' });
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <AppLayout title="Profilo" showBack>
      <div className="space-y-4 max-w-lg mx-auto" data-testid="parent-profile-page">

        {/* Info bambino */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: '#F4C2C2' }}>
              {child?.name?.charAt(0) || 'B'}
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{child?.name || 'Caricamento...'}</h2>
              <p className="text-sm text-gray-500">{child?.date_of_birth ? `Nato/a il ${new Date(child.date_of_birth + 'T12:00:00').toLocaleDateString('it-IT')}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Hash className="w-5 h-5" style={{ color: '#A7C7E7' }} />
            <div>
              <p className="text-xs text-gray-500 font-medium">Codice Bambino</p>
              <p className="text-sm font-bold text-gray-900">{child?.child_code || '-'}</p>
            </div>
          </div>
        </div>

        {/* Account Genitore */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <h3 className="text-base font-bold mb-4" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>Account Genitore</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <User className="w-5 h-5" style={{ color: '#A7C7E7' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Nome</p>
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
              </div>
            </div>

            {/* Email con modifica */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl" data-testid="parent-email-display">
              <Mail className="w-5 h-5 flex-shrink-0" style={{ color: '#A7C7E7' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">Email</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.email}</p>
              </div>
              {!editingEmail && (
                <button onClick={() => { setNewEmail(user?.email || ''); setEditingEmail(true); setEmailResult(null); }}
                  className="flex-shrink-0 text-gray-300 hover:text-blue-500 transition-colors" title="Modifica email">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>

            {editingEmail && (
              <div className="space-y-2 px-1">
                <Input type="email" value={newEmail} autoComplete="off"
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="nuova@email.it"
                  className="rounded-xl text-sm"
                  data-testid="new-email-input" />
                <div className="flex gap-2">
                  <Button onClick={handleChangeEmail}
                    disabled={emailLoading || !newEmail.trim() || newEmail === user?.email}
                    className="flex-1 h-9 rounded-xl text-sm font-bold"
                    style={{ backgroundColor: '#A7C7E7' }}>
                    {emailLoading ? 'Salvo...' : 'Salva email'}
                  </Button>
                  <Button variant="outline" onClick={() => { setEditingEmail(false); setEmailResult(null); }}
                    className="flex-1 h-9 rounded-xl text-sm">Annulla</Button>
                </div>
              </div>
            )}

            {emailResult && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${emailResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {emailResult.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {emailResult.msg}
              </div>
            )}
          </div>
        </div>

        {/* Segreteria */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <h3 className="text-base font-bold mb-4" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>Segreteria & Supporto</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#A7C7E715' }}>
              <Mail className="w-5 h-5" style={{ color: '#A7C7E7' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Email Scuola</p>
                <p className="text-sm font-bold" style={{ color: '#5A8BB0' }}>girogirotondo@libero.it</p>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50">
          <Shield className="w-4 h-4" style={{ color: '#32CD32' }} />
          <p className="text-xs text-gray-600">I tuoi dati sono protetti secondo le normative GDPR vigenti.</p>
        </div>
      </div>
    </AppLayout>
  );
}
