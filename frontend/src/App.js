import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { C, tenant } from "@/config/tenant";
import { lazy, Suspense, Component, useEffect } from "react";

// ─── Lazy loading: ogni pagina è un chunk separato ────────────────────────────
// Riduce il bundle iniziale di ~70%. Il browser scarica solo ciò che serve.
const LoginPage           = lazy(() => import("@/pages/LoginPage"));
const ParentDashboard     = lazy(() => import("@/pages/parent/ParentDashboard"));
const ParentProfile       = lazy(() => import("@/pages/parent/ParentProfile"));
const ParentModulistica   = lazy(() => import("@/pages/parent/ParentModulistica"));
const ParentGriglia       = lazy(() => import("@/pages/parent/ParentGriglia"));
const ParentGallery       = lazy(() => import("@/pages/parent/ParentGallery"));
const ParentDiario        = lazy(() => import("@/pages/parent/ParentDiario"));
const ParentAlimentazione = lazy(() => import("@/pages/parent/ParentAlimentazione"));
const TeacherDashboard    = lazy(() => import("@/pages/teacher/TeacherDashboard"));
const TeacherGriglia      = lazy(() => import("@/pages/teacher/TeacherGriglia"));
const TeacherMedia        = lazy(() => import("@/pages/teacher/TeacherMedia"));
const TeacherMensa        = lazy(() => import("@/pages/teacher/TeacherMensa"));
const TeacherProfile      = lazy(() => import("@/pages/teacher/TeacherProfile"));
const AdminDashboard      = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminUsers          = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminClasses        = lazy(() => import("@/pages/admin/AdminClasses"));
const AdminAppointments   = lazy(() => import("@/pages/admin/AdminAppointments"));
const AdminModulistica    = lazy(() => import("@/pages/admin/AdminModulistica"));
const AdminAvvisi         = lazy(() => import("@/pages/admin/AdminAvvisi"));
const AdminMensa          = lazy(() => import("@/pages/admin/AdminMensa"));
const AdminProfile        = lazy(() => import("@/pages/admin/AdminProfile"));
const TeacherAvvisi       = lazy(() => import("@/pages/teacher/TeacherAvvisi"));
const TeacherDiario       = lazy(() => import("@/pages/teacher/TeacherDiario"));
const TeacherPresenze     = lazy(() => import("@/pages/teacher/TeacherPresenze"));
const AdminPresenze       = lazy(() => import("@/pages/admin/AdminPresenze"));
const ParentAvvisi        = lazy(() => import("@/pages/parent/ParentAvvisi"));
const PrivacyPolicy       = lazy(() => import("@/pages/PrivacyPolicy"));
const ResetPasswordPage   = lazy(() => import("@/pages/ResetPasswordPage"));
const ParentNotifiche     = lazy(() => import("@/pages/parent/ParentNotifiche"));
const ParentAppuntamenti  = lazy(() => import("@/pages/parent/ParentAppuntamenti"));
const IscrizioniPage      = lazy(() => import("@/pages/iscrizioni/IscrizioniPage"));
const AdminIscrizioni     = lazy(() => import("@/pages/admin/AdminIscrizioni"));

// ─── Spinner pagina (mostrato durante il lazy load) ───────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-full mx-auto mb-3 animate-pulse"
          style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.accentPink})` }} />
        <p className="text-sm text-gray-400">Caricamento...</p>
      </div>
    </div>
  );
}

// ─── Error Boundary: evita la schermata bianca su errori imprevisti ───────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6"
          style={{ backgroundColor: C.bg }}>
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">🌈</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">
              Ops, qualcosa non va!
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {navigator.onLine
                ? "Si è verificato un errore imprevisto. Riprova tra qualche secondo."
                : "Sei offline. Controlla la connessione e riprova."}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-6 py-2 rounded-full text-white text-sm font-semibold"
              style={{ backgroundColor: C.primary }}
            >
              Ricarica l'app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full mx-auto mb-3 animate-pulse" style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.accentPink})` }} />
          <p className="text-sm text-gray-500">Caricamento...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const redirectMap = { admin: '/admin', teacher: '/teacher', parent: '/parent' };
    return <Navigate to={redirectMap[user.role] || '/login'} replace />;
  }
  return children;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher' : '/parent'} replace /> : <LoginPage />} />

        {/* Parent */}
        <Route path="/parent"               element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
        <Route path="/parent/profile"       element={<ProtectedRoute allowedRoles={['parent']}><ParentProfile /></ProtectedRoute>} />
        <Route path="/parent/modulistica"   element={<ProtectedRoute allowedRoles={['parent']}><ParentModulistica /></ProtectedRoute>} />
        <Route path="/parent/griglia"       element={<ProtectedRoute allowedRoles={['parent']}><ParentGriglia /></ProtectedRoute>} />
        <Route path="/parent/gallery"       element={<ProtectedRoute allowedRoles={['parent']}><ParentGallery /></ProtectedRoute>} />
        <Route path="/parent/diario"        element={<ProtectedRoute allowedRoles={['parent']}><ParentDiario /></ProtectedRoute>} />
        <Route path="/parent/alimentazione" element={<ProtectedRoute allowedRoles={['parent']}><ParentAlimentazione /></ProtectedRoute>} />
        <Route path="/parent/avvisi"        element={<ProtectedRoute allowedRoles={['parent']}><ParentAvvisi /></ProtectedRoute>} />
        <Route path="/parent/notifiche"    element={<ProtectedRoute allowedRoles={['parent']}><ParentNotifiche /></ProtectedRoute>} />
        <Route path="/parent/appuntamenti" element={<ProtectedRoute allowedRoles={['parent']}><ParentAppuntamenti /></ProtectedRoute>} />

        {/* Teacher */}
        <Route path="/teacher"          element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
        <Route path="/teacher/griglia"  element={<ProtectedRoute allowedRoles={['teacher']}><TeacherGriglia /></ProtectedRoute>} />
        <Route path="/teacher/avvisi"   element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAvvisi /></ProtectedRoute>} />
        <Route path="/teacher/media"    element={<ProtectedRoute allowedRoles={['teacher']}><TeacherMedia /></ProtectedRoute>} />
        <Route path="/teacher/mensa"    element={<ProtectedRoute allowedRoles={['teacher']}><TeacherMensa /></ProtectedRoute>} />
        <Route path="/teacher/diario"    element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDiario /></ProtectedRoute>} />
        <Route path="/teacher/presenze" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherPresenze /></ProtectedRoute>} />
        <Route path="/teacher/profile"  element={<ProtectedRoute allowedRoles={['teacher']}><TeacherProfile /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin"                element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users"          element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/classes"        element={<ProtectedRoute allowedRoles={['admin']}><AdminClasses /></ProtectedRoute>} />
        <Route path="/admin/appointments"   element={<ProtectedRoute allowedRoles={['admin']}><AdminAppointments /></ProtectedRoute>} />
        <Route path="/admin/modulistica"    element={<ProtectedRoute allowedRoles={['admin']}><AdminModulistica /></ProtectedRoute>} />
        <Route path="/admin/avvisi"         element={<ProtectedRoute allowedRoles={['admin']}><AdminAvvisi /></ProtectedRoute>} />
        <Route path="/admin/mensa"          element={<ProtectedRoute allowedRoles={['admin']}><AdminMensa /></ProtectedRoute>} />
        <Route path="/admin/profile"    element={<ProtectedRoute allowedRoles={['admin']}><AdminProfile /></ProtectedRoute>} />
        <Route path="/admin/presenze"   element={<ProtectedRoute allowedRoles={['admin']}><AdminPresenze /></ProtectedRoute>} />
        <Route path="/admin/iscrizioni" element={<ProtectedRoute allowedRoles={['admin']}><AdminIscrizioni /></ProtectedRoute>} />

        {/* Pagina pubblica — nessuna autenticazione richiesta */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/iscrizioni" element={<IscrizioniPage />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
function App() {
  // Branding runtime per-tenant: titolo tab, theme-color, favicon, titolo iOS.
  // Funziona sia in dev (craco start) sia in produzione, senza modificare i file statici.
  useEffect(() => {
    document.title = tenant.manifest.title;
    const setMeta = (selector, attr, value) => {
      let el = document.head.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    setMeta('meta[name="theme-color"]', 'content', C.primary);
    setMeta('meta[name="description"]', 'content', tenant.manifest.description);
    setMeta('meta[name="apple-mobile-web-app-title"]', 'content', tenant.manifest.shortName);
    // Favicon + apple-touch-icon
    const setIcon = (selector) => {
      const el = document.head.querySelector(selector);
      if (el && tenant.favicon) el.setAttribute('href', tenant.favicon);
    };
    setIcon('link[rel="icon"]');
    setIcon('link[rel="apple-touch-icon"]');
  }, []);

  return (
    <ErrorBoundary>
      <div className="App">
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </div>
    </ErrorBoundary>
  );
}

export default App;
