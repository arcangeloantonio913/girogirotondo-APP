import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { UtensilsCrossed, Apple, Coffee, Cookie } from 'lucide-react';

export default function ParentAlimentazione() {
  const { user } = useAuth();
  const [meal, setMeal] = useState(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (user?.class_id) {
      api.get(`/meals?class_id=${user.class_id}&date=${today}`).then(res => setMeal(res.data?.[0] || null));
    }
  }, [user, today]);

  const mealItems = meal ? [
    { label: 'Merenda Mattina', value: meal.merenda_mattina, icon: Coffee, color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Primo Piatto', value: meal.primo, icon: UtensilsCrossed, color: '#FF69B4', bg: '#FFF0F7' },
    { label: 'Secondo Piatto', value: meal.secondo, icon: UtensilsCrossed, color: '#4169E1', bg: '#EBF0FF' },
    { label: 'Contorno', value: meal.contorno, icon: Apple, color: '#32CD32', bg: '#F0FFF0' },
    { label: 'Frutta', value: meal.frutta, icon: Apple, color: '#EF4444', bg: '#FEF2F2' },
    { label: 'Merenda Pomeriggio', value: meal.merenda_pomeriggio, icon: Cookie, color: '#8B5CF6', bg: '#F5F3FF' },
  ] : [];

  return (
    <AppLayout title="Alimentazione" showBack>
      <div className="max-w-lg mx-auto" data-testid="parent-alimentazione-page">
        {/* Date Header */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5 border border-gray-100 mb-4">
          <h3 className="text-base font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>Menu del Giorno</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(today).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {!meal ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <UtensilsCrossed className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Menu non ancora disponibile</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="meal-list">
            {mealItems.map((item, idx) => (
              <div
                key={idx}
                data-testid={`meal-item-${idx}`}
                className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 border border-gray-100 flex items-center gap-4"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.bg }}>
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
