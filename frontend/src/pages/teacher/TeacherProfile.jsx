import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { User, Mail, BookOpen, Hash, Shield, GraduationCap, Users } from 'lucide-react';

export default function TeacherProfile() {
  const { user } = useAuth();
  const [className, setClassName] = useState('');
  const [studentCount, setStudentCount] = useState(0);

  useEffect(() => {
    if (!user?.class_id) return;
    Promise.all([
      api.get('/classes'),
      api.get(`/students?class_id=${user.class_id}`),
    ]).then(([cRes, sRes]) => {
      const cls = cRes.data.find(c => c.id === user.class_id);
      if (cls) setClassName(cls.name);
      setStudentCount(sRes.data.length);
    });
  }, [user]);

  return (
    <AppLayout title="Profilo Maestra" showBack>
      <div className="space-y-4 max-w-lg mx-auto" data-testid="teacher-profile-page">
        {/* Teacher Info Card */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 border border-gray-100">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: '#F4C2C2' }}>
              {user?.name?.charAt(0) || 'M'}
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{user?.name || 'Caricamento...'}</h2>
              <p className="text-sm font-medium" style={{ color: '#E8919A' }}>Maestra</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl" data-testid="teacher-email-display">
              <Mail className="w-5 h-5" style={{ color: '#4169E1' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Email di Accesso</p>
                <p className="text-sm font-bold text-gray-900">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Class Assignment */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 border border-gray-100">
          <h3 className="text-base font-bold mb-4" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
            Assegnazione Classe
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-pink-50 rounded-xl">
              <BookOpen className="w-5 h-5" style={{ color: '#FF69B4' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Classe Assegnata</p>
                <p className="text-sm font-bold" style={{ color: '#FF69B4' }}>Classe {className || '...'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-pink-50 rounded-xl">
              <Users className="w-5 h-5" style={{ color: '#FF69B4' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Numero Alunni</p>
                <p className="text-sm font-bold" style={{ color: '#FF69B4' }}>{studentCount} bambini</p>
              </div>
            </div>
          </div>
        </div>

        {/* School Contact */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 border border-gray-100" data-testid="teacher-support-section">
          <h3 className="text-base font-bold mb-4" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
            Contatti Scuola
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
              <GraduationCap className="w-5 h-5" style={{ color: '#4169E1' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Direzione</p>
                <p className="text-sm font-bold" style={{ color: '#4169E1' }}>+39 02 1234 5678</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
              <Mail className="w-5 h-5" style={{ color: '#4169E1' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Email Segreteria</p>
                <p className="text-sm font-bold" style={{ color: '#4169E1' }}>segreteria@girogirotondo.it</p>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Badge */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50" data-testid="teacher-privacy-badge">
          <Shield className="w-4 h-4" style={{ color: '#32CD32' }} />
          <p className="text-xs text-gray-600">I tuoi dati sono protetti secondo le normative GDPR vigenti.</p>
        </div>
      </div>
    </AppLayout>
  );
}
