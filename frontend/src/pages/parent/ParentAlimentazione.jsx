import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { UtensilsCrossed, Apple, Coffee, Cookie, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

export default function ParentAlimentazione() {
  const { user, activeChildId } = useAuth();
  const [meal, setMeal]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [dateOffset, setDateOffset] = useState(0);

  const getDate = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };

  const currentDate = getDate(dateOffset);
  const dateObj     = new Date(currentDate + 'T12:00:00');
  const dateDisplay = dateObj.toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMeal(null);
      try {
        // Trova la classe del figlio
        const childId = (activeChildId) || (user?.child_ids && user.child_ids[0]) || user?.child_id;
        if (!childId) return;
        const sRes = await api.get(`/students/${childId}`);
        const classId = sRes.data?.class_id;
        if (!classId) return;
        const mRes = await api.get(`/meals?class_id=${classId}&date=${currentDate}`);
        setMeal(mRes.data?.[0] || null);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [user, activeChildId, currentDate]); // ← activeChildId nelle deps per fratellini

  const mealItems = meal ? [
    { label: 'Merenda Mattina',    value: meal.merenda_mattina,   icon: Coffee,         color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Primo Piatto',       value: meal.primo,             icon: UtensilsCrossed,color: '#FF69B4', bg: '#FFF0F7' },
    { label: 'Secondo Piatto',     value: meal.secondo,           icon: UtensilsCrossed,color: '#4169E1', bg: '#EBF0FF' },
    { label: 'Contorno',           value: meal.contorno,          icon: Apple,          color: '#32CD32', bg: '#F0FFF0' },
    { label: 'Frutta',             value: meal.frutta,            icon: Apple,          color: '#EF4444', bg: '#FEF2F2' },
    { label: 'Merenda Pomeriggio', value: meal.merenda_pomeriggio,icon: Cookie,         color: '#8B5CF6', bg: '#F5F3FF' },
  ].filter(i => i.value) : [];

  return (
    <AppLayout title="Alimentazione & Dieta" showBack>
      <div className="max-w-lg mx-auto space-y-4" data-testid="parent-alimentazione-page">

        {/* Navigazione data */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <button onClick={() => setDateOffset(d => d - 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-center flex-1">
              <p className="text-base font-bold capitalize" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
                {dateDisplay}
              </p>
              {dateOffset === 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: '#4169E1' }}>
                  Oggi
                </span>
              )}
            </div>
            <button onClick={() => setDateOffset(d => d + 1)}
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

        {!loading && !meal && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md">
            <UtensilsCrossed className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 font-medium">Menu non ancora disponibile</p>
            <p className="text-xs text-gray-400 mt-1">
              {dateOffset > 0 ? 'Il menu non è ancora stato inserito' : 'La maestra non ha ancora pubblicato il menu di oggi'}
            </p>
          </div>
        )}

        {!loading && meal && (
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
