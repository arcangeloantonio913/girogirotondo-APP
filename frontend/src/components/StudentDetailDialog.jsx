/**
 * StudentDetailDialog — dialog riutilizzabile per visualizzare, modificare
 * ed eliminare un bambino. Usato da AdminUsers, AdminClasses, TeacherDashboard.
 *
 * Props:
 *   student        — oggetto studente (null = dialog chiuso)
 *   classes        — array di classi per il cambio classe (admin only)
 *   users          — array utenti per trovare il genitore
 *   role           — 'admin' | 'teacher'
 *   onClose()      — chiude il dialog
 *   onSaved(s)     — chiamato dopo salvataggio con lo studente aggiornato
 *   onDeleted(id)  — chiamato dopo eliminazione (solo admin)
 */
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pencil, Trash2, UserX, Check, X, AlertTriangle,
  Baby, Heart, BookOpen, Calendar, Tag, FileText,
} from 'lucide-react';

export default function StudentDetailDialog({
  student,
  classes = [],
  users = [],
  role = 'admin',
  onClose,
  onSaved,
  onDeleted,
}) {
  const [editing, setEditing]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [form, setForm]               = useState({});

  // Sincronizza form quando cambia studente
  useEffect(() => {
    if (student) {
      setForm({
        name:          student.name || '',
        cognome:       student.cognome || '',
        date_of_birth: student.date_of_birth || '',
        class_id:      student.class_id || '',
        allergies:     (student.allergies || []).join(', '),
        notes:         student.notes || '',
      });
      setEditing(false);
      setConfirmDelete(false);
      setConfirmRemove(false);
      setError('');
    }
  }, [student]);

  if (!student) return null;

  const parent = users.find(u =>
    (u.child_ids || []).includes(student.id) || u.child_id === student.id
  );
  const cls = classes.find(c => c.id === student.class_id);
  const isAdmin = role === 'admin';

  // ── Salva modifiche ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        name:          form.name.trim() || undefined,
        cognome:       form.cognome.trim() || undefined,
        date_of_birth: form.date_of_birth || undefined,
        class_id:      form.class_id || undefined,
        allergies:     form.allergies
          ? form.allergies.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        notes:         form.notes || undefined,
      };
      const res = await api.put(`/students/${student.id}`, payload);
      setEditing(false);
      onSaved?.(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setLoading(false);
    }
  };

  // ── Elimina studente (admin only) ──────────────────────────────────────────
  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.delete(`/students/${student.id}`);
      onDeleted?.(student.id);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante l\'eliminazione');
      setLoading(false);
    }
  };

  // ── Rimuovi dalla classe ────────────────────────────────────────────────────
  const handleRemoveFromClass = async () => {
    setLoading(true);
    try {
      const res = await api.patch(`/students/${student.id}/remove-from-class`);
      setConfirmRemove(false);
      onSaved?.(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore');
      setLoading(false);
    }
  };

  const fullName = [student.name, student.cognome].filter(Boolean).join(' ');

  return (
    <Dialog open={!!student} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="student-detail-dialog">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito' }}>
            <Baby className="w-5 h-5" style={{ color: '#4169E1' }} />
            {editing ? 'Modifica Bambino' : fullName || student.name}
          </DialogTitle>
        </DialogHeader>

        {/* ── Vista dettaglio (non in modifica) ───────────────────────────── */}
        {!editing && !confirmDelete && !confirmRemove && (
          <div className="space-y-3 pt-1">
            {/* Info principali */}
            <div className="grid grid-cols-2 gap-2">
              <InfoCard icon={Baby} label="Nome" value={fullName || student.name} color="#4169E1" />
              <InfoCard icon={BookOpen} label="Classe"
                value={cls?.name || (student.class_id ? '—' : 'Nessuna classe')} color="#FF69B4" />
              {student.date_of_birth && (
                <InfoCard icon={Calendar} label="Data nascita"
                  value={new Date(student.date_of_birth + 'T12:00:00').toLocaleDateString('it-IT')}
                  color="#32CD32" />
              )}
              <InfoCard icon={Tag} label="Codice" value={student.child_code || '—'} color="#F59E0B" />
            </div>

            {/* Allergie */}
            {(student.allergies || []).length > 0 && (
              <div className="bg-red-50 rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">⚠️ Allergie</p>
                <div className="flex flex-wrap gap-1">
                  {student.allergies.map((a, i) => (
                    <span key={i} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            {student.notes && (
              <div className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Note</p>
                <p className="text-xs text-gray-700">{student.notes}</p>
              </div>
            )}

            {/* Genitore */}
            {parent && (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#F0FFF0' }}>
                <Heart className="w-4 h-4 flex-shrink-0" style={{ color: '#32CD32' }} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-700">{parent.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{parent.email}</p>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            {/* Azioni */}
            <div className="flex gap-2 pt-1">
              <Button onClick={() => setEditing(true)}
                className="flex-1 h-9 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: '#4169E1' }}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />Modifica
              </Button>
              {student.class_id && (
                <Button onClick={() => setConfirmRemove(true)} variant="outline"
                  className="h-9 rounded-xl text-sm font-semibold border-2"
                  style={{ borderColor: '#F59E0B', color: '#F59E0B' }}>
                  <UserX className="w-3.5 h-3.5" />
                </Button>
              )}
              {isAdmin && (
                <Button onClick={() => setConfirmDelete(true)} variant="outline"
                  className="h-9 rounded-xl border-2"
                  style={{ borderColor: '#EF4444', color: '#EF4444' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Form modifica ────────────────────────────────────────────────── */}
        {editing && (
          <div className="space-y-3 pt-1 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-medium text-gray-600">Nome</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="rounded-xl mt-1" autoComplete="off" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Cognome</Label>
                <Input value={form.cognome} onChange={e => setForm({ ...form, cognome: e.target.value })}
                  className="rounded-xl mt-1" autoComplete="off" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-gray-600">Data di nascita</Label>
              <Input type="date" value={form.date_of_birth}
                onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                className="rounded-xl mt-1" />
            </div>

            {/* Cambio classe — solo admin */}
            {isAdmin && classes.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-gray-600">Classe</Label>
                <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue placeholder="Seleziona classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-gray-600">Allergie (separate da virgola)</Label>
              <Input value={form.allergies}
                onChange={e => setForm({ ...form, allergies: e.target.value })}
                className="rounded-xl mt-1" placeholder="Es. glutine, latte, uova"
                autoComplete="off" />
            </div>

            <div>
              <Label className="text-xs font-medium text-gray-600">Note</Label>
              <Input value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="rounded-xl mt-1" placeholder="Annotazioni particolari..."
                autoComplete="off" />
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEditing(false); setError(''); }}
                className="flex-1 h-10 rounded-xl text-sm">Annulla</Button>
              <Button onClick={handleSave} disabled={loading || !form.name}
                className="flex-1 h-10 rounded-xl text-sm font-bold" style={{ backgroundColor: '#4169E1' }}>
                {loading ? 'Salvataggio...' : <><Check className="w-4 h-4 mr-1" />Salva</>}
              </Button>
            </div>
          </div>
        )}

        {/* ── Conferma eliminazione ────────────────────────────────────────── */}
        {confirmDelete && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <AlertTriangle className="w-10 h-10" style={{ color: '#EF4444' }} />
              <div>
                <p className="text-sm font-bold text-gray-900">Eliminare <strong>{fullName}</strong>?</p>
                <p className="text-xs text-gray-500 mt-1">
                  Questa azione è irreversibile. Verranno eliminati anche i dati della griglia e le foto associate.
                </p>
              </div>
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}
                className="flex-1 h-10 rounded-xl text-sm">Annulla</Button>
              <Button onClick={handleDelete} disabled={loading}
                className="flex-1 h-10 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: '#EF4444' }}>
                {loading ? 'Eliminazione...' : 'Elimina'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Conferma rimozione dalla classe ──────────────────────────────── */}
        {confirmRemove && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <UserX className="w-10 h-10" style={{ color: '#F59E0B' }} />
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Rimuovere <strong>{fullName}</strong> dalla classe <strong>{cls?.name}</strong>?
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Il bambino non sarà eliminato — rimarrà nel sistema senza classe assegnata.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmRemove(false)}
                className="flex-1 h-10 rounded-xl text-sm">Annulla</Button>
              <Button onClick={handleRemoveFromClass} disabled={loading}
                className="flex-1 h-10 rounded-xl text-sm font-bold"
                style={{ backgroundColor: '#F59E0B', color: 'white' }}>
                {loading ? 'Rimozione...' : 'Rimuovi dalla classe'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Helper component ──────────────────────────────────────────────────────────
function InfoCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl p-2.5" style={{ backgroundColor: `${color}10` }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3 h-3" style={{ color }} />
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
      </div>
      <p className="text-xs font-semibold text-gray-800 truncate">{value || '—'}</p>
    </div>
  );
}
