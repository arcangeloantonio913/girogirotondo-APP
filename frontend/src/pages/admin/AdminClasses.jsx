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
  BookOpen, Plus, Trash2, Users, ChevronRight, X, GraduationCap,
  Baby, Activity, Pencil, Check, UserX, UserPlus,
} from 'lucide-react';
import StudentDetailDialog from '@/components/StudentDetailDialog';

export default function AdminClasses() {
  const { sede, sedeInfo } = useAuth();
  const [classes, setClasses]   = useState([]);
  const [users, setUsers]       = useState([]);
  const [students, setStudents] = useState([]);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [form, setForm]               = useState({ name: '', teacher_id: '' });
  const [detailClass, setDetailClass] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Modifica inline del nome classe
  const [editingName, setEditingName]   = useState(false);
  const [nameValue, setNameValue]       = useState('');

  // Modifica maestra assegnata
  const [editingTeacher, setEditingTeacher] = useState(false);
  const [teacherValue, setTeacherValue]     = useState('');
  const [savingTeacher, setSavingTeacher]   = useState(false);

  useEffect(() => { loadData(); }, [sede]);

  // Aggiorna detailClass quando classes cambia (dopo un update)
  useEffect(() => {
    if (detailClass) {
      const updated = classes.find(c => c.id === detailClass.id);
      if (updated) setDetailClass(updated);
    }
  }, [classes]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const [cRes, uRes, sRes] = await Promise.all([
        api.get('/classes'),
        api.get('/users'),
        api.get('/students'),
      ]);
      setClasses(cRes.data);
      setUsers(uRes.data);
      setStudents(sRes.data);
    } catch (err) { console.error(err); }
  };

  const handleCreate = async () => {
    try {
      await api.post('/classes', form);
      setDialogOpen(false);
      setForm({ name: '', teacher_id: '' });
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questa classe? Gli alunni rimarranno nel sistema senza classe.')) return;
    try {
      await api.delete(`/classes/${id}`);
      if (detailClass?.id === id) setDetailClass(null);
      loadData();
    } catch (err) { console.error(err); }
  };

  // ── Salva nome classe ────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!nameValue.trim() || !detailClass) return;
    try {
      await api.patch(`/classes/${detailClass.id}`, { name: nameValue.trim() });
      setEditingName(false);
      loadData();
    } catch (err) { console.error(err); }
  };

  // ── Assegna / cambia / rimuovi maestra ───────────────────────────────────────
  const handleSaveTeacher = async (teacherId) => {
    if (!detailClass) return;
    setSavingTeacher(true);
    try {
      await api.patch(`/classes/${detailClass.id}`, {
        teacher_id: teacherId ?? ''   // '' = rimuovi, stringa = assegna
      });
      setEditingTeacher(false);
      loadData();
    } catch (err) { console.error(err); }
    finally { setSavingTeacher(false); }
  };

  const openDetail = (cls) => {
    setDetailClass(cls);
    setEditingName(false);
    setEditingTeacher(false);
    setNameValue(cls.name);
    setTeacherValue(cls.teacher_id || '');
  };

  const teachers      = users.filter(u => u.role === 'teacher');
  const detailStudents= detailClass ? students.filter(s => s.class_id === detailClass.id) : [];
  const detailTeacher = detailClass ? users.find(u => u.id === detailClass.teacher_id) : null;
  const getParentOfStudent = (studentId) =>
    users.find(u => (u.child_ids || []).includes(studentId) || u.child_id === studentId);

  const classColors = ['#4169E1', '#FF69B4', '#32CD32', '#F59E0B', '#8B5CF6'];

  return (
    <AppLayout title="Gestione Classi" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-classes-page">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" style={{ color: '#FF69B4' }} />
            <span className="text-sm font-bold text-gray-700">{classes.length} classi</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: sedeInfo?.color }}>
              {sedeInfo?.label}
            </span>
          </div>
          <Button data-testid="add-class-button" onClick={() => setDialogOpen(true)}
            className="rounded-2xl font-semibold h-9 text-sm" style={{ backgroundColor: '#FF69B4' }}>
            <Plus className="w-4 h-4 mr-1" />Nuova Classe
          </Button>
        </div>

        {/* ── Pannello dettaglio classe ──────────────────────────────────────── */}
        {detailClass && (
          <div className="bg-white rounded-2xl shadow-md border-2 overflow-hidden"
            style={{ borderColor: sedeInfo?.color }} data-testid="class-detail-panel">

            {/* Header dettaglio */}
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ backgroundColor: `${sedeInfo?.color}12` }}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {editingName ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      className="h-8 rounded-xl text-sm font-bold flex-1"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }} />
                    <button onClick={handleSaveName}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-green-100 text-green-600 hover:bg-green-200">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingName(false)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 text-gray-500 hover:bg-gray-200">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-base font-black truncate"
                      style={{ fontFamily: 'Nunito', color: sedeInfo?.color }}>
                      {detailClass.name}
                    </h3>
                    <button onClick={() => { setEditingName(true); setNameValue(detailClass.name); }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/50 text-gray-400 hover:text-gray-600">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
              <button onClick={() => setDetailClass(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/50 ml-2 flex-shrink-0">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* ── Sezione Maestra ─────────────────────────────────────────────── */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Maestra assegnata
              </p>

              {editingTeacher ? (
                /* Selezione maestra */
                <div className="space-y-2">
                  <Select value={teacherValue}
                    onValueChange={v => setTeacherValue(v)}>
                    <SelectTrigger className="rounded-xl h-9 text-sm" data-testid="class-teacher-select">
                      <SelectValue placeholder="Seleziona maestra..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    {detailClass.teacher_id && (
                      <Button variant="outline" onClick={() => handleSaveTeacher('')}
                        disabled={savingTeacher}
                        className="flex-1 h-8 rounded-xl text-xs border-red-200 text-red-500 hover:bg-red-50">
                        <UserX className="w-3.5 h-3.5 mr-1" />Rimuovi
                      </Button>
                    )}
                    <Button onClick={() => handleSaveTeacher(teacherValue)}
                      disabled={savingTeacher || !teacherValue}
                      className="flex-1 h-8 rounded-xl text-xs text-white"
                      style={{ backgroundColor: sedeInfo?.color }}>
                      {savingTeacher ? 'Salvataggio...' : <><Check className="w-3.5 h-3.5 mr-1" />Salva</>}
                    </Button>
                    <Button variant="outline" onClick={() => setEditingTeacher(false)}
                      className="h-8 rounded-xl text-xs px-3">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ) : detailTeacher ? (
                /* Maestra assegnata — con edit/rimozione */
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: '#FF69B4' }}>
                    {detailTeacher.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{detailTeacher.name}</p>
                    <p className="text-xs text-gray-400 truncate">{detailTeacher.email}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditingTeacher(true); setTeacherValue(detailTeacher.id); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-50 text-gray-400 hover:text-blue-500"
                      title="Cambia maestra">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleSaveTeacher('')}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-gray-400 hover:text-red-500"
                      title="Rimuovi maestra">
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Nessuna maestra — pulsante assegna */
                <button
                  onClick={() => { setEditingTeacher(true); setTeacherValue(''); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-gray-200 hover:border-pink-300 hover:bg-pink-50 transition-colors w-full"
                  data-testid="assign-teacher-button">
                  <UserPlus className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400 font-medium">Assegna maestra</span>
                </button>
              )}
            </div>

            {/* ── Sezione Alunni ──────────────────────────────────────────────── */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Alunni ({detailStudents.length})
                </p>
              </div>
              {detailStudents.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nessun alunno in questa classe</p>
              ) : (
                <div className="space-y-1.5">
                  {detailStudents.map(s => {
                    const parent = getParentOfStudent(s.id);
                    return (
                      <button key={s.id}
                        onClick={() => setSelectedStudent(s)}
                        className="flex items-center gap-3 py-2 px-3 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors w-full text-left">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#4169E1' }}>
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{s.name} {s.cognome || ''}</p>
                          {s.date_of_birth && (
                            <p className="text-[10px] text-gray-400">
                              {new Date(s.date_of_birth + 'T12:00:00').toLocaleDateString('it-IT')}
                            </p>
                          )}
                          {parent && <p className="text-[10px] text-gray-400">Genitore: {parent.name}</p>}
                        </div>
                        <Pencil className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Lista classi ─────────────────────────────────────────────────────── */}
        {classes.length === 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 text-center">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">Nessuna classe per <strong>{sedeInfo?.label}</strong></p>
          </div>
        )}

        {classes.map((cls, idx) => {
          const teacher       = users.find(u => u.id === cls.teacher_id);
          const classStudents = students.filter(s => s.class_id === cls.id);
          const color         = classColors[idx % classColors.length];
          const isSelected    = detailClass?.id === cls.id;

          return (
            <div key={cls.id} data-testid={`class-card-${cls.id}`}
              className={`bg-white rounded-2xl shadow-md overflow-hidden transition-all ${isSelected ? 'border-2' : 'border border-gray-100'}`}
              style={isSelected ? { borderColor: color } : {}}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: color }}>
                      {cls.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
                        {cls.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {teacher
                          ? <span className="flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" />{teacher.name}
                            </span>
                          : <span className="text-amber-500 font-medium">⚠ Nessuna maestra</span>
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button data-testid={`view-class-${cls.id}`}
                      onClick={() => isSelected ? setDetailClass(null) : openDetail(cls)}
                      className="h-8 px-3 flex items-center gap-1 rounded-xl text-xs font-semibold transition-colors"
                      style={isSelected
                        ? { backgroundColor: color, color: 'white' }
                        : { backgroundColor: `${color}18`, color }}>
                      {isSelected ? <X className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      {isSelected ? 'Chiudi' : 'Gestisci'}
                    </button>
                    <button data-testid={`delete-class-${cls.id}`}
                      onClick={() => handleDelete(cls.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Baby className="w-3 h-3" />{classStudents.length} alunni
                  </span>
                  {classStudents.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {classStudents.slice(0, 4).map(s => (
                        <span key={s.id} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium text-[10px]">
                          {s.name.split(' ')[0]}
                        </span>
                      ))}
                      {classStudents.length > 4 && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[10px]">
                          +{classStudents.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

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
            loadData();
          }}
        />

        {/* ── Dialog Nuova Classe ──────────────────────────────────────────────── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-class-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>
                Nuova Classe
                <span className="text-sm font-normal text-gray-400 ml-2">— {sedeInfo?.label}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs font-medium text-gray-600">Nome Classe *</Label>
                <Input data-testid="class-name-input" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="rounded-xl mt-1" placeholder="Es. Farfalle" autoComplete="off" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Maestra Assegnata</Label>
                <Select value={form.teacher_id} onValueChange={v => setForm({ ...form, teacher_id: v })}>
                  <SelectTrigger className="rounded-xl mt-1" data-testid="class-teacher-select">
                    <SelectValue placeholder="Seleziona (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button data-testid="create-class-submit" onClick={handleCreate}
                disabled={!form.name}
                className="w-full rounded-2xl font-bold h-11" style={{ backgroundColor: '#FF69B4' }}>
                Crea Classe
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
