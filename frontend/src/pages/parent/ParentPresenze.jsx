import { C } from '@/config/tenant';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';

// Vista SOLA LETTURA presenze del figlio per i genitori. Usa activeChildId
// (selettore figlio) → si aggiorna al cambio figlio, nessuna confusione dati.
export default function ParentPresenze() {
  const { user, activeChildId } = useAuth();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  const now  = new Date();
  const mese = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;
    if (!childId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/presenze?student_id=${childId}&mese=${mese}`)
      .then(r => setRows((r.data || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''))))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [user, activeChildId]);

  const presenti = rows.filter(r => r.presente).length;
  const assenti  = rows.length - presenti;

  return (
    <AppLayout title="Presenze" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="parent-presenze-page">
        {/* Riepilogo */}
        <div className="bg-white rounded-2xl p-4 shadow-md">
          <p className="text-sm font-bold capitalize mb-3" style={{ color: '#1A202C', fontFamily: 'Nunito' }}>
            {now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
          </p>
          <div className="flex gap-2">
            <span className="rounded-xl px-3 py-1.5 text-sm font-bold" style={{ backgroundColor: `${C.accentGreen}1a`, color: C.accentGreen }}>
              ✓ {presenti} presenze
            </span>
            <span className="rounded-xl px-3 py-1.5 text-sm font-bold" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
              ✗ {assenti} assenze
            </span>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Caricamento…</p>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md">
            <div className="text-5xl mb-2">🗓️</div>
            <p className="text-sm text-gray-500">Nessuna presenza registrata questo mese</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="parent-presenze-list">
            {rows.map((r, i) => (
              <div key={i} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.presente ? C.accentGreen : '#EF4444' }} />
                <div className="flex-1">
                  <p className="text-sm font-bold capitalize" style={{ color: '#1A202C' }}>
                    {new Date((r.date || '') + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  {!r.presente && !!r.nota && <p className="text-xs text-gray-500 mt-0.5">{r.nota}</p>}
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: r.presente ? `${C.accentGreen}1a` : '#FEE2E2', color: r.presente ? C.accentGreen : '#B91C1C' }}>
                  {r.presente ? 'Presente' : 'Assente'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
