import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bell, Plus, Trash2, BookOpen, Users, Check, ChevronDown, ChevronUp } from 'lucide-react';

export default function TeacherAvvisi() {
  const { user } = useAuth();
  const [avvisi, setAvvisi]   = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents]   = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [showParentPicker, setShowParentPicker] = useState(false);

  const teacherClassIds = useMemo(() => {
    const ids = list(user?.class_ids) || [];
    if (user?.class_id && !ids.includes(user.class_id)) ids.push(user.class_id);
    return ids;
  }, [user]);

  function list(v) { return Array.isArray(v) ? [...v] : v ? [v] : []; }

  const [form, setForm] = useState({
    titolo: '',
    testo: '',
    class_id: '',          // classe selezionata (se maestra ha più classi)
    target_parent_ids: [], // vuoto = tutti i genitori della classe
  });

  useEffect(() => {
    if (teacherClassIds.length > 0) {
      setForm(prev => ({ ...prev, class_id: teacherClassIds[0] }));
    }
    loadData();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const [aRes, cRes, sRes, uRes] = await Promise.all([
        api.get('/avvisi'),
        api.get('/classes'),
        api.get('/students'),
        api.get('/users'),
      ]);
      setAvvisi(aRes.data);
      setClasses(cRes.data.filter(c => teacherClassIds.includes(c.id)));
      setStudents(sRes.data);
      setParents(uRes.data.filter(u => u.role === 'parent'));
    } catch (err) { console.error(err); }
  };

  // Genitori della classe selezionata
  const classParents = useMemo(() => {
    const targetClassId = form.class_id;
    if (!targetClassId) return [];
    const classStudentIds = new Set(
      students.filter(s => s.class_id === targetClassId).map(s => s.id)
    );
    return parents.filter(p =>
      (p.child_ids || []).some(cid => classStudentIds.has(cid)) ||
      classStudentIds.has(p.child_id)
    );
  }, [students, parents, form.class_id]);

  const openDialog = () => {
    setForm({ titolo: '', testo: '', class_id: teacherClassIds[0] || '', target_parent_ids: [] });
    setShowParentPicker(false);
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      await api.post('/avvisi', {
        titolo:            form.titolo,
        testo:             form.testo,
        target:            'class',
        class_id:          form.class_id,
        target_class_ids:  [form.class_id],
        target_roles:      ['parent'],        // maestre → SOLO genitori
        target_parent_ids: form.target_parent_ids.length > 0 ? form.target_parent_ids : null,
      });
      setDialogOpen(false);
      loadData();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/avvisi/${id}`); loadData(); }
    catch (err) { console.error(err); }
  };

  const toggleParent = (pid) => {
    setForm(prev => ({
      ...prev,
      target_parent_ids: prev.target_parent_ids.includes(pid)
        ? prev.target_parent_ids.filter(id => id !== pid)
        : [...prev.target_parent_ids, pid],
    }));
  };

  const getClassName = id => classes.find(c => c.id === id)?.name || id;

  return (
    <AppLayout title="Avvisi Classe" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="teacher-avvisi-page">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" style={{ color: '#FF69B4' }} />
            <span className="text-sm font-bold text-gray-700">{avvisi.length} avvisi</span>
          </div>
          <Button data-testid="add-avviso-button" onClick={openDialog}
            className="rounded-2xl font-semibold h-9 text-sm" style={{ backgroundColor: '#FF69B4' }}>
            <Plus className="w-4 h-4 mr-1" />Nuovo Avviso
          </Button>
        </div>

        {/* Lista */}
        {avvisi.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-gray-100">
            <Bell className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400 font-medium">Nessun avviso disponibile</p>
          </div>
        ) : (
          <div className="space-y-3">
            {avvisi.map((a) => {
              const isOwn = a.author_id === user?.id;
              const pCount = (a.target_parent_ids || []).length;
              const badge  = pCount > 0 ? `${pCount} genitor${pCount > 1 ? 'i' : 'e'}`
                : a.class_id ? getClassName(a.class_id) : 'Classe';
              return (
                <div key={a.id} data-testid={`avviso-${a.id}`}
                  className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-pink-50">
                      <BookOpen className="w-4 h-4 text-pink-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: 'Nunito' }}>{a.titolo}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-600 flex-shrink-0">
                          {badge}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{a.testo}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(a.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        {' · '}{a.author_name}
                      </p>
                    </div>
                    {isOwn && (
                      <button data-testid={`delete-avviso-${a.id}`} onClick={() => handleDelete(a.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-avviso-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito' }}>
                <Bell className="w-5 h-5" style={{ color: '#FF69B4' }} />
                Avviso per i Genitori
              </DialogTitle>
            </DialogHeader>

            {/* Nota: solo genitori */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-pink-50 text-xs text-pink-700 font-medium">
              <Users className="w-3.5 h-3.5 flex-shrink-0" />
              Questo avviso sarà visibile solo ai genitori della tua classe
            </div>

            <div className="space-y-3 pt-1 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <Label className="text-xs font-medium text-gray-600">Titolo *</Label>
                <Input data-testid="avviso-titolo-input" value={form.titolo}
                  onChange={e => setForm({ ...form, titolo: e.target.value })}
                  className="rounded-xl mt-1" placeholder="Titolo..." autoComplete="off" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Messaggio *</Label>
                <Textarea data-testid="avviso-testo-input" value={form.testo}
                  onChange={e => setForm({ ...form, testo: e.target.value })}
                  className="rounded-xl mt-1 text-sm resize-none" rows={4}
                  placeholder="Scrivi il comunicato per i genitori..." />
              </div>

              {/* Classe (solo se maestra ha più classi) */}
              {classes.length > 1 && (
                <div>
                  <Label className="text-xs font-medium text-gray-600">Classe</Label>
                  <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v, target_parent_ids: [] })}>
                    <SelectTrigger className="rounded-xl mt-1" data-testid="avviso-class-select">
                      <SelectValue placeholder="Seleziona classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Seleziona genitori specifici */}
              {classParents.length > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <button type="button"
                    onClick={() => setShowParentPicker(v => !v)}
                    className="flex items-center gap-2 w-full text-left py-1">
                    <Users className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-700">
                      Genitori destinatari
                      <span className="text-gray-400 font-normal ml-1">
                        ({form.target_parent_ids.length > 0
                          ? `${form.target_parent_ids.length} selezionati`
                          : `tutti — ${classParents.length}`})
                      </span>
                    </span>
                    {showParentPicker
                      ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                      : <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />}
                  </button>

                  {showParentPicker && (
                    <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
                      <button type="button"
                        onClick={() => setForm(prev => ({ ...prev, target_parent_ids: [] }))}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${form.target_parent_ids.length === 0 ? 'bg-pink-100 text-pink-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                        {form.target_parent_ids.length === 0 && <Check className="w-3 h-3 flex-shrink-0" />}
                        Tutti i genitori
                      </button>
                      {classParents.map(p => {
                        const isSel = form.target_parent_ids.includes(p.id);
                        return (
                          <button key={p.id} type="button" onClick={() => toggleParent(p.id)}
                            className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs transition-colors ${isSel ? 'bg-pink-100 text-pink-700 font-semibold' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                            {isSel && <Check className="w-3 h-3 flex-shrink-0" />}
                            <span className="truncate">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <Button data-testid="create-avviso-submit" onClick={handleCreate}
                disabled={loading || !form.titolo || !form.testo || !form.class_id}
                className="w-full rounded-2xl font-bold h-11" style={{ backgroundColor: '#FF69B4' }}>
                {loading ? 'Pubblicazione...' : 'Pubblica Avviso'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
