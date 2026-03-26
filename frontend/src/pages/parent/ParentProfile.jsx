import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { User, Phone, Mail, Hash, Shield } from 'lucide-react';

export default function ParentProfile() {
  const { user } = useAuth();
  const [child, setChild] = useState(null);

  useEffect(() => {
    if (user?.child_id) {
      api.get(`/students/${user.child_id}`).then(res => setChild(res.data));
    }
  }, [user]);

  return (
    <AppLayout title="Utente" showBack>
      <div className="space-y-4 max-w-lg mx-auto" data-testid="parent-profile-page">
        {/* Child Info Card */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 border border-gray-100">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: '#F4C2C2' }}>
              {child?.name?.charAt(0) || 'B'}
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{child?.name || 'Caricamento...'}</h2>
              <p className="text-sm text-gray-500">{child?.date_of_birth ? `Nato/a il ${new Date(child.date_of_birth).toLocaleDateString('it-IT')}` : ''}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl" data-testid="child-code-display">
              <Hash className="w-5 h-5" style={{ color: '#A7C7E7' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Codice Bambino</p>
                <p className="text-sm font-bold text-gray-900">{child?.child_code || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Parent Account Info */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 border border-gray-100">
          <h3 className="text-base font-bold mb-4" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
            Account Genitore
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <User className="w-5 h-5" style={{ color: '#A7C7E7' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Nome</p>
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl" data-testid="parent-email-display">
              <Mail className="w-5 h-5" style={{ color: '#A7C7E7' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Email</p>
                <p className="text-sm font-semibold text-gray-900">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Support/Contact */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 border border-gray-100" data-testid="support-contact-section">
          <h3 className="text-base font-bold mb-4" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
            Segreteria & Supporto
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#A7C7E715' }}>
              <Phone className="w-5 h-5" style={{ color: '#A7C7E7' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Telefono Scuola</p>
                <p className="text-sm font-bold" style={{ color: '#5A8BB0' }}>+39 02 1234 5678</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#A7C7E715' }}>
              <Mail className="w-5 h-5" style={{ color: '#A7C7E7' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Email Scuola</p>
                <p className="text-sm font-bold" style={{ color: '#5A8BB0' }}>info@girogirotondo.it</p>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Badge */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50" data-testid="privacy-badge">
          <Shield className="w-4 h-4" style={{ color: '#32CD32' }} />
          <p className="text-xs text-gray-600">I tuoi dati sono protetti secondo le normative GDPR vigenti.</p>
        </div>
      </div>
    </AppLayout>
  );
}
