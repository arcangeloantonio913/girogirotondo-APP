import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';

const QUANTITA_LABELS = {
  tutto: { label: 'Tutto',  bg: '#DCFCE7', text: '#166534' },
  molta: { label: 'Molta',  bg: '#D1FAE5', text: '#065F46' },
  metà:  { label: 'Metà',   bg: '#FEF9C3', text: '#854D0E' },
  poca:  { label: 'Poca',   bg: '#FEE2E2', text: '#991B1B' },
};

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
    <p className="text-xs text-gray-400 mt-1">La maestra non ha ancora compilato la griglia.</p>
  </div>
);

function QuantitaBadge({ active, qty, activeColor }) {
  if (!active && !qty) {
    return <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400">Non mangiato</span>;
  }
  if (qty && QUANTITA_LABELS[qty]) {
    const q = QUANTITA_LABELS[qty];
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: q.bg, color: q.text }}>
        {q.label}
      </span>
    );
  }
  // Legacy: boolean true senza qty
  return <span className="text-xs font-bold px-2.5 py-1 rounded-lg text-white" style={{ backgroundColor: activeColor }}>Sì</span>;
}

export default function ParentGriglia() {
  const { user, activeChildId } = useAuth();
  const [griglia, setGriglia] = useState(null);
  const [child, setChild] = useState(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const primaryChildId = activeChildId || (user?.child_ids && user.child_ids[0]) || user?.child_id;
    if (!primaryChildId) return;
    Promise.all([
      api.get(`/griglia?student_id=${primaryChildId}&date=${today}`),
      api.get(`/students/${primaryChildId}`),
    ]).then(([gRes, cRes]) => {
      setGriglia(gRes.data?.[0] || null);
      setChild(cRes.data);
    });
  }, [user, today]);

  const timelineItems = griglia ? [
    { time: '12:00', label: 'Pasta',    active: griglia.pasta,    qty: griglia.pasta_qty,   color: '#F4C2C2' },
    { time: '12:10', label: 'Secondo',  active: griglia.secondo,  qty: griglia.secondo_qty, color: '#A7C7E7' },
    { time: '12:20', label: 'Pane',     active: griglia.pane,     qty: griglia.pane_qty,    color: '#FFD699' },
    { time: '12:30', label: 'Frutta',   active: griglia.frutta,   qty: griglia.frutta_qty,  color: '#98FB98' },
    { time: '15:30', label: 'Merenda',  active: griglia.merenda,  qty: griglia.merenda_qty, color: '#FFB347' },
    { time: '',      label: 'Pupù',     active: griglia.pupu,     qty: null,                color: '#D4B8E0' },
  ] : [];

  return (
    <AppLayout title="Griglia Giornaliera" showBack>
      <div className="max-w-lg mx-auto" data-testid="parent-griglia-page">

        {/* Intestazione bambino */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
                {child?.name || 'Caricamento...'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {new Date(today + 'T12:00:00').toLocaleDateString('it-IT', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: '#F4C2C2' }}>
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
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border-2"
                    style={{
                      borderColor: item.active ? item.color : '#E5E7EB',
                      backgroundColor: item.active ? `${item.color}30` : '#F9FAFB'
                    }}>
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
                        <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Nunito' }}>
                          {item.label}
                        </p>
                        {item.time && <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>}
                      </div>
                      {/* Per il pupù usa Si/No, per i pasti usa la quantità */}
                      {item.label === 'Pupù' ? (
                        item.active
                          ? <span className="text-xs font-bold px-2.5 py-1 rounded-lg text-white" style={{ backgroundColor: item.color }}>Sì</span>
                          : <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400">No</span>
                      ) : (
                        <QuantitaBadge active={item.active} qty={item.qty} activeColor={item.color} />
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

        {/* GDPR Footer */}
        <div className="mt-6 p-3 rounded-xl text-center" style={{ backgroundColor: '#F9FAFB' }}>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            🔒 I dati del registro pasti sono trattati nel rispetto del GDPR e della privacy del minore.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
