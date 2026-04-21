import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { lazy, Suspense, Component } from "react";

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
const TeacherProfile      = lazy(() => import("@/pages/teacher/TeacherProfile"));
const AdminDashboard      = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminUsers          = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminClasses        = lazy(() => import("@/pages/admin/AdminClasses"));
const AdminAppointments   = lazy(() => import("@/pages/admin/AdminAppointments"));
const AdminModulistica    = lazy(() => import("@/pages/admin/AdminModulistica"));
const AdminAvvisi         = lazy(() => import("@/pages/admin/AdminAvvisi"));
const AdminMensa          = lazy(() => import("@/pages/admin/AdminMensa"));
const TeacherAvvisi       = lazy(() => import("@/pages/teacher/TeacherAvvisi"));
const ParentAvvisi        = lazy(() => import("@/pages/parent/ParentAvvisi"));

// ─── Spinner pagina (mostrato durante il lazy load) ───────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFFDD0' }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-full mx-auto mb-3 animate-pulse"
          style={{ background: 'linear-gradient(135deg, #4169E1, #FF69B4)' }} />
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
          style={{ backgroundColor: '#FFFDD0' }}>
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
              style={{ backgroundColor: '#4169E1' }}
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFFDD0' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full mx-auto mb-3 animate-pulse" style={{ background: 'linear-gradient(135deg, #4169E1, #FF69B4)' }} />
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

        {/* Teacher */}
        <Route path="/teacher"          element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
        <Route path="/teacher/griglia"  element={<ProtectedRoute allowedRoles={['teacher']}><TeacherGriglia /></ProtectedRoute>} />
        <Route path="/teacher/avvisi"   element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAvvisi /></ProtectedRoute>} />
        <Route path="/teacher/media"    element={<ProtectedRoute allowedRoles={['teacher']}><TeacherMedia /></ProtectedRoute>} />
        <Route path="/teacher/profile"  element={<ProtectedRoute allowedRoles={['teacher']}><TeacherProfile /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin"                element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users"          element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/classes"        element={<ProtectedRoute allowedRoles={['admin']}><AdminClasses /></ProtectedRoute>} />
        <Route path="/admin/appointments"   element={<ProtectedRoute allowedRoles={['admin']}><AdminAppointments /></ProtectedRoute>} />
        <Route path="/admin/modulistica"    element={<ProtectedRoute allowedRoles={['admin']}><AdminModulistica /></ProtectedRoute>} />
        <Route path="/admin/avvisi"         element={<ProtectedRoute allowedRoles={['admin']}><AdminAvvisi /></ProtectedRoute>} />
        <Route path="/admin/mensa"          element={<ProtectedRoute allowedRoles={['admin']}><AdminMensa /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
function App() {
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
