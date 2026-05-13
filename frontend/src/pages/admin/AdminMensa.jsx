import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UtensilsCrossed, Plus, Trash2, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const EMPTY_FORM = {
  class_id: '',
  date_from: '',
  date_to:   '',
  primo: '', secondo: '', contorno: '', frutta: '',
  merenda_mattina: '', merenda_pomeriggio: '',
};

// Preset rapidi di durata
const PRESETS = [
  { label: '1 giorno',       days: 0 },
  { label: '1 settimana',    days: 6 },
  { label: '2 settimane',    days: 13 },
  { label: '1 mese',         days: 29 },
  { label: 'Personalizzato', days: -1 },
];

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function formatRange(from, to) {
  if (!from) return '—';
  const f = new Date(from + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  if (!to || to === from) return f;
  const t = new Date(to + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  return `${f} → ${t}`;
}

function MealBadge({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 p-2.5 rounded-xl" style={{ backgroundColor: '#FFFDD0' }}>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-xs font-semibold text-gray-800">{value}</span>
    </div>
  );
}

export default function AdminMensa() {
  const { sede } = useAuth();
  const [meals, setMeals]       = useState([]);
  const [classes, setClasses]   = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [preset, setPreset]     = useState(0); // indice in PRESETS
  const [loading, setLoading]   = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [dateOffset, setDateOffset] = useState(0);

  const getDate = (offset = 0) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };
  const today       = getDate();
  const currentDate = getDate(dateOffset);
  const dateDisplay = new Date(currentDate + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  useEffect(() => { loadData(); }, [currentDate, sede]); // eslint-disable-line
  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data)).catch(() => {});
  }, [sede]);

  const loadData = async () => {
    try {
      const r = await api.get(`/meals?date=${currentDate}`);
      setMeals(r.data);
    } catch { }
  };

  // Quando cambia il preset, aggiorna date_to
  const applyPreset = (idx, fromDate) => {
    setPreset(idx);
    const p = PRESETS[idx];
    if (p.days < 0) return; // personalizzato → l'utente sceglie
    const from = fromDate || form.date_from || today;
    const to   = p.days === 0 ? from : addDays(from, p.days);
    setForm(f => ({ ...f, date_from: from, date_to: to }));
  };

  const openDialog = () => {
    const from = today;
    setForm({ ...EMPTY_FORM, date_from: from, date_to: from });
    setPreset(0);
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!form.date_from || !form.primo) return;
    setLoading(true);
    try {
      const payload = {
        ...form,
        class_id:  form.class_id || '',
        date:      form.date_from === form.date_to ? form.date_from : null,
        date_from: form.date_from,
        date_to:   form.date_to || form.date_from,
      };
      await api.post('/meals/menu', payload);
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      loadData();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async (mealId) => {
    setDeletingId(mealId);
    try {
      await api.delete(`/meals/menu/${mealId}`);
      setMeals(prev => prev.filter(m => m.id !== mealId));
    } catch { }
    finally { setDeletingId(null); }
  };

  const getClassName = (id) => classes.find(c => c.id === id)?.name || 'Tutte le classi';

  return (
    <AppLayout title="Menu della Mensa" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-mensa-page">

        {/* Navigazione data */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <button onClick={() => setDateOffset(d => d - 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100" data-testid="date-prev">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-center">
              <h3 className="text-base font-bold capitalize" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{dateDisplay}</h3>
              <p className="text-xs text-gray-400">{meals.length} menu attivi</p>
            </div>
            <button onClick={() => setDateOffset(d => d + 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100" data-testid="date-next">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Header + Add */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5" style={{ color: '#4169E1' }} />
            <span className="text-sm font-bold text-gray-700">Menu attivi per oggi</span>
          </div>
          <Button onClick={openDialog}
            className="rounded-2xl font-semibold h-9 text-sm" style={{ backgroundColor: '#4169E1' }}
            data-testid="add-menu-button">
            <Plus className="w-4 h-4 mr-1" />Aggiungi Menu
          </Button>
        </div>

        {/* Lista menu */}
        {meals.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-gray-100">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400 font-medium">Nessun menu per questa giornata</p>
            <p className="text-xs text-gray-400 mt-1">Aggiungi un menu valido anche per più giorni</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meals.map(m => (
              <div key={m.id} data-testid={`meal-${m.id}`}
                className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#4169E115' }}>
                        <UtensilsCrossed className="w-4 h-4" style={{ color: '#4169E1' }} />
                      </div>
                      <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>
                        {getClassName(m.class_id)}
                      </span>
                    </div>
                    {/* Range date */}
                    <div className="flex items-center gap-1 mt-1 ml-10">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span className="text-[10px] text-gray-400 font-medium">
                        {m.date_from && m.date_to && m.date_from !== m.date_to
                          ? formatRange(m.date_from, m.date_to)
                          : new Date((m.date || m.date_from || '') + 'T12:00:00')
                              .toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(m.id)} disabled={deletingId === m.id}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    data-testid={`delete-meal-${m.id}`}>
                    {deletingId === m.id
                      ? <span className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin inline-block" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MealBadge label="Primo"     value={m.primo} />
                  <MealBadge label="Secondo"   value={m.secondo} />
                  <MealBadge label="Contorno"  value={m.contorno} />
                  <MealBadge label="Frutta"    value={m.frutta} />
                  {m.merenda_mattina    && <MealBadge label="Merenda mattina"    value={m.merenda_mattina} />}
                  {m.merenda_pomeriggio && <MealBadge label="Merenda pomeriggio" value={m.merenda_pomeriggio} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-menu-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>
                Nuovo Menu
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 max-h-[75vh] overflow-y-auto pr-1">

              {/* Classe */}
              <div>
                <Label className="text-xs font-medium text-gray-600">Classe (opzionale)</Label>
                <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v }))}>
                  <SelectTrigger className="rounded-xl mt-1" data-testid="menu-class-select">
                    <SelectValue placeholder="Tutte le classi" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Durata con preset */}
              <div>
                <Label className="text-xs font-medium text-gray-600">Durata del menu</Label>
                <div className="flex gap-1.5 flex-wrap mt-1.5">
                  {PRESETS.map((p, i) => (
                    <button key={i} type="button" onClick={() => applyPreset(i, form.date_from)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                        preset === i ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'
                      }`}
                      style={preset === i ? { backgroundColor: '#4169E1' } : {}}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date from / to */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Dal *</Label>
                  <Input type="date" value={form.date_from}
                    onChange={e => {
                      const from = e.target.value;
                      const p = PRESETS[preset];
                      const to = p.days >= 0 ? (p.days === 0 ? from : addDays(from, p.days)) : form.date_to;
                      setForm(f => ({ ...f, date_from: from, date_to: to }));
                    }}
                    className="rounded-xl mt-1 text-sm" data-testid="menu-date-from" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Al *</Label>
                  <Input type="date" value={form.date_to} min={form.date_from}
                    onChange={e => { setPreset(4); setForm(f => ({ ...f, date_to: e.target.value })); }}
                    className="rounded-xl mt-1 text-sm" data-testid="menu-date-to" />
                </div>
              </div>

              {/* Info range */}
              {form.date_from && form.date_to && form.date_from !== form.date_to && (
                <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-700 font-medium">
                  📅 Questo menu sarà visibile dal <strong>{formatRange(form.date_from, form.date_to)}</strong>
                </div>
              )}

              {/* Piatti */}
              {[
                { key: 'primo',             label: 'Primo *' },
                { key: 'secondo',           label: 'Secondo *' },
                { key: 'contorno',          label: 'Contorno' },
                { key: 'frutta',            label: 'Frutta' },
                { key: 'merenda_mattina',   label: 'Merenda mattina' },
                { key: 'merenda_pomeriggio',label: 'Merenda pomeriggio' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs font-medium text-gray-600">{label}</Label>
                  <Input value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    data-testid={`menu-${key}-input`}
                    className="rounded-xl mt-1" placeholder={label.replace(' *', '')} />
                </div>
              ))}

              <Button onClick={handleCreate}
                disabled={loading || !form.primo || !form.secondo || !form.date_from}
                className="w-full rounded-2xl font-bold h-11" style={{ backgroundColor: '#4169E1' }}
                data-testid="create-menu-submit">
                {loading ? 'Salvataggio...' : '✓ Pubblica Menu'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
