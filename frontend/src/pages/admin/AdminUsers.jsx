import { useState, useEffect } from 'react';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Users, Plus, Trash2, Shield, GraduationCap, Heart,
  AlertTriangle, Baby, Eye, EyeOff, CheckCircle, Mail, RefreshCw,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
function getRoleIcon(role) {
  if (role === 'admin') return Shield;
  if (role === 'teacher') return GraduationCap;
  return Heart;
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
function generatePassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── stato iniziale form ───────────────────────────────────────────────────────
const EMPTY_STAFF = { name: '', email: '', password: '', role: '', class_ids: [] };
const EMPTY_ISCRIZIONE = {
  bambino_nome: '',
  bambino_cognome: '',
  bambino_data_nascita: '',
  class_id: '',
  genitore_email: '',
  genitore_nome: '',
  genitore_password: '',
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('staff'); // 'staff' | 'iscrizione'
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form staff (admin / maestra)
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF);
  const [showStaffPwd, setShowStaffPwd] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');

  // Form iscrizione bambino + genitore
  const [iscForm, setIscForm] = useState(EMPTY_ISCRIZIONE);
  const [autogenPwd, setAutogenPwd] = useState(true);
  const [showIscPwd, setShowIscPwd] = useState(false);
  const [iscLoading, setIscLoading] = useState(false);
  const [iscError, setIscError] = useState('');
  const [iscSuccess, setIscSuccess] = useState(null); // { genitore_email, bambino_nome }

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [uRes, cRes] = await Promise.all([api.get('/users'), api.get('/classes')]);
    setUsers(uRes.data);
    setClasses(cRes.data);
  };

  // ── apertura dialog ─────────────────────────────────────────────────────────
  const openStaffDialog = () => {
    setStaffForm(EMPTY_STAFF);
    setStaffError('');
    setShowStaffPwd(false);
    setDialogType('staff');
    setDialogOpen(true);
  };
  const openIscrizioneDialog = () => {
    const pwd = generatePassword();
    setIscForm({ ...EMPTY_ISCRIZIONE, genitore_password: pwd });
    setAutogenPwd(true);
    setIscError('');
    setIscSuccess(null);
    setShowIscPwd(false);
    setDialogType('iscrizione');
    setDialogOpen(true);
  };

  // ── toggle classe per maestra ───────────────────────────────────────────────
  const toggleClass = (classId) => {
    setStaffForm(prev => ({
      ...prev,
      class_ids: prev.class_ids.includes(classId)
        ? prev.class_ids.filter(id => id !== classId)
        : [...prev.class_ids, classId],
    }));
  };

  // ── submit staff (admin / maestra) ──────────────────────────────────────────
  const handleCreateStaff = async () => {
    setStaffLoading(true);
    setStaffError('');
    try {
      await api.post('/users', staffForm);
      setDialogOpen(false);
      loadData();
    } catch (err) {
      setStaffError(err.response?.data?.detail || 'Errore durante la creazione');
    } finally {
      setStaffLoading(false);
    }
  };

  // ── submit iscrizione bambino + genitore ────────────────────────────────────
  const handleIscrizione = async () => {
    setIscLoading(true);
    setIscError('');
    try {
      const payload = {
        ...iscForm,
        genitore_password: autogenPwd ? undefined : iscForm.genitore_password,
      };
      const res = await api.post('/users/iscrizione', payload);
      setIscSuccess({
        genitore_email: res.data.genitore_email,
        bambino_nome: `${iscForm.bambino_nome} ${iscForm.bambino_cognome}`,
        email_inviata: res.data.email_inviata,
      });
      loadData();
    } catch (err) {
      setIscError(err.response?.data?.detail || 'Errore durante l\'iscrizione');
    } finally {
      setIscLoading(false);
    }
  };

  // ── elimina utente ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteDialog.user) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/users/${deleteDialog.user.id}`);
      setDeleteDialog({ open: false, user: null });
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const grouped = {
    admin: users.filter(u => u.role === 'admin'),
    teacher: users.filter(u => u.role === 'teacher'),
    parent: users.filter(u => u.role === 'parent'),
  };

  const iscrizioneValid =
    iscForm.bambino_nome &&
    iscForm.bambino_cognome &&
    iscForm.class_id &&
    iscForm.genitore_email &&
    (autogenPwd || iscForm.genitore_password.length >= 6);

  return (
    <AppLayout title="Gestione Utenti" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-users-page">

        {/* Header con due pulsanti */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: '#4169E1' }} />
            <span className="text-sm font-bold text-gray-700">{users.length} utenti totali</span>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid="add-staff-button"
              onClick={openStaffDialog}
              variant="outline"
              className="rounded-2xl font-semibold h-9 text-sm border-2"
              style={{ borderColor: '#FF69B4', color: '#FF69B4' }}
            >
              <GraduationCap className="w-4 h-4 mr-1" />
              Aggiungi Staff
            </Button>
            <Button
              data-testid="add-iscrizione-button"
              onClick={openIscrizioneDialog}
              className="rounded-2xl font-semibold h-9 text-sm"
              style={{ backgroundColor: '#4169E1' }}
            >
              <Baby className="w-4 h-4 mr-1" />
              Iscrivi Bambino
            </Button>
          </div>
        </div>

        {/* Lista utenti per ruolo */}
        {['admin', 'teacher', 'parent'].map((role) => (
          <div key={role} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden" data-testid={`user-group-${role}`}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: `${getRoleColor(role)}08` }}>
              {(() => { const Icon = getRoleIcon(role); return <Icon className="w-4 h-4" style={{ color: getRoleColor(role) }} />; })()}
              <span className="text-sm font-bold" style={{ fontFamily: 'Nunito', color: getRoleColor(role) }}>
                {getRoleLabel(role)} ({grouped[role].length})
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {grouped[role].map((u) => (
                <div key={u.id} data-testid={`user-row-${u.id}`} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: getRoleColor(role) }}>
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <button
                    data-testid={`delete-user-${u.id}`}
                    onClick={() => setDeleteDialog({ open: true, user: u })}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {grouped[role].length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-gray-400">Nessun utente</div>
              )}
            </div>
          </div>
        ))}

        {/* ── Dialog Elimina ─────────────────────────────────────────────────── */}
        <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, user: null })}>
          <DialogContent className="rounded-2xl max-w-xs mx-auto" data-testid="delete-user-dialog">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito', color: '#EF4444' }}>
                <AlertTriangle className="w-5 h-5" />
                Elimina Utente
              </DialogTitle>
            </DialogHeader>
            <div className="pt-1 space-y-4">
              <p className="text-sm text-gray-600">
                Sei sicura di voler eliminare <strong className="text-gray-900">{deleteDialog.user?.name}</strong>?
                <br /><span className="text-xs text-gray-400">{deleteDialog.user?.email}</span>
              </p>
              <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
                ⚠️ Questa azione è irreversibile.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDeleteDialog({ open: false, user: null })}
                  className="flex-1 rounded-xl h-10 text-sm" data-testid="cancel-delete-user">
                  Annulla
                </Button>
                <Button onClick={handleDelete} disabled={deleteLoading}
                  className="flex-1 rounded-xl h-10 text-sm font-bold text-white"
                  style={{ backgroundColor: '#EF4444' }} data-testid="confirm-delete-user">
                  {deleteLoading ? 'Eliminazione...' : 'Elimina'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Staff (admin / maestra) ────────────────────────────────── */}
        <Dialog open={dialogOpen && dialogType === 'staff'} onOpenChange={(open) => !open && setDialogOpen(false)}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-staff-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>
                Aggiungi Staff
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <Label className="text-xs font-medium text-gray-600">Nome e Cognome</Label>
                <Input data-testid="staff-name-input" value={staffForm.name}
                  onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="rounded-xl mt-1" placeholder="Nome Cognome" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Email</Label>
                <Input data-testid="staff-email-input" value={staffForm.email}
                  onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="rounded-xl mt-1" placeholder="email@esempio.it" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Password</Label>
                <div className="relative mt-1">
                  <Input data-testid="staff-password-input" type={showStaffPwd ? 'text' : 'password'}
                    value={staffForm.password}
                    onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                    className="rounded-xl pr-10" placeholder="Password" />
                  <button type="button" onClick={() => setShowStaffPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
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

              {/* Classi per maestre */}
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
          </DialogContent>
        </Dialog>

        {/* ── Dialog Iscrizione Bambino ──────────────────────────────────────── */}
        <Dialog open={dialogOpen && dialogType === 'iscrizione'} onOpenChange={(open) => !open && setDialogOpen(false)}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-iscrizione-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito' }}>
                <Baby className="w-5 h-5" style={{ color: '#32CD32' }} />
                Iscrizione Bambino
              </DialogTitle>
            </DialogHeader>

            {/* ── Successo ─────────────────────────────────────────── */}
            {iscSuccess ? (
              <div className="pt-2 space-y-4">
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <CheckCircle className="w-12 h-12" style={{ color: '#32CD32' }} />
                  <div>
                    <p className="text-base font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>
                      Iscrizione completata!
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {iscSuccess.bambino_nome} è stato registrato.
                    </p>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-blue-700">
                      {iscSuccess.email_inviata ? 'Email inviata' : 'Email non inviata (SMTP non configurato)'}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Le credenziali sono state inviate a:<br />
                      <strong>{iscSuccess.genitore_email}</strong>
                    </p>
                  </div>
                </div>
                <Button onClick={() => { setDialogOpen(false); setIscSuccess(null); }}
                  className="w-full rounded-2xl font-bold h-10" style={{ backgroundColor: '#32CD32' }}>
                  Chiudi
                </Button>
              </div>
            ) : (
              /* ── Form ─────────────────────────────────────────────── */
              <div className="space-y-3 pt-2 max-h-[72vh] overflow-y-auto pr-1">

                {/* Sezione bambino */}
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dati del Bambino</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Nome *</Label>
                    <Input data-testid="bambino-nome-input" value={iscForm.bambino_nome}
                      onChange={e => setIscForm({ ...iscForm, bambino_nome: e.target.value })}
                      className="rounded-xl mt-1" placeholder="Nome" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Cognome *</Label>
                    <Input data-testid="bambino-cognome-input" value={iscForm.bambino_cognome}
                      onChange={e => setIscForm({ ...iscForm, bambino_cognome: e.target.value })}
                      className="rounded-xl mt-1" placeholder="Cognome" />
                  </div>
                </div>
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

                {/* Separatore */}
                <div className="border-t border-gray-100 pt-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Credenziali Genitore</p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-600">Email Genitore *</Label>
                  <Input data-testid="genitore-email-input" type="email"
                    value={iscForm.genitore_email}
                    onChange={e => setIscForm({ ...iscForm, genitore_email: e.target.value })}
                    className="rounded-xl mt-1" placeholder="genitore@esempio.it" />
                  <p className="text-[10px] text-gray-400 mt-0.5">Le credenziali verranno inviate a questo indirizzo</p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-600">Nome Genitore</Label>
                  <Input data-testid="genitore-nome-input" value={iscForm.genitore_nome}
                    onChange={e => setIscForm({ ...iscForm, genitore_nome: e.target.value })}
                    className="rounded-xl mt-1"
                    placeholder={iscForm.bambino_cognome ? `Famiglia ${iscForm.bambino_cognome}` : 'Lascia vuoto per default'} />
                </div>

                {/* Password: auto-genera o manuale */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-600">Password</Label>
                    <button type="button"
                      onClick={() => setAutogenPwd(v => {
                        if (!v) setIscForm(f => ({ ...f, genitore_password: generatePassword() }));
                        return !v;
                      })}
                      className="text-[10px] font-semibold flex items-center gap-1"
                      style={{ color: '#4169E1' }}>
                      <RefreshCw className="w-3 h-3" />
                      {autogenPwd ? 'Imposta manualmente' : 'Genera automaticamente'}
                    </button>
                  </div>
                  {autogenPwd ? (
                    <div className="mt-1 flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
                      <span className="flex-1 text-sm font-mono font-bold text-blue-700">{iscForm.genitore_password}</span>
                      <button type="button" onClick={() => setIscForm(f => ({ ...f, genitore_password: generatePassword() }))}
                        className="text-blue-400 hover:text-blue-600">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative mt-1">
                      <Input data-testid="genitore-password-input"
                        type={showIscPwd ? 'text' : 'password'}
                        value={iscForm.genitore_password}
                        onChange={e => setIscForm({ ...iscForm, genitore_password: e.target.value })}
                        className="rounded-xl pr-10" placeholder="Minimo 6 caratteri" />
                      <button type="button" onClick={() => setShowIscPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showIscPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>

                {iscError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{iscError}</p>}

                <Button data-testid="create-iscrizione-submit"
                  onClick={handleIscrizione}
                  disabled={iscLoading || !iscrizioneValid}
                  className="w-full rounded-2xl font-bold h-11"
                  style={{ backgroundColor: '#32CD32' }}>
                  <Mail className="w-4 h-4 mr-2" />
                  {iscLoading ? 'Iscrizione in corso...' : 'Iscrivi e Invia Credenziali'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
