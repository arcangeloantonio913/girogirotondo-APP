import { C } from '@/config/tenant';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { pickMealForClass } from '@/lib/meals';
import { UtensilsCrossed, Apple, Coffee, Cookie, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ParentAlimentazione() {
  const { user, activeChildId } = useAuth();
  const [meal, setMeal]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [dateOffset, setDateOffset] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);

  // Data LOCALE (non UTC): con toISOString() tra mezzanotte e le 01/02 si leggeva il menu di ieri
  const getDate = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const currentDate = getDate(dateOffset);
  const dateObj     = new Date(currentDate + 'T12:00:00');
  const dateDisplay = dateObj.toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Ricarica quando il genitore torna sulla scheda/app (PWA o TWA lasciata aperta):
  // il menu pubblicato nel frattempo dalla maestra compare senza ricaricare la pagina.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setReloadTick(t => t + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const childId = (activeChildId) || (user?.child_ids && user.child_ids[0]) || user?.child_id;
        // Classe del figlio: se non disponibile si interroga comunque /meals (il backend
        // restituisce i menu autorizzati per il genitore) — prima si usciva e il menu non compariva.
        let classId;
        if (childId) {
          try { classId = (await api.get(`/students/${childId}`)).data?.class_id || undefined; }
          catch { classId = undefined; }
        }
        const mRes = await api.get('/meals', { params: { date: currentDate, ...(classId ? { class_id: classId } : {}) } });
        if (!cancelled) setMeal(pickMealForClass(mRes.data, classId));
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setMeal(null);
          setError(err.response?.data?.detail || 'Impossibile caricare il menu. Riprova.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user, activeChildId, currentDate, reloadTick]); // ← activeChildId nelle deps per fratellini

  const mealItems = meal ? [
    { label: 'Merenda Mattina',    value: meal.merenda_mattina,   icon: Coffee,         color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Primo Piatto',       value: meal.primo,             icon: UtensilsCrossed,color: C.accentPink, bg: C.tintPink },
    { label: 'Secondo Piatto',     value: meal.secondo,           icon: UtensilsCrossed,color: C.primary, bg: C.tintBlue },
    { label: 'Contorno',           value: meal.contorno,          icon: Apple,          color: C.accentGreen, bg: C.tintGreen },
    { label: 'Frutta',             value: meal.frutta,            icon: Apple,          color: '#EF4444', bg: '#FEF2F2' },
    { label: 'Merenda Pomeriggio', value: meal.merenda_pomeriggio,icon: Cookie,         color: '#8B5CF6', bg: '#F5F3FF' },
  ].filter(i => i.value) : [];

  return (
    <AppLayout title="Alimentazione & Dieta" showBack>
      <div className="max-w-lg mx-auto space-y-4" data-testid="parent-alimentazione-page">

        {/* Navigazione data */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <button onClick={() => setDateOffset(d => d - 1)} data-testid="alimentazione-prev-day" aria-label="Giorno precedente"
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-center flex-1">
              <p className="text-base font-bold capitalize" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
                {dateDisplay}
              </p>
              {dateOffset === 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: C.primary }}>
                  Oggi
                </span>
              ) : (
                <button onClick={() => setDateOffset(0)} data-testid="alimentazione-go-today"
                  className="text-[11px] font-bold underline" style={{ color: C.primary }}>
                  Torna a oggi
                </button>
              )}
            </div>
            <button onClick={() => setDateOffset(d => d + 1)} data-testid="alimentazione-next-day" aria-label="Giorno successivo"
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md animate-pulse">
            <UtensilsCrossed className="w-10 h-10 mx-auto text-gray-200 mb-2" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md" data-testid="alimentazione-error">
            <UtensilsCrossed className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 font-medium">{error}</p>
            <button onClick={() => setReloadTick(t => t + 1)} data-testid="alimentazione-retry"
              className="mt-3 px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ backgroundColor: C.primary }}>
              Riprova
            </button>
          </div>
        )}

        {!loading && !error && mealItems.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md">
            <UtensilsCrossed className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 font-medium">Menu non ancora disponibile</p>
            <p className="text-xs text-gray-400 mt-1">
              {dateOffset > 0 ? 'Il menu non è ancora stato inserito' : 'La maestra non ha ancora pubblicato il menu di oggi'}
            </p>
          </div>
        )}

        {!loading && !error && mealItems.length > 0 && (
          <div className="space-y-3" data-testid="meal-list">
            {mealItems.map((item, idx) => (
              <div key={idx} data-testid={`meal-item-${idx}`}
                className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: item.bg }}>
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Nunito' }}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
