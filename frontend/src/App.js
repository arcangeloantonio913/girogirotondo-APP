import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/AuthContext";

// Pages
import LoginPage from "@/pages/LoginPage";
import ParentDashboard from "@/pages/parent/ParentDashboard";
import ParentProfile from "@/pages/parent/ParentProfile";
import ParentModulistica from "@/pages/parent/ParentModulistica";
import ParentGriglia from "@/pages/parent/ParentGriglia";
import ParentGallery from "@/pages/parent/ParentGallery";
import ParentDiario from "@/pages/parent/ParentDiario";
import ParentAlimentazione from "@/pages/parent/ParentAlimentazione";
import TeacherDashboard from "@/pages/teacher/TeacherDashboard";
import TeacherGriglia from "@/pages/teacher/TeacherGriglia";
import TeacherMedia from "@/pages/teacher/TeacherMedia";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminClasses from "@/pages/admin/AdminClasses";
import AdminAppointments from "@/pages/admin/AdminAppointments";
import AdminModulistica from "@/pages/admin/AdminModulistica";

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

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher' : '/parent'} replace /> : <LoginPage />} />

      {/* Parent Routes */}
      <Route path="/parent" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
      <Route path="/parent/profile" element={<ProtectedRoute allowedRoles={['parent']}><ParentProfile /></ProtectedRoute>} />
      <Route path="/parent/modulistica" element={<ProtectedRoute allowedRoles={['parent']}><ParentModulistica /></ProtectedRoute>} />
      <Route path="/parent/griglia" element={<ProtectedRoute allowedRoles={['parent']}><ParentGriglia /></ProtectedRoute>} />
      <Route path="/parent/gallery" element={<ProtectedRoute allowedRoles={['parent']}><ParentGallery /></ProtectedRoute>} />
      <Route path="/parent/diario" element={<ProtectedRoute allowedRoles={['parent']}><ParentDiario /></ProtectedRoute>} />
      <Route path="/parent/alimentazione" element={<ProtectedRoute allowedRoles={['parent']}><ParentAlimentazione /></ProtectedRoute>} />

      {/* Teacher Routes */}
      <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/griglia" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherGriglia /></ProtectedRoute>} />
      <Route path="/teacher/media" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherMedia /></ProtectedRoute>} />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/classes" element={<ProtectedRoute allowedRoles={['admin']}><AdminClasses /></ProtectedRoute>} />
      <Route path="/admin/appointments" element={<ProtectedRoute allowedRoles={['admin']}><AdminAppointments /></ProtectedRoute>} />
      <Route path="/admin/modulistica" element={<ProtectedRoute allowedRoles={['admin']}><AdminModulistica /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
