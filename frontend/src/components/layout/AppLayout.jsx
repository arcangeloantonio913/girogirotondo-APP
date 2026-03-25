import { useAuth } from '@/lib/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Home, User, FileText, Calendar, Camera, Grid3X3, LogOut, Menu, X, Bell, ChevronLeft, Users, BookOpen, Settings } from 'lucide-react';
import { useState } from 'react';

const FOOTER_TEXT = "Realizzata da Omnia. Piattaforma conforme alle normative GDPR per il trattamento dei dati personali e la tutela dei minori.";

function getNavItems(role) {
  if (role === 'parent') {
    return [
      { path: '/parent', icon: Home, label: 'Home' },
      { path: '/parent/modulistica', icon: FileText, label: 'Modulistica' },
      { path: '/parent/profile', icon: User, label: 'Profilo' },
    ];
  }
  if (role === 'teacher') {
    return [
      { path: '/teacher', icon: Home, label: 'Home' },
      { path: '/teacher/griglia', icon: Grid3X3, label: 'Griglia' },
      { path: '/teacher/media', icon: Camera, label: 'Media' },
    ];
  }
  if (role === 'admin') {
    return [
      { path: '/admin', icon: Home, label: 'Home' },
      { path: '/admin/users', icon: Users, label: 'Utenti' },
      { path: '/admin/classes', icon: BookOpen, label: 'Classi' },
      { path: '/admin/appointments', icon: Calendar, label: 'Appuntamenti' },
      { path: '/admin/modulistica', icon: FileText, label: 'Modulistica' },
    ];
  }
  return [];
}

function getRoleColor(role) {
  if (role === 'admin') return '#4169E1';
  if (role === 'teacher') return '#FF69B4';
  return '#32CD32';
}

function getRoleLabel(role) {
  if (role === 'admin') return 'Amministratore';
  if (role === 'teacher') return 'Maestra';
  return 'Genitore';
}

export default function AppLayout({ children, title, showBack }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = getNavItems(user?.role);
  const roleColor = getRoleColor(user?.role);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FFFDD0' }}>
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]" data-testid="app-header">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            {showBack ? (
              <button
                data-testid="back-button"
                onClick={() => navigate(-1)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
            ) : (
              <button
                data-testid="notification-bell"
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors relative"
              >
                <Bell className="w-5 h-5 text-gray-700" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#FF69B4' }} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {title ? (
              <h1 className="text-base font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{title}</h1>
            ) : (
              <h1 className="text-base font-black" style={{ fontFamily: 'Nunito' }}>
                <span style={{ color: '#4169E1' }}>Giro</span>
                <span style={{ color: '#FF69B4' }}>giro</span>
                <span style={{ color: '#32CD32' }}>tondo</span>
              </h1>
            )}
          </div>

          <button
            data-testid="hamburger-menu"
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" data-testid="sidebar-overlay">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: roleColor }}>
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900" style={{ fontFamily: 'Nunito' }}>{user?.name}</p>
                  <p className="text-xs font-medium" style={{ color: roleColor }}>{getRoleLabel(user?.role)}</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 py-3 px-3 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    data-testid={`sidebar-nav-${item.label.toLowerCase()}`}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all text-sm font-medium ${isActive ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    style={isActive ? { backgroundColor: roleColor } : {}}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-gray-100">
              <button
                data-testid="logout-button"
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-red-500 hover:bg-red-50 transition-colors text-sm font-medium"
              >
                <LogOut className="w-5 h-5" />
                <span>Esci</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 px-4 py-5 pb-24 md:pb-8 max-w-5xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] md:hidden" data-testid="bottom-nav">
        <div className="flex items-center justify-around px-2 py-1.5">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`bottom-nav-${item.label.toLowerCase()}`}
                className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-all min-w-[50px]"
              >
                <item.icon
                  className="w-5 h-5 transition-colors"
                  style={{ color: isActive ? roleColor : '#9CA3AF' }}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className="text-[10px] font-semibold transition-colors"
                  style={{ color: isActive ? roleColor : '#9CA3AF' }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* GDPR Footer */}
      <footer className="hidden md:block py-4 px-6 text-center" data-testid="gdpr-footer">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          {FOOTER_TEXT}
        </p>
      </footer>
    </div>
  );
}
