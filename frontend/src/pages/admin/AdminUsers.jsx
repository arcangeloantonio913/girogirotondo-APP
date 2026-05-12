import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Users, Plus, Trash2, Shield, GraduationCap, Heart, Baby,
  AlertTriangle, Eye, EyeOff, CheckCircle, Mail, RefreshCw,
  Pencil, BookOpen, Key, UserPlus, XCircle,
} from 'lucide-react';
import StudentDetailDialog from '@/components/StudentDetailDialog';

// ── helpers ───────────────────────────────────────────────────────────────────
function getRoleIcon(role) {
  if (role === 'admin')   return Shield;
  if (role === 'teacher') return GraduationCap;
  return Heart;
}
function getRoleColor(role) {
  if (role === 'admin')   return '#4169E1';
  if (role === 'teacher') return '#FF69B4';
  return '#32CD32';
}
function getRoleLabel(role) {
  if (role === 'admin')   return 'Amministratore';
  if (role === 'teacher') return 'Maestra';
  return 'Genitore';
}
function generatePassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Staff: password auto-generata + ruolo default maestra
const makeEmptyStaff = () => ({ name: '', email: '', password: generatePassword(), role: 'teacher', class_ids: [] });
const EMPTY_STAFF = makeEmptyStaff();
const EMPTY_ISCRIZIONE = {
  bambino_nome: '', bambino_cognome: '', bambino_data_nascita: '',
  class_id: '', genitore_email: '', genitore_nome: '', genitore_password: '',
};

export default function AdminUsers() {
  const { sede, sedeInfo } = useAuth();
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);

  // student detail dialog
  const [selectedStudent, setSelectedStudent] = useState(null);

  // dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('staff');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [credDialog, setCredDialog] = useState({ open: false, user: null });

  // form staff
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF);
  const [showStaffPwd, setShowStaffPwd] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');

  // form iscrizione
  const [iscForm, setIscForm] = useState(EMPTY_ISCRIZIONE);
  const [autogenPwd, setAutogenPwd] = useState(true);
  const [showIscPwd, setShowIscPwd] = useState(false);
  const [iscLoading, setIscLoading] = useState(false);
  const [iscError, setIscError] = useState('');
  const [iscSuccess, setIscSuccess] = useState(null);

  // secondo genitore nell'iscrizione
  const [showSecondParent, setShowSecondParent] = useState(false);
  const [isc2Form, setIsc2Form] = useState({ genitore_email: '', genitore_nome: '', genitore_password: generatePassword() });

  // form modifica credenziali
  const [credForm, setCredForm] = useState({ email: '', password: '' });
  const [showCredPwd, setShowCredPwd] = useState(false);
  const [credLoading, setCredLoading] = useState(false);
  const [credError, setCredError] = useState('');

  // secondo genitore
  const [secondoGenitoreDialog, setSecondoGenitoreDialog] = useState({ open: false, student: null });
  const [sgForm, setSgForm] = useState({ genitore_email: '', genitore_nome: '', genitore_password: '' });
  const [sgLoading, setSgLoading] = useState(false);
  const [sgError, setSgError] = useState('');
  const [sgSuccess, setSgSuccess] = useState(null);

  // delete studente
  const [deleteStudentDialog, setDeleteStudentDialog] = useState({ open: false, student: null });
  const [deleteStudentLoading, setDeleteStudentLoading] = useState(false);
  const [credSuccess, setCredSuccess] = useState(false);

  useEffect(() => { loadData(); }, [sede]);

  const loadData = async () => {
    try {
      const [uRes, cRes, sRes] = await Promise.all([
        api.get('/users'),
        api.get('/classes'),
        api.get('/students'),
      ]);
      setUsers(uRes.data);
      setClasses(cRes.data);
      setStudents(sRes.data);
    } catch (err) { console.error(err); }
  };

  // ── apertura dialog staff ────────────────────────────────────────────────
  const openStaffDialog = () => {
    setStaffForm(makeEmptyStaff());   // password già generata, ruolo=teacher
    setStaffError('');
    setShowStaffPwd(true);            // mostra subito la password auto-generata
    setDialogType('staff');
    setDialogOpen(true);
  };

  // ── apertura dialog iscrizione ───────────────────────────────────────────
  const openIscrizioneDialog = () => {
    const pwd = generatePassword();
    setIscForm({ ...EMPTY_ISCRIZIONE, genitore_password: pwd });
    setAutogenPwd(true);
    setIscError('');
    setIscSuccess(null);
    setShowIscPwd(false);
    setShowSecondParent(false);
    setIsc2Form({ genitore_email: '', genitore_nome: '', genitore_password: generatePassword() });
    setDialogType('iscrizione');
    setDialogOpen(true);
  };

  // ── apertura dialog modifica credenziali ──────────────────────────────────
  const openCredDialog = (user) => {
    setCredForm({ email: user.email, password: '' });
    setCredError('');
    setCredSuccess(false);
    setShowCredPwd(false);
    setCredDialog({ open: true, user });
  };

  const toggleClass = (classId) => {
    setStaffForm(prev => ({
      ...prev,
      class_ids: prev.class_ids.includes(classId)
        ? prev.class_ids.filter(id => id !== classId)
        : [...prev.class_ids, classId],
    }));
  };

  // ── submit staff ─────────────────────────────────────────────────────────
  const handleCreateStaff = async () => {
    setStaffLoading(true);
    setStaffError('');
    try {
      const res = await api.post('/users', staffForm);
      setUsers(prev => [...prev, res.data]);
      setDialogOpen(false);
    } catch (err) {
      setStaffError(err.response?.data?.detail || 'Errore durante la creazione');
    } finally { setStaffLoading(false); }
  };

  // ── submit iscrizione ────────────────────────────────────────────────────
  const handleIscrizione = async () => {
    setIscLoading(true);
    setIscError('');
    try {
      const payload = {
        ...iscForm,
        sede_id: sede,
        genitore_password: iscForm.genitore_password || undefined,
      };
      const res = await api.post('/users/iscrizione', payload);
      const studentId = res.data.student?.id;

      // Se il secondo genitore è stato inserito, crealo subito
      let parent2Result = null;
      if (showSecondParent && isc2Form.genitore_email.trim() && studentId) {
        try {
          const r2 = await api.post('/users/secondo-genitore', {
            student_id: studentId,
            genitore_email: isc2Form.genitore_email.trim(),
            genitore_nome: isc2Form.genitore_nome || undefined,
            genitore_password: isc2Form.genitore_password || undefined,
          });
          parent2Result = {
            email: r2.data.parent?.email,
            password: r2.data.new_password,
            email_inviata: r2.data.email_inviata,
          };
        } catch (e2) {
          parent2Result = { error: e2.response?.data?.detail || 'Errore secondo genitore' };
        }
      }

      setIscSuccess({
        genitore_email: res.data.genitore_email,
        bambino_nome: `${iscForm.bambino_nome} ${iscForm.bambino_cognome}`,
        email_inviata: res.data.email_inviata,
        generatedPwd: iscForm.genitore_password,
        parent2: parent2Result,
        parent2Pwd: isc2Form.genitore_password,
      });
      // Aggiorna state immediatamente senza reload
      if (res.data.student) setStudents(prev => [...prev, res.data.student]);
      if (res.data.parent)  setUsers(prev => {
        const exists = prev.find(u => u.id === res.data.parent.id);
        return exists ? prev.map(u => u.id === res.data.parent.id ? res.data.parent : u) : [...prev, res.data.parent];
      });
    } catch (err) {
      setIscError(err.response?.data?.detail || 'Errore durante l\'iscrizione');
    } finally { setIscLoading(false); }
  };

  // ── stato reinvio credenziali ─────────────────────────────────────────────
  const [resendLoading, setResendLoading] = useState(false);
  const [resendResult, setResendResult]   = useState(null); // { email, new_password }

  // ── reinvio bulk a tutte le maestre ──────────────────────────────────────
  const [bulkResendLoading, setBulkResendLoading] = useState(false);
  const [bulkResendResults, setBulkResendResults] = useState(null);

  // ── submit modifica credenziali ──────────────────────────────────────────
  const handleSaveCred = async () => {
    setCredLoading(true);
    setCredError('');
    setCredSuccess(false);
    setResendResult(null);
    try {
      await api.put(`/users/${credDialog.user.id}/credentials`, {
        email: credForm.email !== credDialog.user.email ? credForm.email : undefined,
        password: credForm.password || undefined,
      });
      setCredSuccess(true);
      // Aggiorna email nel pannello senza reload
      if (credForm.email !== credDialog.user.email) {
        setUsers(prev => prev.map(u => u.id === credDialog.user.id ? { ...u, email: credForm.email } : u));
      }
    } catch (err) {
      setCredError(err.response?.data?.detail || 'Errore durante la modifica');
    } finally { setCredLoading(false); }
  };

  // ── reinvia credenziali (genera nuova password + email) ───────────────────
  const handleResendCred = async () => {
    if (!credDialog.user) return;
    setResendLoading(true);
    setCredError('');
    setResendResult(null);
    try {
      // Se c'è una password nel form, usala; altrimenti genera automaticamente
      const res = await api.post(`/users/${credDialog.user.id}/resend-credentials`, {
        password: credForm.password || undefined,
      });
      setResendResult({ email: res.data.email, new_password: res.data.new_password, email_sent: res.data.email_sent });
    } catch (err) {
      setCredError(err.response?.data?.detail || 'Errore durante il reinvio');
    } finally { setResendLoading(false); }
  };

  // ── reinvia credenziali a TUTTE le maestre ───────────────────────────────
  const handleBulkResendTeachers = async () => {
    const teachers = users.filter(u => u.role === 'teacher');
    if (!teachers.length) return;
    setBulkResendLoading(true);
    setBulkResendResults(null);
    const results = [];
    for (const t of teachers) {
      try {
        const res = await api.post(`/users/${t.id}/resend-credentials`, {});
        results.push({
          name: t.name,
          email: res.data.email,
          password: res.data.new_password,
          email_sent: res.data.email_sent,
          ok: true,
        });
      } catch (err) {
        results.push({ name: t.name, email: t.email, ok: false, error: err.response?.data?.detail || 'Errore' });
      }
    }
    setBulkResendResults(results);
    setBulkResendLoading(false);
  };

  // ── elimina utente — immediato senza reload ───────────────────────────────
  const handleDelete = async () => {
    if (!deleteDialog.user) return;
    setDeleteLoading(true);
    try {
      const uid = deleteDialog.user.id;
      await api.delete(`/users/${uid}`);
      setUsers(prev => prev.filter(u => u.id !== uid));
      setDeleteDialog({ open: false, user: null });
    } catch (err) { console.error(err); }
    finally { setDeleteLoading(false); }
  };

  // ── elimina studente — immediato senza reload ─────────────────────────────
  const handleDeleteStudent = async () => {
    if (!deleteStudentDialog.student) return;
    setDeleteStudentLoading(true);
    try {
      const sid = deleteStudentDialog.student.id;
      await api.delete(`/students/${sid}`);
      setStudents(prev => prev.filter(s => s.id !== sid));
      setDeleteStudentDialog({ open: false, student: null });
    } catch (err) { console.error(err); }
    finally { setDeleteStudentLoading(false); }
  };

  // ── apri dialog secondo genitore ──────────────────────────────────────────
  const openSecondoGenitoreDialog = (student) => {
    setSgForm({ genitore_email: '', genitore_nome: '', genitore_password: generatePassword() });
    setSgError('');
    setSgSuccess(null);
    setSecondoGenitoreDialog({ open: true, student });
  };

  // ── submit secondo genitore ───────────────────────────────────────────────
  const handleSecondoGenitore = async () => {
    setSgLoading(true);
    setSgError('');
    try {
      const res = await api.post('/users/secondo-genitore', {
        student_id: secondoGenitoreDialog.student.id,
        genitore_email: sgForm.genitore_email,
        genitore_nome: sgForm.genitore_nome || undefined,
        genitore_password: sgForm.genitore_password || undefined,
      });
      setSgSuccess({
        email: res.data.parent?.email,
        password: res.data.new_password,
        email_inviata: res.data.email_inviata,
        created: res.data.created,
      });
      // Aggiorna lista utenti senza reload
      if (res.data.created) {
        setUsers(prev => [...prev, res.data.parent]);
      } else {
        setUsers(prev => prev.map(u => u.id === res.data.parent?.id ? res.data.parent : u));
      }
    } catch (err) {
      setSgError(err.response?.data?.detail || 'Errore durante l\'aggiunta');
    } finally { setSgLoading(false); }
  };

  // ── Ricerca utenti ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  const matchesSearch = (text) =>
    !searchQuery || text?.toLowerCase().includes(searchQuery.toLowerCase());

  const filterUsers = (list) => list.filter(u =>
    matchesSearch(u.name) || matchesSearch(u.email) || matchesSearch(u.cognome)
  );

  const filterStudents = (list) => list.filter(s => {
    const parent = users.find(u => (u.child_ids || []).includes(s.id) || u.child_id === s.id);
    return matchesSearch(s.name) || matchesSearch(s.cognome) ||
           matchesSearch(parent?.name) || matchesSearch(parent?.email);
  });

  const grouped = {
    admin:   filterUsers(users.filter(u => u.role === 'admin')),
    teacher: filterUsers(users.filter(u => u.role === 'teacher')),
    parent:  filterUsers(users.filter(u => u.role === 'parent')),
  };

  const iscrizioneValid =
    iscForm.bambino_nome.trim() && iscForm.bambino_cognome.trim() &&
    iscForm.class_id && iscForm.genitore_email.trim() &&
    iscForm.genitore_password.length >= 6;

  const getClassName = (classId) => classes.find(c => c.id === classId)?.name || '—';
  const getStudentsForParent = (parentId) =>
    students.filter(s => s.parent_id === parentId || /* legacy */ users.find(u => u.id === parentId)?.child_ids?.includes(s.id));

  return (
    <AppLayout title={`Utenti — ${sedeInfo?.label || ''}`} showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-users-page">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: '#4169E1' }} />
            <span className="text-sm font-bold text-gray-700">{users.length} utenti · {students.length} alunni</span>
          </div>
          <div className="flex gap-2">
            <Button data-testid="add-staff-button" onClick={openStaffDialog}
              variant="outline" className="rounded-2xl font-semibold h-9 text-sm border-2"
              style={{ borderColor: '#FF69B4', color: '#FF69B4' }}>
              <GraduationCap className="w-4 h-4 mr-1" />Aggiungi Staff
            </Button>
            <Button data-testid="add-iscrizione-button" onClick={openIscrizioneDialog}
              className="rounded-2xl font-semibold h-9 text-sm" style={{ backgroundColor: '#4169E1' }}>
              <Baby className="w-4 h-4 mr-1" />Iscrivi Bambino
            </Button>
          </div>
        </div>

        {/* ── Barra di ricerca ─────────────────────────────────────────────── */}
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cerca per nome, cognome o email..."
            className="w-full pl-9 pr-9 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300
                       shadow-sm transition-all"
            autoComplete="off"
            data-testid="users-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-gray-400 -mt-1 px-1">
            {grouped.admin.length + grouped.teacher.length + grouped.parent.length} utenti ·{' '}
            {filterStudents(students).length} alunni trovati per "<strong>{searchQuery}</strong>"
          </p>
        )}

        {/* ── Lista utenti per ruolo ───────────────────────────────────────── */}
        {['admin', 'teacher', 'parent'].map((role) => (
          <div key={role} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden"
            data-testid={`user-group-${role}`}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2"
              style={{ backgroundColor: `${getRoleColor(role)}08` }}>
              {(() => { const Icon = getRoleIcon(role); return <Icon className="w-4 h-4" style={{ color: getRoleColor(role) }} />; })()}
              <span className="text-sm font-bold flex-1" style={{ fontFamily: 'Nunito', color: getRoleColor(role) }}>
                {getRoleLabel(role)} ({grouped[role].length})
              </span>
              {/* Pulsante reinvio bulk — solo per le maestre */}
              {role === 'teacher' && grouped.teacher.length > 0 && (
                <button
                  data-testid="bulk-resend-teachers"
                  onClick={handleBulkResendTeachers}
                  disabled={bulkResendLoading}
                  title="Reinvia credenziali a tutte le maestre"
                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors hover:bg-pink-100"
                  style={{ color: '#FF69B4' }}>
                  <Mail className="w-3 h-3" />
                  {bulkResendLoading ? 'Invio...' : 'Reinvia a tutte'}
                </button>
              )}
            </div>

            {/* Risultati reinvio bulk */}
            {role === 'teacher' && bulkResendResults && (
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-2" data-testid="bulk-resend-results">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Risultati reinvio credenziali</p>
                  <button onClick={() => setBulkResendResults(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                </div>
                {bulkResendResults.map((r, i) => (
                  <div key={i} className={`rounded-xl px-3 py-2 text-xs ${r.ok ? 'bg-white border border-gray-100' : 'bg-red-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-700">{r.name}</span>
                      {r.ok
                        ? (r.email_sent ? <span className="text-green-600 font-bold text-[10px]">📧 inviata</span> : <span className="text-orange-500 font-bold text-[10px]">⚠️ email fallita</span>)
                        : <span className="text-red-500 text-[10px]">🔴 {r.error}</span>
                      }
                    </div>
                    {r.ok && (
                      <div className="mt-1 text-[10px] text-gray-500 space-y-0.5">
                        <p>Email: <span className="font-mono text-gray-700 select-all">{r.email}</span></p>
                        <p>Password: <span className="font-mono font-bold text-blue-700 select-all">{r.password}</span></p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="divide-y divide-gray-50">
              {grouped[role].map((u) => {
                const childrenOfParent = role === 'parent'
                  ? students.filter(s => (u.child_ids || []).includes(s.id) || u.child_id === s.id)
                  : [];
                return (
                  <div key={u.id} data-testid={`user-row-${u.id}`} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: getRoleColor(role) }}>
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        {/* Figli del genitore */}
                        {childrenOfParent.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {childrenOfParent.map(s => (
                              <span key={s.id} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                style={{ backgroundColor: '#EBF0FF', color: '#4169E1' }}>
                                {s.name} · {getClassName(s.class_id)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {/* Modifica credenziali (non per superadmin) */}
                        {!u.is_superadmin && (
                          <button data-testid={`edit-cred-${u.id}`}
                            onClick={() => openCredDialog(u)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                            title="Modifica credenziali">
                            <Key className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button data-testid={`delete-user-${u.id}`}
                          onClick={() => setDeleteDialog({ open: true, user: u })}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {grouped[role].length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-gray-400">Nessun utente</div>
              )}
            </div>
          </div>
        ))}

        {/* ── Sezione Alunni ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden" data-testid="students-group">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: '#4169E108' }}>
            <Baby className="w-4 h-4" style={{ color: '#4169E1' }} />
            <span className="text-sm font-bold" style={{ fontFamily: 'Nunito', color: '#4169E1' }}>
              Alunni ({searchQuery ? filterStudents(students).length : students.length})
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {(searchQuery ? filterStudents(students) : students).map((s) => {
              const cls = classes.find(c => c.id === s.class_id);
              const parent = users.find(u => (u.child_ids || []).includes(s.id) || u.child_id === s.id);
              return (
                <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                  <button data-testid={`student-row-${s.id}`}
                    onClick={() => setSelectedStudent(s)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: '#4169E1' }}>
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.name} {s.cognome || ''}</p>
                      <div className="flex gap-2 mt-0.5 flex-wrap">
                        {cls && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: '#FFF0F7', color: '#FF69B4' }}>
                            <BookOpen className="w-2.5 h-2.5 inline mr-1" />{cls.name}
                          </span>
                        )}
                        {parent && (
                          <span className="text-[10px] text-gray-400 truncate">Genitore: {parent.name}</span>
                        )}
                      </div>
                    </div>
                    <Pencil className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  </button>
                  {/* Azioni studente */}
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      data-testid={`add-parent-${s.id}`}
                      onClick={() => openSecondoGenitoreDialog(s)}
                      title="Aggiungi secondo genitore"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-50 text-gray-300 hover:text-green-500 transition-colors">
                      <UserPlus className="w-4 h-4" />
                    </button>
                    <button
                      data-testid={`delete-student-${s.id}`}
                      onClick={() => setDeleteStudentDialog({ open: true, student: s })}
                      title="Elimina bambino"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {students.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-gray-400">Nessun alunno registrato</div>
            )}
          </div>
        </div>

        {/* ── Dialog Elimina ───────────────────────────────────────────────── */}
        <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, user: null })}>
          <DialogContent className="rounded-2xl max-w-xs mx-auto" data-testid="delete-user-dialog">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito', color: '#EF4444' }}>
                <AlertTriangle className="w-5 h-5" />Elimina Utente
              </DialogTitle>
            </DialogHeader>
            <div className="pt-1 space-y-4">
              <p className="text-sm text-gray-600">
                Elimina <strong>{deleteDialog.user?.name}</strong>?
                <br /><span className="text-xs text-gray-400">{deleteDialog.user?.email}</span>
              </p>
              <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">⚠️ Azione irreversibile.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDeleteDialog({ open: false, user: null })}
                  className="flex-1 rounded-xl h-10 text-sm" data-testid="cancel-delete-user">Annulla</Button>
                <Button onClick={handleDelete} disabled={deleteLoading}
                  className="flex-1 rounded-xl h-10 text-sm font-bold text-white"
                  style={{ backgroundColor: '#EF4444' }} data-testid="confirm-delete-user">
                  {deleteLoading ? 'Eliminazione...' : 'Elimina'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Modifica / Reinvio Credenziali ───────────────────────── */}
        <Dialog open={credDialog.open} onOpenChange={(open) => {
          if (!open) { setCredDialog({ open: false, user: null }); setCredSuccess(false); setResendResult(null); }
        }}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="edit-cred-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito' }}>
                <Key className="w-5 h-5" style={{ color: '#4169E1' }} />
                Credenziali — {credDialog.user?.name}
              </DialogTitle>
            </DialogHeader>

            {/* Risultato reinvio */}
            {resendResult ? (
              <div className="space-y-3 pt-1">
                {resendResult.email_sent !== false ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-green-700 font-semibold">✅ Email inviata con le nuove credenziali!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-xl border border-orange-200">
                    <XCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="text-xs text-orange-700 font-semibold">⚠️ Credenziali aggiornate ma email NON inviata — consegna manualmente le credenziali sotto. Verifica RESEND_API_KEY su Railway.</span>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                  <p><span className="text-gray-400">Email:</span> <strong className="text-gray-800 select-all">{resendResult.email}</strong></p>
                  <p><span className="text-gray-400">Password:</span> <strong className="font-mono text-blue-700 select-all">{resendResult.new_password}</strong></p>
                </div>
                <Button onClick={() => { setCredDialog({ open: false, user: null }); setResendResult(null); }}
                  className="w-full rounded-2xl h-10" style={{ backgroundColor: '#32CD32' }}>Chiudi</Button>
              </div>
            ) : credSuccess ? (
              <div className="py-4 flex flex-col items-center gap-3">
                <CheckCircle className="w-10 h-10" style={{ color: '#32CD32' }} />
                <p className="text-sm font-bold text-gray-900">Credenziali aggiornate!</p>
                <Button onClick={() => { setCredDialog({ open: false, user: null }); setCredSuccess(false); }}
                  className="w-full rounded-2xl h-10" style={{ backgroundColor: '#32CD32' }}>Chiudi</Button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {/* Email attuale — sempre visibile */}
                <div>
                  <Label className="text-xs font-medium text-gray-600">Email account</Label>
                  <Input data-testid="cred-email-input" type="email" autoComplete="off"
                    value={credForm.email}
                    onChange={e => setCredForm({ ...credForm, email: e.target.value })}
                    className="rounded-xl mt-1" />
                </div>

                {/* Password attuale — se disponibile mostrala, altrimenti CTA per impostarne una visibile */}
                {credDialog.user?.admin_password ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                      🔑 Password attuale
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-mono text-sm font-bold text-amber-800 select-all">
                        {credDialog.user.admin_password}
                      </span>
                      <button type="button"
                        onClick={() => setCredForm(f => ({ ...f, password: generatePassword() }))}
                        className="text-amber-400 hover:text-amber-600 flex-shrink-0" title="Genera nuova password">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-1.5">
                      🔒 Password non visibile
                    </p>
                    <p className="text-[11px] text-orange-700 mb-2">
                      L'utente ha impostato questa password autonomamente. Per renderla visibile, imposta una nuova password:
                    </p>
                    <button type="button"
                      onClick={() => {
                        const pwd = generatePassword();
                        setCredForm(f => ({ ...f, password: pwd }));
                        setShowCredPwd(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
                      style={{ backgroundColor: '#FF9500' }}
                      data-testid="generate-visible-password-btn">
                      <RefreshCw className="w-3 h-3" />
                      Genera nuova password visibile
                    </button>
                  </div>
                )}

                {/* Imposta nuova password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-medium text-gray-600">Imposta nuova password</Label>
                    <button type="button"
                      onClick={() => setCredForm(f => ({ ...f, password: generatePassword() }))}
                      className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#4169E1' }}>
                      <RefreshCw className="w-3 h-3" />Auto-genera
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <Input data-testid="cred-password-input"
                      type={showCredPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={credForm.password}
                      onChange={e => setCredForm({ ...credForm, password: e.target.value })}
                      className="rounded-xl pr-10 font-mono"
                      placeholder="Lascia vuoto per non cambiare" />
                    <button type="button" onClick={() => setShowCredPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showCredPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {credError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{credError}</p>}

                {/* Due pulsanti: Salva silenzioso / Salva + Reinvia email */}
                <div className="flex gap-2">
                  <Button data-testid="save-cred-submit" onClick={handleSaveCred}
                    disabled={credLoading || (!credForm.password && credForm.email === credDialog.user?.email)}
                    variant="outline"
                    className="flex-1 rounded-xl h-10 text-sm border-2" style={{ borderColor: '#4169E1', color: '#4169E1' }}>
                    {credLoading ? 'Salvo...' : 'Salva'}
                  </Button>
                  <Button data-testid="resend-cred-submit" onClick={handleResendCred}
                    disabled={resendLoading}
                    className="flex-1 rounded-xl h-10 text-sm font-bold" style={{ backgroundColor: '#32CD32' }}>
                    <Mail className="w-3.5 h-3.5 mr-1.5" />
                    {resendLoading ? 'Invio...' : 'Salva e Invia Email'}
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400 text-center">
                  "Salva e Invia Email" aggiorna le credenziali e le invia all'utente
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Dialog Aggiungi Staff ────────────────────────────────────────── */}
        <Dialog open={dialogOpen && dialogType === 'staff'} onOpenChange={(open) => !open && setDialogOpen(false)}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-staff-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>Aggiungi Staff</DialogTitle>
            </DialogHeader>
            {/* autoComplete="off" previene l'autofill del browser */}
            <form autoComplete="off" onSubmit={e => e.preventDefault()}>
              <div className="space-y-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Nome e Cognome</Label>
                  <Input data-testid="staff-name-input" autoComplete="off"
                    value={staffForm.name}
                    onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                    className="rounded-xl mt-1" placeholder="Nome Cognome" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Email</Label>
                  <Input data-testid="staff-email-input" type="email" autoComplete="off"
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="rounded-xl mt-1" placeholder="email@esempio.it" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-medium text-gray-600">Password</Label>
                    <button type="button"
                      onClick={() => setStaffForm(f => ({ ...f, password: generatePassword() }))}
                      className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#4169E1' }}>
                      <RefreshCw className="w-3 h-3" />Rigenera
                    </button>
                  </div>
                  {/* Mostra password auto-generata — selezionabile per copiare */}
                  <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
                    <span className="flex-1 text-sm font-mono font-bold text-blue-700 select-all">{staffForm.password}</span>
                    <button type="button" onClick={() => setShowStaffPwd(v => !v)}
                      className="text-gray-400">
                      {showStaffPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Ruolo</Label>
                  <Select value={staffForm.role} onValueChange={v => setStaffForm({ ...staffForm, role: v })}>
                    <SelectTrigger className="rounded-xl mt-1" data-testid="staff-role-select">
                      <SelectValue placeholder="Seleziona ruolo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Amministratore</SelectItem>
                      <SelectItem value="teacher">Maestra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {staffForm.role === 'teacher' && (
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Classi Assegnate</Label>
                    <div className="mt-1 flex flex-wrap gap-1.5" data-testid="staff-class-multi-select">
                      {classes.map(c => (
                        <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold border-2 transition-all ${staffForm.class_ids.includes(c.id) ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'}`}
                          style={staffForm.class_ids.includes(c.id) ? { backgroundColor: '#FF69B4', borderColor: '#FF69B4' } : {}}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {staffError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{staffError}</p>}
                <Button data-testid="create-staff-submit" onClick={handleCreateStaff}
                  disabled={staffLoading || !staffForm.name || !staffForm.email || !staffForm.password || !staffForm.role}
                  className="w-full rounded-2xl font-bold h-11" style={{ backgroundColor: '#4169E1' }}>
                  {staffLoading ? 'Creazione...' : 'Crea Account'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Iscrizione Bambino ────────────────────────────────────── */}
        <Dialog open={dialogOpen && dialogType === 'iscrizione'} onOpenChange={(open) => !open && setDialogOpen(false)}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-iscrizione-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito' }}>
                <Baby className="w-5 h-5" style={{ color: '#32CD32' }} />Iscrizione Bambino
              </DialogTitle>
            </DialogHeader>

            {iscSuccess ? (
              <div className="pt-2 space-y-3">
                <div className="flex items-center gap-3 py-2">
                  <CheckCircle className="w-9 h-9 flex-shrink-0" style={{ color: '#32CD32' }} />
                  <div>
                    <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>
                      {iscSuccess.bambino_nome} registrato ✓
                    </p>
                    <p className="text-xs text-gray-400">
                      {iscSuccess.email_inviata ? '📧 Email inviata al 1° genitore' : '📧 Email non inviata — consegna manuale'}
                    </p>
                  </div>
                </div>

                {/* Credenziali 1° genitore */}
                <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">1° Genitore</p>
                  <p><span className="text-gray-400">Email:</span> <strong className="text-gray-800 select-all">{iscSuccess.genitore_email}</strong></p>
                  <p><span className="text-gray-400">Password:</span> <strong className="font-mono text-blue-700 select-all">{iscSuccess.generatedPwd}</strong></p>
                </div>

                {/* Credenziali 2° genitore se creato */}
                {iscSuccess.parent2 && !iscSuccess.parent2.error && (
                  <div className="bg-blue-50 rounded-xl p-3 text-xs space-y-1">
                    <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">
                      2° Genitore {iscSuccess.parent2.email_inviata ? '📧 email inviata' : '📧 consegna manuale'}
                    </p>
                    <p><span className="text-gray-400">Email:</span> <strong className="text-gray-800 select-all">{iscSuccess.parent2.email}</strong></p>
                    {iscSuccess.parent2.password && (
                      <p><span className="text-gray-400">Password:</span> <strong className="font-mono text-blue-700 select-all">{iscSuccess.parent2.password}</strong></p>
                    )}
                  </div>
                )}
                {iscSuccess.parent2?.error && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
                    ⚠️ 2° genitore: {iscSuccess.parent2.error}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button onClick={() => {
                    const lastClassId = iscForm.class_id;
                    const pwd = generatePassword();
                    setIscForm({ ...EMPTY_ISCRIZIONE, genitore_password: pwd, class_id: lastClassId });
                    setIsc2Form({ genitore_email: '', genitore_nome: '', genitore_password: generatePassword() });
                    setShowSecondParent(false);
                    setAutogenPwd(true);
                    setIscSuccess(null);
                  }}
                    className="flex-1 h-10 rounded-xl font-bold text-sm" style={{ backgroundColor: '#4169E1' }}>
                    + Iscrivi un altro
                  </Button>
                  <Button onClick={() => { setDialogOpen(false); setIscSuccess(null); }}
                    variant="outline" className="flex-1 h-10 rounded-xl text-sm">
                    Chiudi
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {/* Nome + Cognome inline */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Nome *</Label>
                    <Input data-testid="bambino-nome-input" autoComplete="off"
                      value={iscForm.bambino_nome}
                      onChange={e => setIscForm({ ...iscForm, bambino_nome: e.target.value })}
                      className="rounded-xl mt-1" placeholder="Nome"
                      onKeyDown={e => e.key === 'Enter' && document.querySelector('[data-testid="bambino-cognome-input"]')?.focus()} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Cognome *</Label>
                    <Input data-testid="bambino-cognome-input" autoComplete="off"
                      value={iscForm.bambino_cognome}
                      onChange={e => setIscForm({ ...iscForm, bambino_cognome: e.target.value })}
                      className="rounded-xl mt-1" placeholder="Cognome" />
                  </div>
                </div>

                {/* Data di nascita + Classe inline */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Data di nascita</Label>
                    <Input data-testid="bambino-dob-input" type="date"
                      value={iscForm.bambino_data_nascita}
                      onChange={e => setIscForm({ ...iscForm, bambino_data_nascita: e.target.value })}
                      className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Classe *</Label>
                    <Select value={iscForm.class_id} onValueChange={v => setIscForm({ ...iscForm, class_id: v })}>
                      <SelectTrigger className="rounded-xl mt-1" data-testid="bambino-class-select">
                        <SelectValue placeholder="Classe" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Nome + Email genitore */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Nome Genitore</Label>
                    <Input data-testid="genitore-nome-input" autoComplete="off"
                      value={iscForm.genitore_nome}
                      onChange={e => setIscForm({ ...iscForm, genitore_nome: e.target.value })}
                      className="rounded-xl mt-1" placeholder="Nome Cognome" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Email Genitore *</Label>
                    <Input data-testid="genitore-email-input" type="email" autoComplete="off"
                      value={iscForm.genitore_email}
                      onChange={e => setIscForm({ ...iscForm, genitore_email: e.target.value })}
                      className="rounded-xl mt-1" placeholder="genitore@email.it" />
                  </div>
                </div>
                {/* Password 1° genitore */}
                <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
                  <span className="text-[10px] text-gray-400 font-medium">PWD:</span>
                  <span className="flex-1 text-sm font-mono font-bold text-blue-700 select-all">{iscForm.genitore_password}</span>
                  <button type="button" onClick={() => setIscForm(f => ({ ...f, genitore_password: generatePassword() }))}
                    className="text-blue-400 hover:text-blue-600 flex-shrink-0" title="Rigenera password">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* ── Sezione 2° Genitore (opzionale) ─────────────────────── */}
                <div className="border-t border-gray-100 pt-2">
                  <button type="button"
                    onClick={() => setShowSecondParent(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors hover:bg-gray-50"
                    style={{ color: showSecondParent ? '#4169E1' : '#9CA3AF' }}
                    data-testid="toggle-second-parent">
                    <span className="flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" />
                      Aggiungi 2° genitore (es. separati/divorziati)
                    </span>
                    <span className="text-lg leading-none">{showSecondParent ? '−' : '+'}</span>
                  </button>

                  {showSecondParent && (
                    <div className="mt-2 space-y-2 bg-blue-50 rounded-xl p-3">
                      <p className="text-[10px] text-blue-500 font-semibold">Secondo account genitore — accesso separato allo stesso bambino</p>
                      <div>
                        <Label className="text-xs font-medium text-gray-600">Email 2° Genitore *</Label>
                        <Input type="email" autoComplete="off" data-testid="genitore2-email-input"
                          value={isc2Form.genitore_email}
                          onChange={e => setIsc2Form(f => ({ ...f, genitore_email: e.target.value }))}
                          className="rounded-xl mt-1" placeholder="genitore2@esempio.it" />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-600">Nome (opzionale)</Label>
                        <Input autoComplete="off" data-testid="genitore2-nome-input"
                          value={isc2Form.genitore_nome}
                          onChange={e => setIsc2Form(f => ({ ...f, genitore_nome: e.target.value }))}
                          className="rounded-xl mt-1" placeholder="Nome Cognome" />
                      </div>
                      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
                        <span className="text-[10px] text-gray-400 font-medium">PWD:</span>
                        <span className="flex-1 text-sm font-mono font-bold text-blue-700 select-all">{isc2Form.genitore_password}</span>
                        <button type="button" onClick={() => setIsc2Form(f => ({ ...f, genitore_password: generatePassword() }))}
                          className="text-blue-400 hover:text-blue-600">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {iscError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{iscError}</p>}
                <Button data-testid="create-iscrizione-submit" onClick={handleIscrizione}
                  disabled={iscLoading || !iscrizioneValid}
                  className="w-full rounded-2xl font-bold h-12 text-base" style={{ backgroundColor: '#32CD32' }}>
                  {iscLoading ? 'Iscrizione...' : '✓ Iscrivi'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>

      {/* Student Detail Dialog */}
      <StudentDetailDialog
        student={selectedStudent}
        classes={classes}
        users={users}
        role="admin"
        onClose={() => setSelectedStudent(null)}
        onSaved={(updated) => {
          setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
          setSelectedStudent(updated);
        }}
        onDeleted={(id) => {
          setStudents(prev => prev.filter(s => s.id !== id));
          setSelectedStudent(null);
        }}
      />

      {/* ── Dialog Elimina Studente ──────────────────────────────────────── */}
      <Dialog open={deleteStudentDialog.open} onOpenChange={(open) => !open && setDeleteStudentDialog({ open: false, student: null })}>
        <DialogContent className="rounded-2xl max-w-xs mx-auto" data-testid="delete-student-dialog">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito', color: '#EF4444' }}>
              <AlertTriangle className="w-5 h-5" />Elimina Bambino
            </DialogTitle>
          </DialogHeader>
          <div className="pt-1 space-y-4">
            <p className="text-sm text-gray-600">
              Elimina <strong>{deleteStudentDialog.student?.name} {deleteStudentDialog.student?.cognome}</strong>?
            </p>
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">⚠️ Azione irreversibile. Il bambino verrà rimosso da tutte le griglie e gallerie.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteStudentDialog({ open: false, student: null })}
                className="flex-1 rounded-xl h-10 text-sm">Annulla</Button>
              <Button onClick={handleDeleteStudent} disabled={deleteStudentLoading}
                className="flex-1 rounded-xl h-10 text-sm font-bold text-white"
                style={{ backgroundColor: '#EF4444' }} data-testid="confirm-delete-student">
                {deleteStudentLoading ? 'Eliminazione...' : 'Elimina'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Secondo Genitore ──────────────────────────────────────── */}
      <Dialog open={secondoGenitoreDialog.open} onOpenChange={(open) => {
        if (!open) { setSecondoGenitoreDialog({ open: false, student: null }); setSgSuccess(null); }
      }}>
        <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="secondo-genitore-dialog">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito', color: '#32CD32' }}>
              <UserPlus className="w-5 h-5" />Aggiungi Secondo Genitore
            </DialogTitle>
          </DialogHeader>
          {sgSuccess ? (
            <div className="pt-2 space-y-3">
              {sgSuccess.email_inviata ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-700 font-semibold">✅ Account creato ed email inviata!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-xl">
                  <XCircle className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-orange-700 font-semibold">Account {sgSuccess.created ? 'creato' : 'aggiornato'} — consegna credenziali manualmente</span>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5">
                <p className="text-gray-500 text-[10px] font-bold uppercase">Credenziali</p>
                <p><span className="text-gray-400">Email:</span> <strong className="text-gray-800 select-all">{sgSuccess.email}</strong></p>
                {sgSuccess.password && (
                  <p><span className="text-gray-400">Password:</span> <strong className="font-mono text-blue-700 select-all">{sgSuccess.password}</strong></p>
                )}
              </div>
              <Button onClick={() => { setSecondoGenitoreDialog({ open: false, student: null }); setSgSuccess(null); }}
                className="w-full rounded-2xl h-10" style={{ backgroundColor: '#32CD32' }}>Chiudi</Button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-gray-500 bg-blue-50 rounded-xl px-3 py-2">
                👨‍👩‍👧 Aggiunge un secondo account genitore per <strong>{secondoGenitoreDialog.student?.name}</strong>. Utile per genitori divorziati con accessi separati.
              </p>
              <div>
                <Label className="text-xs font-medium text-gray-600">Email Genitore *</Label>
                <Input type="email" autoComplete="off" data-testid="sg-email-input"
                  value={sgForm.genitore_email}
                  onChange={e => setSgForm({ ...sgForm, genitore_email: e.target.value })}
                  className="rounded-xl mt-1" placeholder="genitore2@esempio.it" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Nome (opzionale)</Label>
                <Input autoComplete="off" data-testid="sg-nome-input"
                  value={sgForm.genitore_nome}
                  onChange={e => setSgForm({ ...sgForm, genitore_nome: e.target.value })}
                  className="rounded-xl mt-1" placeholder="Nome Cognome" />
              </div>
              <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
                <span className="text-[10px] text-gray-400 font-medium">PWD:</span>
                <span className="flex-1 text-sm font-mono font-bold text-blue-700 select-all">{sgForm.genitore_password}</span>
                <button type="button" onClick={() => setSgForm(f => ({ ...f, genitore_password: generatePassword() }))}
                  className="text-blue-400 hover:text-blue-600"><RefreshCw className="w-4 h-4" /></button>
              </div>
              {sgError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{sgError}</p>}
              <Button onClick={handleSecondoGenitore}
                disabled={sgLoading || !sgForm.genitore_email}
                className="w-full rounded-2xl font-bold h-11" style={{ backgroundColor: '#32CD32' }}
                data-testid="sg-submit">
                {sgLoading ? 'Aggiunta...' : '✓ Aggiungi Genitore'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
