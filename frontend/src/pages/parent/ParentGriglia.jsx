import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { ClipboardList } from 'lucide-react';

const EmptyBearTimeline = () => (
  <div className="bg-white rounded-2xl p-8 text-center shadow-md">
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto mb-3">
      <circle cx="32" cy="36" r="18" fill="#F4C2C2"/>
      <circle cx="18" cy="20" r="8" fill="#F4C2C2"/><circle cx="46" cy="20" r="8" fill="#F4C2C2"/>
      <circle cx="18" cy="20" r="5" fill="#FFFDD0"/><circle cx="46" cy="20" r="5" fill="#FFFDD0"/>
      <circle cx="26" cy="32" r="2" fill="#555"/><circle cx="38" cy="32" r="2" fill="#555"/>
      <ellipse cx="32" cy="38" rx="3" ry="2" fill="#555"/>
      <path d="M26 42c0 0 3 3 6 3s6-3 6-3" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    <p className="text-sm text-gray-500 font-medium">Dati non ancora disponibili per oggi!</p>
  </div>
);

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
    { time: '08:00', label: 'Colazione', active: griglia.colazione, color: '#F4C2C2' },
    { time: '10:00', label: 'Frutta', active: griglia.frutta, color: '#98FB98' },
    { time: '12:00', label: 'Pranzo', active: griglia.pranzo, color: '#A7C7E7' },
    { time: '13:30', label: 'Pisolino', active: griglia.pisolino, color: '#D4B8E0' },
    { time: '15:30', label: 'Merenda', active: griglia.merenda, color: '#FFD699' },
    { time: '', label: 'Cacca', active: griglia.cacca, color: '#B8D4E3' },
  ] : [];

  return (
    <AppLayout title="Griglia Giornaliera" showBack>
      <div className="max-w-lg mx-auto" data-testid="parent-griglia-page">
        {/* Date & Child Header */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{child?.name || 'Caricamento...'}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{new Date(today).toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#F4C2C2' }}>
              {child?.name?.charAt(0) || '?'}
            </div>
          </div>
        </div>

        {!griglia ? (
          <EmptyBearTimeline />
        ) : (
          <div className="space-y-0" data-testid="griglia-timeline">
            {timelineItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4" data-testid={`timeline-item-${idx}`}>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border-2" style={{ borderColor: item.active ? item.color : '#E5E7EB', backgroundColor: item.active ? `${item.color}30` : '#F9FAFB' }}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.active ? item.color : '#E5E7EB' }} />
                  </div>
                  {idx < timelineItems.length - 1 && (
                    <div className="w-0.5 h-8 my-1" style={{ backgroundColor: '#E5E7EB' }} />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="bg-white rounded-xl p-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Nunito' }}>{item.label}</p>
                        {item.time && <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>}
                      </div>
                      {item.active ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg text-white" style={{ backgroundColor: item.color }}>Si</span>
                      ) : (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400">No</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {griglia.notes && (
              <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 mt-4" data-testid="griglia-notes">
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
