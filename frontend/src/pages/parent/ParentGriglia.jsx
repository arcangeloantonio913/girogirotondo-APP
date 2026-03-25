import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { CheckCircle2, XCircle, Moon, UtensilsCrossed, Cookie, Bath, ClipboardList } from 'lucide-react';

export default function ParentGriglia() {
  const { user } = useAuth();
  const [griglia, setGriglia] = useState(null);
  const [child, setChild] = useState(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user?.child_id) return;
    Promise.all([
      api.get(`/griglia?student_id=${user.child_id}&date=${today}`),
      api.get(`/students/${user.child_id}`),
    ]).then(([gRes, cRes]) => {
      setGriglia(gRes.data?.[0] || null);
      setChild(cRes.data);
    });
  }, [user, today]);

  const timelineItems = griglia ? [
    { time: '08:30', label: 'Presenza', icon: CheckCircle2, active: griglia.presence, color: '#32CD32' },
    { time: '09:30', label: 'Merenda Mattina', icon: Cookie, active: griglia.snack, color: '#F59E0B' },
    { time: '10:30', label: 'Bagno', icon: Bath, active: griglia.bathroom, color: '#4169E1' },
    { time: '12:00', label: 'Primo Piatto', icon: UtensilsCrossed, active: griglia.meal_first, color: '#FF69B4' },
    { time: '12:30', label: 'Secondo Piatto', icon: UtensilsCrossed, active: griglia.meal_second, color: '#FF69B4' },
    { time: '13:30', label: 'Riposo', icon: Moon, active: griglia.sleep, color: '#8B5CF6' },
  ] : [];

  return (
    <AppLayout title="Griglia Giornaliera" showBack>
      <div className="max-w-lg mx-auto" data-testid="parent-griglia-page">
        {/* Date & Child Header */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5 border border-gray-100 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{child?.name || 'Caricamento...'}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{new Date(today).toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#FF69B4' }}>
              {child?.name?.charAt(0) || '?'}
            </div>
          </div>
        </div>

        {!griglia ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Dati non ancora disponibili per oggi</p>
          </div>
        ) : (
          <div className="space-y-0" data-testid="griglia-timeline">
            {timelineItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4" data-testid={`timeline-item-${idx}`}>
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border-2" style={{ borderColor: item.active ? item.color : '#E5E7EB', backgroundColor: item.active ? `${item.color}15` : '#F9FAFB' }}>
                    <item.icon className="w-5 h-5" style={{ color: item.active ? item.color : '#D1D5DB' }} />
                  </div>
                  {idx < timelineItems.length - 1 && (
                    <div className="w-0.5 h-8 my-1" style={{ backgroundColor: '#E5E7EB' }} />
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="bg-white rounded-xl p-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Nunito' }}>{item.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                      </div>
                      {item.active ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: `${item.color}15`, color: item.color }}>Si</span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-400">No</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Notes */}
            {griglia.notes && (
              <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 border border-gray-100 mt-4" data-testid="griglia-notes">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Note della Maestra</h4>
                <p className="text-sm text-gray-700 leading-relaxed">{griglia.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
