import { useAuth, SEDI } from '@/lib/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Home, User, FileText, Calendar, Camera, Grid3X3, LogOut,
  Menu, X, Bell, ChevronLeft, Users, BookOpen, UtensilsCrossed,
  Megaphone, ChevronDown, Building2,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const SEDE_LOGOS = {
  'girogirotondo':  '/logo-girogirotondo.png',
  'il-magico-mondo': '/logo-magico-mondo.png',
};

const FOOTER_TEXT = "\u00A9 2026 Omnia - Piattaforma Istituzionale Girogirotondo. Conforme alle normative GDPR, tutela dei minori e standard digitali EU.";

function getNavItems(role) {
  if (role === 'parent') {
    return [
      { path: '/parent',              icon: Home,           label: 'Home' },
      { path: '/parent/avvisi',       icon: Megaphone,      label: 'Avvisi' },
      { path: '/parent/modulistica',  icon: FileText,       label: 'Documenti' },
      { path: '/parent/alimentazione',icon: UtensilsCrossed,label: 'Dieta' },
      { path: '/parent/profile',      icon: User,           label: 'Profilo' },
    ];
  }
  if (role === 'teacher') {
    return [
      { path: '/teacher',         icon: Home,           label: 'Home' },
      { path: '/teacher/griglia', icon: Grid3X3,        label: 'Griglia' },
      { path: '/teacher/avvisi',  icon: Megaphone,      label: 'Avvisi' },
      { path: '/teacher/media',   icon: Camera,         label: 'Media' },
      { path: '/teacher/profile', icon: User,           label: 'Profilo' },
    ];
  }
  if (role === 'admin') {
    return [
      { path: '/admin',             icon: Home,           label: 'Home' },
      { path: '/admin/users',       icon: Users,          label: 'Utenti' },
      { path: '/admin/classes',     icon: BookOpen,       label: 'Classi' },
      { path: '/admin/avvisi',      icon: Megaphone,      label: 'Avvisi' },
      { path: '/admin/mensa',       icon: UtensilsCrossed,label: 'Mensa' },
    ];
  }
  return [];
}

function getRoleColor(role) {
  if (role === 'admin')   return '#A7C7E7';
  if (role === 'teacher') return '#F4C2C2';
  return '#98FB98';
}

function getRoleLabel(role) {
  if (role === 'admin')   return 'Amministratore';
  if (role === 'teacher') return 'Maestra';
  return 'Genitore';
}

// ── SedeSwitcher — visibile solo agli admin ──────────────────────────────────
function SedeSwitcher() {
  const { sede, sedeInfo, updateSede, isSuperAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Chiudi il dropdown quando si clicca fuori
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Admin normali (non superadmin) vedono solo la propria sede senza poter cambiare
  const canSwitch = isSuperAdmin || !user?.sede_id;

  return (
    <div ref={ref} className="relative" data-testid="sede-switcher">
      <button
        onClick={() => canSwitch && setOpen(v => !v)}
        data-testid="sede-switcher-button"
        className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all
          ${canSwitch ? 'hover:bg-gray-100 cursor-pointer' : 'cursor-default'}`}
        style={{ color: sedeInfo?.color }}
        title={canSwitch ? 'Cambia sede attiva' : 'Sede fissa: ' + sedeInfo?.label}
      >
        <Building2 className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left truncate">{sedeInfo?.label}</span>
        {canSwitch && (
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && canSwitch && (
        <div
          className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50"
          data-testid="sede-switcher-dropdown"
        >
          {SEDI.map((s) => (
            <button
              key={s.id}
              data-testid={`sede-option-${s.id}`}
              onClick={() => { updateSede(s.id); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-left hover:bg-gray-50 transition-colors"
              style={{ color: s.id === sede ? s.color : '#374151' }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
              {s.id === sede && (
                <span className="ml-auto text-xs font-bold" style={{ color: s.color }}>✓ Attiva</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppLayout({ children, title, showBack }) {
  const { user, logout, sede, sedeInfo } = useAuth();
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
      <header className="sticky top-0 z-40 bg-white shadow-sm" data-testid="app-header">
        <div className="flex items-center justify-between px-4 h-16">
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
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: '#F4C2C2' }}>3</span>
              </button>
            )}
          </div>

          <div className="flex flex-col items-center gap-0">
            {title ? (
              <h1 className="text-base font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{title}</h1>
            ) : (
              <>
                <img
                  src={SEDE_LOGOS[sede] || SEDE_LOGOS['girogirotondo']}
                  alt="Logo sede"
                  className="w-8 h-8 rounded-full object-cover border-2 border-gray-100 shadow-sm"
                  data-testid="header-logo"
                />
                <span
                  data-testid="header-sede-badge"
                  className="text-[9px] font-bold tracking-wide leading-none mt-0.5"
                  style={{ color: sedeInfo?.color || '#4169E1', fontFamily: 'Poppins, sans-serif' }}
                >
                  {sedeInfo?.label}
                </span>
              </>
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

            {/* Sidebar Header */}
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
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate" style={{ fontFamily: 'Nunito' }}>{user?.name}</p>
                  <p className="text-xs font-medium" style={{ color: roleColor }}>{getRoleLabel(user?.role)}</p>
                </div>
              </div>
            </div>

            {/* Sede Switcher — solo per admin */}
            {user?.role === 'admin' && (
              <div className="px-3 py-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">Sede attiva</p>
                <SedeSwitcher />
              </div>
            )}

            {/* Nav Links */}
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

            {/* Logout */}
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
      <main className="flex-1 px-4 py-5 pb-28 md:pb-12 max-w-5xl mx-auto w-full">
        {children}
      </main>

      {/* GDPR Footer */}
      <footer className="py-3 px-6 text-center pb-20 md:pb-4" data-testid="gdpr-footer">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          {FOOTER_TEXT}
        </p>
        <a href="/privacy" className="text-[10px] text-blue-400 underline mt-1 inline-block">
          Informativa Privacy & GDPR
        </a>
      </footer>

      {/* Bottom Nav (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:hidden" data-testid="bottom-nav">
        <div className="flex items-center justify-around px-2 py-1.5 safe-bottom">
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
    </div>
  );
}
