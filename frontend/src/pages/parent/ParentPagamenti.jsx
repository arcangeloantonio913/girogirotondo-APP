import { C } from '@/config/tenant';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { FileCheck2, Receipt } from 'lucide-react';

const eur = (n) => `€ ${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS = {
  pagato:    { label: 'Pagato',    bg: `${C.accentGreen}1a`, fg: C.accentGreen },
  parziale:  { label: 'Parziale',  bg: '#FEF3C7', fg: '#B45309' },
  da_pagare: { label: 'Da pagare', bg: '#EEF2FF', fg: '#4338CA' },
  stornato:  { label: 'Stornato',  bg: '#F3F4F6', fg: '#6B7280' },
};

export default function ParentPagamenti() {
  const { user, activeChildId } = useAuth();
  const childId = activeChildId || user?.child_ids?.[0] || user?.child_id;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [cert, setCert] = useState(null);
  const [certLoading, setCertLoading] = useState(false);

  const load = useCallback(() => {
    if (!childId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/rette/addebiti?student_id=${childId}`)
      .then(r => setRows((r.data || []).sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''))))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [childId]);

  useEffect(() => { load(); setCert(null); }, [load]);

  const residuo = rows
    .filter(r => r.status !== 'pagato' && r.status !== 'stornato')
    .reduce((s, r) => s + Number(r.residuo ?? r.amount ?? 0), 0);

  const scaricaCertificazione = () => {
    if (!childId) return;
    setCertLoading(true);
    api.get(`/pagamenti/certificazione/${childId}?anno=${anno}`)
      .then(r => setCert(r.data))
      .catch(() => setCert({ errore: true }))
      .finally(() => setCertLoading(false));
  };

  return (
    <AppLayout title="Pagamenti" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="parent-pagamenti-page">

        {/* Riepilogo */}
        <div className="bg-white rounded-2xl p-4 shadow-md">
          <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">Da versare</p>
          <p className="text-2xl font-extrabold" style={{ color: residuo > 0 ? C.primary : C.accentGreen, fontFamily: 'Nunito' }}>
            {eur(residuo)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {residuo > 0 ? 'Totale ancora da pagare' : 'Sei in regola con i pagamenti ✓'}
          </p>
        </div>

        {/* Scadenzario */}
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Caricamento…</p>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md">
            <Receipt className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-500">Nessun pagamento registrato</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="parent-pagamenti-list">
            {rows.map(a => {
              const st = a.scaduto ? { label: 'Scaduto', bg: '#FEE2E2', fg: '#B91C1C' } : (STATUS[a.status] || STATUS.da_pagare);
              return (
                <div key={a.id} data-testid={`parent-addebito-${a.id}`}
                  className="bg-white rounded-xl p-3.5 shadow-sm flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: '#1A202C' }}>{a.description}</p>
                    <p className="text-xs text-gray-500">
                      {a.period === 'una_tantum' ? 'Una tantum' : a.period}{a.due_date ? ` · scadenza ${a.due_date}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-extrabold flex-shrink-0" style={{ color: '#1A202C' }}>{eur(a.amount)}</p>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-bold flex-shrink-0" style={{ backgroundColor: st.bg, color: st.fg }}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Certificazione 730 */}
        <div className="bg-white rounded-2xl p-4 shadow-md" data-testid="certificazione-box">
          <div className="flex items-center gap-2 mb-2">
            <FileCheck2 className="w-5 h-5" style={{ color: C.primary }} />
            <p className="text-sm font-bold" style={{ color: '#1A202C', fontFamily: 'Nunito' }}>Certificazione pagamenti (730)</p>
          </div>
          <p className="text-xs text-gray-500 mb-3">Il riepilogo dei versamenti dell'anno, utile per la detrazione fiscale.</p>
          <div className="flex items-center gap-2">
            <select value={anno} onChange={e => setAnno(Number(e.target.value))}
              className="rounded-xl h-9 px-3 text-sm border border-gray-200" data-testid="cert-anno">
              {[0, 1, 2].map(i => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
            </select>
            <Button onClick={scaricaCertificazione} disabled={certLoading}
              className="rounded-2xl font-semibold h-9 text-sm" style={{ backgroundColor: C.primary }}
              data-testid="cert-button">
              {certLoading ? 'Calcolo…' : 'Mostra riepilogo'}
            </Button>
          </div>

          {cert && !cert.errore && (
            <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: `${C.accentGreen}12` }} data-testid="cert-result">
              <p className="text-sm">Anno <strong>{cert.anno}</strong>: versati{' '}
                <strong style={{ color: C.accentGreen }}>{eur(cert.totale_versato)}</strong>{' '}
                in {cert.numero_versamenti} versament{cert.numero_versamenti === 1 ? 'o' : 'i'}.</p>
            </div>
          )}
          {cert && cert.errore && (
            <p className="mt-3 text-xs text-red-600" data-testid="cert-error">Impossibile calcolare la certificazione.</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
