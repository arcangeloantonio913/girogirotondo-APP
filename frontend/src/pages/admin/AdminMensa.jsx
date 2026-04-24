import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UtensilsCrossed, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const EMPTY_FORM = {
  class_id: '',
  date: '',
  primo: '',
  secondo: '',
  contorno: '',
  frutta: '',
  merenda_mattina: '',
  merenda_pomeriggio: '',
};

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
  const [meals, setMeals] = useState([]);
  const [classes, setClasses] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [dateOffset, setDateOffset] = useState(0);

  const getDate = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };
  const currentDate = getDate(dateOffset);
  const dateDisplay = new Date(currentDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  // Ricarica quando cambia la sede attiva o la data
  useEffect(() => {
    loadData();
  }, [currentDate, sede]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/classes').then(res => setClasses(res.data)).catch(() => {});
  }, [sede]);

  const loadData = async () => {
    try {
      const res = await api.get(`/meals?date=${currentDate}`);
      setMeals(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      await api.post('/meals/menu', { ...form, date: currentDate });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeal = async (mealId) => {
    setDeletingId(mealId);
    try {
      await api.delete(`/meals/menu/${mealId}`);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const getClassName = (classId) => classes.find(c => c.id === classId)?.name || 'Tutte le classi';

  return (
    <AppLayout title="Menu della Mensa" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-mensa-page">
        {/* Date Navigation */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setDateOffset(d => d - 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100"
              data-testid="date-prev"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-center">
              <h3 className="text-base font-bold capitalize" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{dateDisplay}</h3>
              <p className="text-xs text-gray-400">{meals.length} menu pubblicati</p>
            </div>
            <button
              onClick={() => setDateOffset(d => d + 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100"
              data-testid="date-next"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5" style={{ color: '#4169E1' }} />
            <span className="text-sm font-bold text-gray-700">Menu del giorno</span>
          </div>
          <Button
            data-testid="add-menu-button"
            onClick={() => setDialogOpen(true)}
            className="rounded-2xl font-semibold h-9 text-sm"
            style={{ backgroundColor: '#4169E1' }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Aggiungi Menu
          </Button>
        </div>

        {/* Lista menu */}
        {meals.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-gray-100">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400 font-medium">Nessun menu per questa giornata</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meals.map((m) => (
              <div key={m.id} data-testid={`meal-${m.id}`} className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#4169E115' }}>
                      <UtensilsCrossed className="w-4 h-4" style={{ color: '#4169E1' }} />
                    </div>
                    <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>
                      {getClassName(m.class_id)}
                    </span>
                  </div>
                  <button
                    data-testid={`delete-meal-${m.id}`}
                    onClick={() => handleDeleteMeal(m.id)}
                    disabled={deletingId === m.id}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    title="Elimina menu"
                  >
                    {deletingId === m.id
                      ? <span className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin inline-block" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MealBadge label="Primo" value={m.primo} />
                  <MealBadge label="Secondo" value={m.secondo} />
                  <MealBadge label="Contorno" value={m.contorno} />
                  <MealBadge label="Frutta" value={m.frutta} />
                  {m.merenda_mattina && <MealBadge label="Merenda mattina" value={m.merenda_mattina} />}
                  {m.merenda_pomeriggio && <MealBadge label="Merenda pomeriggio" value={m.merenda_pomeriggio} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dialog nuovo menu */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-menu-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>
                Nuovo Menu — {new Date(currentDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <Label className="text-xs font-medium text-gray-600">Classe (opzionale)</Label>
                <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
                  <SelectTrigger className="rounded-xl mt-1" data-testid="menu-class-select">
                    <SelectValue placeholder="Tutte le classi" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {[
                { key: 'primo', label: 'Primo' },
                { key: 'secondo', label: 'Secondo' },
                { key: 'contorno', label: 'Contorno' },
                { key: 'frutta', label: 'Frutta' },
                { key: 'merenda_mattina', label: 'Merenda mattina' },
                { key: 'merenda_pomeriggio', label: 'Merenda pomeriggio' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs font-medium text-gray-600">{label}</Label>
                  <Input
                    data-testid={`menu-${key}-input`}
                    value={form[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    className="rounded-xl mt-1"
                    placeholder={label}
                  />
                </div>
              ))}
              <Button
                data-testid="create-menu-submit"
                onClick={handleCreate}
                disabled={loading || !form.primo || !form.secondo}
                className="w-full rounded-2xl font-bold h-11"
                style={{ backgroundColor: '#4169E1' }}
              >
                {loading ? 'Salvataggio...' : 'Pubblica Menu'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
