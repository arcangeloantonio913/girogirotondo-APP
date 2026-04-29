import { useState, useEffect, useMemo } from 'react';
import { useAuth, SEDI } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Bell, Plus, Trash2, Globe, BookOpen, Users, GraduationCap,
  Building2, Check, ChevronDown, ChevronUp, Pencil,
} from 'lucide-react';

// ── Chip multi-select ─────────────────────────────────────────────────────────
function MultiChip({ items, selected, onToggle, colorActive = '#4169E1', labelKey = 'name', valueKey = 'id', allLabel = 'Tutti' }) {
  const allSelected = selected.length === 0;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button"
        onClick={() => onToggle('__all__')}
        className={`px-3 py-1 rounded-xl text-xs font-semibold border-2 transition-all ${allSelected ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'}`}
        style={allSelected ? { backgroundColor: colorActive, borderColor: colorActive } : {}}>
        {allLabel}
      </button>
      {items.map(item => {
        const val = item[valueKey];
        const isActive = selected.includes(val);
        return (
          <button key={val} type="button"
            onClick={() => onToggle(val)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold border-2 transition-all ${isActive ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'}`}
            style={isActive ? { backgroundColor: colorActive, borderColor: colorActive } : {}}>
            {item[labelKey]}
          </button>
        );
      })}
    </div>
  );
}

function toggleInList(list, val) {
  if (val === '__all__') return [];
  return list.includes(val) ? list.filter(v => v !== val) : [...list, val];
}

const ROLE_OPTIONS = [
  { id: 'parent',  label: 'Genitori',    icon: Users },
  { id: 'teacher', label: 'Maestre',     icon: GraduationCap },
];

export default function AdminAvvisi() {
  const { sede, sedeInfo } = useAuth();
  const [avvisi, setAvvisi]   = useState([]);
  const [classes, setClasses] = useState([]);
  const [users, setUsers]     = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showParentPicker, setShowParentPicker] = useState(false);

  // Edit avviso
  const [editDialog, setEditDialog] = useState({ open: false, avviso: null });
  const [editForm, setEditForm]     = useState({ titolo: '', testo: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    titolo: '', testo: '',
    target_sedi:       [sede],          // default: sede attiva
    target_roles:      [],              // vuoto = tutti
    target_class_ids:  [],              // vuoto = tutte le classi
    target_parent_ids: [],              // vuoto = tutti i genitori
  });

  useEffect(() => { loadData(); }, [sede]);

  // Quando cambia sede, aggiorna il default nel form
  useEffect(() => {
    setForm(prev => ({ ...prev, target_sedi: [sede] }));
  }, [sede]);

  const loadData = async () => {
    try {
      const [aRes, cRes, uRes] = await Promise.all([
        api.get('/avvisi'),
        api.get('/classes'),
        api.get('/users'),
      ]);
      setAvvisi(aRes.data);
      setClasses(cRes.data);
      setUsers(uRes.data);
    } catch (err) { console.error(err); }
  };

  const openDialog = () => {
    setForm({
      titolo: '', testo: '',
      target_sedi:      [sede],
      target_roles:     [],
      target_class_ids: [],
      target_parent_ids:[],
    });
    setShowParentPicker(false);
    setDialogOpen(true);
  };

  // Classi delle sedi selezionate
  const availableClasses = useMemo(() =>
    classes.filter(c => form.target_sedi.length === 0 || form.target_sedi.includes(c.sede_id)),
    [classes, form.target_sedi]
  );

  // Genitori delle classi target (o di tutte le classi nelle sedi)
  const availableParents = useMemo(() => {
    const targetClassIds = form.target_class_ids.length > 0
      ? form.target_class_ids
      : availableClasses.map(c => c.id);
    return users.filter(u =>
      u.role === 'parent' &&
      (u.child_ids || []).some(cid => {
        // il genitore è "disponibile" se uno dei suoi figli è in una delle classi target
        const student = users; // workaround: dovremmo avere gli studenti
        return true; // semplificato: mostra tutti i genitori delle sedi target
      })
    );
  }, [users, form.target_class_ids, availableClasses]);

  // Genitori filtrati per classi target (con studenti)
  const [students, setStudents] = useState([]);
  useEffect(() => {
    api.get('/students').then(r => setStudents(r.data)).catch(() => {});
  }, [sede]);

  const filteredParents = useMemo(() => {
    const targetClassIds = form.target_class_ids.length > 0
      ? form.target_class_ids
      : availableClasses.map(c => c.id);
    const parentIds = new Set(
      students
        .filter(s => targetClassIds.includes(s.class_id))
        .flatMap(s => {
          const parent = users.find(u => (u.child_ids || []).includes(s.id) || u.child_id === s.id);
          return parent ? [parent.id] : [];
        })
    );
    return users.filter(u => u.role === 'parent' && parentIds.has(u.id));
  }, [students, users, form.target_class_ids, availableClasses]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const payload = {
        titolo:            form.titolo,
        testo:             form.testo,
        target:            form.target_class_ids.length > 0 ? 'class' : 'global',
        target_sedi:       form.target_sedi.length > 0 ? form.target_sedi : [sede],
        target_roles:      form.target_roles.length > 0 ? form.target_roles : null,
        target_class_ids:  form.target_class_ids.length > 0 ? form.target_class_ids : null,
        target_parent_ids: form.target_parent_ids.length > 0 ? form.target_parent_ids : null,
      };
      await api.post('/avvisi', payload);
      setDialogOpen(false);
      loadData();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/avvisi/${id}`); loadData(); }
    catch (err) { console.error(err); }
  };

  const openEdit = (a) => {
    setEditForm({ titolo: a.titolo, testo: a.testo });
    setEditDialog({ open: true, avviso: a });
  };

  const handleEdit = async () => {
    if (!editDialog.avviso) return;
    setEditLoading(true);
    try {
      await api.put(`/avvisi/${editDialog.avviso.id}`, editForm);
      setEditDialog({ open: false, avviso: null });
      loadData();
    } catch (err) { console.error(err); }
    finally { setEditLoading(false); }
  };

  const getClassName  = id => classes.find(c => c.id === id)?.name || id;
  const getSedeLabel  = id => SEDI.find(s => s.id === id)?.label || id;
  const getTargetBadge = (a) => {
    const roles  = a.target_roles || [];
    const sedi   = a.target_sedi  || [];
    const clsIds = a.target_class_ids || [];
    const pIds   = a.target_parent_ids || [];

    let label = 'Tutti';
    if (pIds.length > 0)        label = `${pIds.length} genitor${pIds.length > 1 ? 'i' : 'e'}`;
    else if (clsIds.length > 0) label = clsIds.map(getClassName).join(', ');
    else if (roles.length === 1) label = roles[0] === 'parent' ? 'Solo genitori' : 'Solo maestre';

    const multiSede = sedi.length > 1;
    return { label, multiSede };
  };

  const showParentSection = form.target_roles.length === 0 || form.target_roles.includes('parent');

  return (
    <AppLayout title="Avvisi e Comunicazioni" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-avvisi-page">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" style={{ color: '#4169E1' }} />
            <span className="text-sm font-bold text-gray-700">{avvisi.length} avvisi</span>
          </div>
          <Button data-testid="add-avviso-button" onClick={openDialog}
            className="rounded-2xl font-semibold h-9 text-sm" style={{ backgroundColor: '#4169E1' }}>
            <Plus className="w-4 h-4 mr-1" />Nuovo Avviso
          </Button>
        </div>

        {/* Lista avvisi */}
        {avvisi.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-gray-100">
            <Bell className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400 font-medium">Nessun avviso pubblicato</p>
          </div>
        ) : (
          <div className="space-y-3">
            {avvisi.map((a) => {
              const { label, multiSede } = getTargetBadge(a);
              return (
                <div key={a.id} data-testid={`avviso-${a.id}`}
                  className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#4169E115' }}>
                      <Bell className="w-4 h-4" style={{ color: '#4169E1' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: 'Nunito' }}>{a.titolo}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
                          {label}
                        </span>
                        {multiSede && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 flex-shrink-0">
                            Entrambe le sedi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{a.testo}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(a.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        {' · '}{a.author_name}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button data-testid={`edit-avviso-${a.id}`} onClick={() => openEdit(a)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button data-testid={`delete-avviso-${a.id}`} onClick={() => handleDelete(a.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Dialog modifica avviso ──────────────────────────────────────── */}
        <Dialog open={editDialog.open} onOpenChange={(o) => !o && setEditDialog({ open: false, avviso: null })}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="edit-avviso-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>
                Modifica Avviso
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div>
                <Label className="text-xs font-medium text-gray-600">Titolo</Label>
                <input value={editForm.titolo} onChange={e => setEditForm({ ...editForm, titolo: e.target.value })}
                  className="w-full rounded-xl mt-1 border border-gray-200 px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Messaggio</Label>
                <textarea value={editForm.testo} onChange={e => setEditForm({ ...editForm, testo: e.target.value })}
                  rows={4} className="w-full rounded-xl mt-1 border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditDialog({ open: false, avviso: null })}
                  className="flex-1 rounded-xl h-10 text-sm">Annulla</Button>
                <Button onClick={handleEdit} disabled={editLoading || !editForm.titolo || !editForm.testo}
                  className="flex-1 rounded-xl h-10 text-sm font-bold" style={{ backgroundColor: '#4169E1' }}>
                  {editLoading ? 'Salvataggio...' : 'Salva'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Dialog nuovo avviso ──────────────────────────────────────────── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-avviso-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>
                Nuovo Avviso
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">

              {/* Testo */}
              <div>
                <Label className="text-xs font-medium text-gray-600">Titolo *</Label>
                <Input data-testid="avviso-titolo-input" value={form.titolo}
                  onChange={e => setForm({ ...form, titolo: e.target.value })}
                  className="rounded-xl mt-1" placeholder="Titolo dell'avviso..." autoComplete="off" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Messaggio *</Label>
                <Textarea data-testid="avviso-testo-input" value={form.testo}
                  onChange={e => setForm({ ...form, testo: e.target.value })}
                  className="rounded-xl mt-1 text-sm resize-none" rows={3}
                  placeholder="Scrivi il comunicato..." />
              </div>

              {/* Sezione 1: Sede */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-3.5 h-3.5" style={{ color: '#4169E1' }} />
                  <Label className="text-xs font-bold text-gray-700">Sede destinataria</Label>
                </div>
                <MultiChip
                  items={SEDI}
                  selected={form.target_sedi}
                  onToggle={val => setForm(prev => ({
                    ...prev,
                    target_sedi: toggleInList(prev.target_sedi, val),
                    target_class_ids: [],   // reset classi quando cambia sede
                    target_parent_ids: [],
                  }))}
                  colorActive={sedeInfo?.color || '#4169E1'}
                  labelKey="label"
                  valueKey="id"
                  allLabel="Entrambe"
                />
              </div>

              {/* Sezione 2: Destinatari (ruoli) */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-3.5 h-3.5" style={{ color: '#4169E1' }} />
                  <Label className="text-xs font-bold text-gray-700">Destinatari</Label>
                </div>
                <MultiChip
                  items={ROLE_OPTIONS}
                  selected={form.target_roles}
                  onToggle={val => setForm(prev => ({
                    ...prev,
                    target_roles: toggleInList(prev.target_roles, val),
                    target_parent_ids: [],
                  }))}
                  colorActive="#8B5CF6"
                  labelKey="label"
                  valueKey="id"
                  allLabel="Tutti (genitori + maestre)"
                />
              </div>

              {/* Sezione 3: Classi */}
              {availableClasses.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-3.5 h-3.5" style={{ color: '#FF69B4' }} />
                    <Label className="text-xs font-bold text-gray-700">Classi</Label>
                  </div>
                  <MultiChip
                    items={availableClasses}
                    selected={form.target_class_ids}
                    onToggle={val => setForm(prev => ({
                      ...prev,
                      target_class_ids: toggleInList(prev.target_class_ids, val),
                      target_parent_ids: [],
                    }))}
                    colorActive="#FF69B4"
                    labelKey="name"
                    valueKey="id"
                    allLabel="Tutte le classi"
                  />
                </div>
              )}

              {/* Sezione 4: Genitori specifici (solo se il target include genitori) */}
              {showParentSection && filteredParents.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <button type="button"
                    onClick={() => setShowParentPicker(v => !v)}
                    className="flex items-center gap-2 w-full text-left">
                    <Users className="w-3.5 h-3.5" style={{ color: '#32CD32' }} />
                    <Label className="text-xs font-bold text-gray-700 cursor-pointer">
                      Seleziona genitori specifici
                      <span className="text-gray-400 font-normal ml-1">
                        ({form.target_parent_ids.length > 0 ? `${form.target_parent_ids.length} selezionati` : 'tutti'})
                      </span>
                    </Label>
                    {showParentPicker
                      ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                      : <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />}
                  </button>

                  {showParentPicker && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {/* Seleziona tutti */}
                      <button type="button"
                        onClick={() => setForm(prev => ({ ...prev, target_parent_ids: [] }))}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${form.target_parent_ids.length === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                        {form.target_parent_ids.length === 0 && <Check className="w-3.5 h-3.5" />}
                        Tutti i genitori ({filteredParents.length})
                      </button>
                      {filteredParents.map(p => {
                        const isSelected = form.target_parent_ids.includes(p.id);
                        return (
                          <button key={p.id} type="button"
                            onClick={() => setForm(prev => ({
                              ...prev,
                              target_parent_ids: toggleInList(prev.target_parent_ids, p.id)
                            }))}
                            className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs transition-colors ${isSelected ? 'bg-green-100 text-green-700 font-semibold' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                            {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                            <span className="truncate">{p.name}</span>
                            <span className="text-gray-400 truncate ml-auto text-[10px]">{p.email}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Submit */}
              <Button data-testid="create-avviso-submit" onClick={handleCreate}
                disabled={loading || !form.titolo || !form.testo}
                className="w-full rounded-2xl font-bold h-11 mt-2"
                style={{ backgroundColor: '#4169E1' }}>
                {loading ? 'Pubblicazione...' : 'Pubblica Avviso'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
