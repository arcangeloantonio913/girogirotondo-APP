import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Users, BookOpen, Calendar, FileText, ChevronRight, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ users: 0, classes: 0, students: 0, appointments: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, classesRes, studentsRes, aptsRes] = await Promise.all([
          api.get('/users'),
          api.get('/classes'),
          api.get('/students'),
          api.get('/appointments'),
        ]);
        setStats({
          users: usersRes.data.length,
          classes: classesRes.data.length,
          students: studentsRes.data.length,
          appointments: aptsRes.data.length,
        });
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  const statCards = [
    { label: 'Utenti', value: stats.users, color: '#4169E1', bg: '#EBF0FF', icon: Users },
    { label: 'Classi', value: stats.classes, color: '#FF69B4', bg: '#FFF0F7', icon: BookOpen },
    { label: 'Alunni', value: stats.students, color: '#32CD32', bg: '#F0FFF0', icon: TrendingUp },
    { label: 'Appuntamenti', value: stats.appointments, color: '#F59E0B', bg: '#FFFBEB', icon: Calendar },
  ];

  const navCards = [
    { id: 'users', icon: Users, color: '#4169E1', bg: '#EBF0FF', title: 'Gestione Utenti', subtitle: 'Crea e gestisci account', path: '/admin/users' },
    { id: 'classes', icon: BookOpen, color: '#FF69B4', bg: '#FFF0F7', title: 'Gestione Classi', subtitle: 'Organizza le classi', path: '/admin/classes' },
    { id: 'appointments', icon: Calendar, color: '#F59E0B', bg: '#FFFBEB', title: 'Appuntamenti', subtitle: 'Visualizza prenotazioni', path: '/admin/appointments' },
    { id: 'modulistica', icon: FileText, color: '#32CD32', bg: '#F0FFF0', title: 'Modulistica', subtitle: 'Documenti e prese visione', path: '/admin/modulistica' },
  ];

  return (
    <AppLayout>
      <div data-testid="admin-dashboard">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 font-medium">Pannello di Controllo</p>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
            {user?.name}
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6" data-testid="admin-stats-grid">
          {statCards.map((stat) => (
            <div key={stat.label} data-testid={`stat-card-${stat.label.toLowerCase()}`} className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: stat.bg }}>
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-black" style={{ fontFamily: 'Nunito', color: stat.color }}>{stat.value}</p>
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Navigation Cards */}
        <div className="space-y-3" data-testid="admin-nav-cards">
          {navCards.map((card) => (
            <button
              key={card.id}
              data-testid={`admin-nav-${card.id}`}
              onClick={() => navigate(card.path)}
              className="w-full bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-4 active:scale-[0.99]"
            >
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: card.bg }}>
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>{card.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{card.subtitle}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
