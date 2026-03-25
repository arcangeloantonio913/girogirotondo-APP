import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Grid3X3, Camera, Users, BookOpen, ChevronRight } from 'lucide-react';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [className, setClassName] = useState('');

  useEffect(() => {
    if (!user?.class_id) return;
    Promise.all([
      api.get(`/students?class_id=${user.class_id}`),
      api.get('/classes'),
    ]).then(([sRes, cRes]) => {
      setStudents(sRes.data);
      const cls = cRes.data.find(c => c.id === user.class_id);
      if (cls) setClassName(cls.name);
    });
  }, [user]);

  const cards = [
    { id: 'griglia', icon: Grid3X3, color: '#FF69B4', bg: '#FFF0F7', title: 'Griglia Giornaliera', subtitle: 'Gestisci le attivita quotidiane', path: '/teacher/griglia' },
    { id: 'media', icon: Camera, color: '#32CD32', bg: '#F0FFF0', title: 'Carica Media', subtitle: 'Aggiungi foto e video', path: '/teacher/media' },
  ];

  return (
    <AppLayout>
      <div data-testid="teacher-dashboard">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 font-medium">Ciao Maestra,</p>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{user?.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ backgroundColor: '#FF69B4' }}>
              Classe {className}
            </span>
            <span className="text-xs font-semibold text-gray-500">
              {students.length} alunni
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6" data-testid="teacher-action-cards">
          {cards.map(card => (
            <button
              key={card.id}
              data-testid={`teacher-card-${card.id}`}
              onClick={() => navigate(card.path)}
              className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5 border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 text-left flex items-center gap-4 active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: card.bg }}>
                <card.icon className="w-6 h-6" style={{ color: card.color }} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>{card.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{card.subtitle}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          ))}
        </div>

        {/* Students List */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden" data-testid="teacher-students-list">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: '#FF69B4' }} />
            <h3 className="text-sm font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>I Miei Alunni</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {students.map((student) => (
              <div key={student.id} data-testid={`student-row-${student.id}`} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#FF69B4' }}>
                  {student.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{student.name}</p>
                  <p className="text-xs text-gray-400">{student.child_code}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
