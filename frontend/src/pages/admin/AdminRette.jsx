import { C } from '@/config/tenant';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Euro, Plus, Trash2, Wallet, BellRing, FileClock, CalendarClock, Download } from 'lucide-react';

const eur = (n) => `€ ${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const STATUS = {
  pagato:    { label: 'Pagato',     bg: `${C.accentGreen}1a`, fg: C.accentGreen },
  parziale:  { label: 'Parziale',   bg: '#FEF3C7', fg: '#B45309' },
  da_pagare: { label: 'Da pagare',  bg: '#EEF2FF', fg: '#4338CA' },
  stornato:  { label: 'Stornato',   bg: '#F3F4F6', fg: '#6B7280' },
};
const METODI = ['bonifico', 'sdd', 'pagopa', 'stripe', 'contanti', 'pos', 'altro'];
const KIND_LABEL = { una_tantum: 'Una tantum', mensile: 'Mensile', annuale: 'Annuale' };

export default function AdminRette() {
  const { sede } = useAuth();
  const [tab, setTab] = useState('addebiti');      // addebiti | piani
  const [kpi, setKpi] = useState(null);
  const [addebiti, setAddebiti] = useState([]);
  const [piani, setPiani] = useState([]);
  const [studMap, setStudMap] = useState({});
  const [period, setPeriod] = useState(thisMonth());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // dialog incasso
  const [payFor, setPayFor] = useState(null);      // addebito su cui incassare
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bonifico');
  // dialog piano
  const [planOpen, setPlanOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planRows, setPlanRows] = useState([{ label: 'Retta mensile', amount: '', kind: 'mensile' }]);

  const studName = (id) => studMap[id] || '—';

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rip, add, pln, stud] = await Promise.all([
        api.get('/rette/riepilogo').then(r => r.data).catch(() => null),
        api.get('/rette/addebiti').then(r => r.data).catch(() => []),
        api.get('/rette/piani').then(r => r.data).catch(() => []),
        api.get('/students').then(r => r.data).catch(() => []),
      ]);
      setKpi(rip);
      setAddebiti((add || []).sort((a, b) => (b.due_date || '').localeCompare(a.due_date || '')));
      setPiani(pln || []);
      const m = {}; (stud || []).forEach(s => { m[s.id] = `${s.name || ''} ${s.cognome || ''}`.trim(); });
      setStudMap(m);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, sede]);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 4000); };

  const generaAddebiti = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.post('/rette/genera-addebiti', { period, due_day: 10 });
      flash(`Addebiti ${period}: ${r.data.creati} creati, ${r.data.saltati} già presenti (${eur(r.data.totale_euro)}).`);
      await load();
    } catch (e) { setError(e.response?.data?.detail || 'Errore nella generazione'); }
    finally { setBusy(false); }
  };

  const inviaSolleciti = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.post('/pagamenti/solleciti');
      flash(`Solleciti: ${r.data.inviati} inviati a ${r.data.famiglie} famiglie.`);
    } catch (e) { setError(e.response?.data?.detail || 'Errore invio solleciti'); }
    finally { setBusy(false); }
  };

  const downloadCsv = async (path, filename) => {
    setError('');
    try {
      const r = await api.get(path, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', filename);
      document.body.appendChild(link); link.click();
      link.remove(); window.URL.revokeObjectURL(url);
    } catch (e) { setError('Errore nel download del file.'); }
  };

  const openPay = (a) => { setPayFor(a); setPayAmount(String(a.residuo ?? a.amount ?? '')); setPayMethod('bonifico'); };
  const salvaIncasso = async () => {
    if (!payFor) return;
    setBusy(true); setError('');
    try {
      await api.post('/pagamenti', { charge_id: payFor.id, amount: Number(payAmount), method: payMethod });
      setPayFor(null); flash('Incasso registrato.'); await load();
    } catch (e) { setError(e.response?.data?.detail || 'Errore registrazione incasso'); }
    finally { setBusy(false); }
  };

  const addPlanRow = () => setPlanRows(r => [...r, { label: '', amount: '', kind: 'mensile' }]);
  const setPlanRow = (i, k, v) => setPlanRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const delPlanRow = (i) => setPlanRows(r => r.filter((_, idx) => idx !== i));
  const salvaPiano = async () => {
    setBusy(true); setError('');
    try {
      const components = planRows
        .filter(r => r.label.trim() && r.amount !== '')
        .map(r => ({ key: r.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'voce',
                     label: r.label.trim(), amount: Number(r.amount), kind: r.kind }));
      await api.post('/rette/piani', { name: planName.trim(), components });
      setPlanOpen(false); setPlanName(''); setPlanRows([{ label: 'Retta mensile', amount: '', kind: 'mensile' }]);
      flash('Piano retta creato.'); await load();
    } catch (e) { setError(e.response?.data?.detail || 'Errore creazione piano'); }
    finally { setBusy(false); }
  };

  const Kpi = ({ label, value, color }) => (
    <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 flex-1 min-w-[120px]">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className="text-xl font-extrabold mt-1" style={{ color, fontFamily: 'Nunito' }}>{value}</p>
    </div>
  );

  return (
    <AppLayout title="Rette e pagamenti" showBack>
      <div className="max-w-3xl mx-auto space-y-4" data-testid="admin-rette-page">

        {/* KPI cassa */}
        <div className="flex flex-wrap gap-3">
          <Kpi label="Dovuto" value={eur(kpi?.totale_dovuto)} color="#1A202C" />
          <Kpi label="Incassato" value={eur(kpi?.totale_incassato)} color={C.accentGreen} />
          <Kpi label="Residuo" value={eur(kpi?.totale_residuo)} color={C.primary} />
          <Kpi label="Scaduto" value={eur(kpi?.totale_scaduto)} color="#DC2626" />
        </div>

        {/* Azioni rapide */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-gray-500">Mese</Label>
            <Input type="month" value={period} onChange={e => setPeriod(e.target.value)}
              className="rounded-xl h-9 w-40" data-testid="rette-period-input" />
          </div>
          <Button onClick={generaAddebiti} disabled={busy}
            className="rounded-2xl font-semibold h-9 text-sm" style={{ backgroundColor: C.primary }}
            data-testid="genera-addebiti-button">
            <CalendarClock className="w-4 h-4 mr-1" />Genera addebiti del mese
          </Button>
          <Button onClick={inviaSolleciti} disabled={busy} variant="outline"
            className="rounded-2xl font-semibold h-9 text-sm" data-testid="solleciti-button">
            <BellRing className="w-4 h-4 mr-1" />Invia solleciti
          </Button>
        </div>

        {msg && <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: `${C.accentGreen}1a`, color: '#166534' }} data-testid="rette-msg">{msg}</p>}
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2" data-testid="rette-error">{error}</p>}

        {/* Export CSV */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-4 h-4" style={{ color: C.primary }} />
            <span className="text-sm font-bold text-gray-700">Esporta per segreteria / commercialista</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['/export/addebiti.csv', 'addebiti.csv', 'Addebiti'],
              ['/export/pagamenti.csv', 'pagamenti.csv', 'Pagamenti'],
              ['/export/anagrafiche.csv', 'anagrafiche.csv', 'Anagrafiche'],
              ['/export/sidi-alunni.csv', 'sidi-alunni.csv', 'Anagrafe SIDI'],
            ].map(([path, file, label]) => (
              <Button key={path} onClick={() => downloadCsv(path, file)} variant="outline"
                className="rounded-2xl font-semibold h-9 text-sm" data-testid={`export-${file}`}>
                <Download className="w-4 h-4 mr-1" />{label}
              </Button>
            ))}
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex gap-2">
          {[['addebiti', 'Addebiti', Wallet], ['piani', 'Piani retta', FileClock]].map(([k, lbl, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className="rounded-2xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5"
              style={tab === k ? { backgroundColor: C.primary, color: '#fff' } : { backgroundColor: '#fff', color: '#4B5563', border: '1px solid #E5E7EB' }}
              data-testid={`rette-tab-${k}`}>
              <Icon className="w-4 h-4" />{lbl}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Caricamento…</p>
        ) : tab === 'addebiti' ? (
          addebiti.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-gray-100">
              <Euro className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400 font-medium">Nessun addebito</p>
              <p className="text-xs text-gray-400 mt-1">Crea un piano retta, assegnalo ai bambini e genera gli addebiti del mese.</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="addebiti-list">
              {addebiti.map(a => {
                const st = a.scaduto ? { label: 'Scaduto', bg: '#FEE2E2', fg: '#B91C1C' } : (STATUS[a.status] || STATUS.da_pagare);
                return (
                  <div key={a.id} data-testid={`addebito-${a.id}`}
                    className="bg-white rounded-2xl shadow-sm p-3.5 border border-gray-100 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: '#1A202C' }}>{studName(a.student_id)}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {a.description} · {a.period === 'una_tantum' ? 'una tantum' : a.period}
                        {a.due_date ? ` · scad. ${a.due_date}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-extrabold" style={{ color: '#1A202C' }}>{eur(a.amount)}</p>
                      {Number(a.paid_amount) > 0 && a.status !== 'pagato' &&
                        <p className="text-[11px] text-gray-400">incassato {eur(a.paid_amount)}</p>}
                    </div>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold flex-shrink-0" style={{ backgroundColor: st.bg, color: st.fg }}>{st.label}</span>
                    {a.status !== 'pagato' && a.status !== 'stornato' && (
                      <Button onClick={() => openPay(a)} size="sm"
                        className="rounded-xl h-8 text-xs font-semibold flex-shrink-0" style={{ backgroundColor: C.accentGreen }}
                        data-testid={`incassa-${a.id}`}>Incassa</Button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <>
            <div className="flex justify-end">
              <Button onClick={() => setPlanOpen(true)}
                className="rounded-2xl font-semibold h-9 text-sm" style={{ backgroundColor: C.primary }}
                data-testid="add-piano-button"><Plus className="w-4 h-4 mr-1" />Nuovo piano</Button>
            </div>
            {piani.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-gray-100">
                <FileClock className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm text-gray-400 font-medium">Nessun piano retta</p>
              </div>
            ) : (
              <div className="space-y-2" data-testid="piani-list">
                {piani.map(p => (
                  <div key={p.id} data-testid={`piano-${p.id}`} className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
                    <p className="text-sm font-bold" style={{ color: '#1A202C', fontFamily: 'Nunito' }}>{p.name}</p>
                    <div className="mt-2 space-y-1">
                      {(p.components || []).map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-gray-600">
                          <span>{c.label} <span className="text-gray-400">· {KIND_LABEL[c.kind] || c.kind}{c.optional ? ' · opzionale' : ''}</span></span>
                          <span className="font-semibold">{eur(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialog incasso */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent data-testid="incasso-dialog">
          <DialogHeader><DialogTitle>Registra incasso</DialogTitle></DialogHeader>
          {payFor && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">{studName(payFor.student_id)} — {payFor.description} ({payFor.period})</p>
              <div>
                <Label className="text-xs text-gray-500">Importo (€)</Label>
                <Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="rounded-xl h-9" data-testid="incasso-amount" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Metodo</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger className="rounded-xl h-9" data-testid="incasso-method"><SelectValue /></SelectTrigger>
                  <SelectContent>{METODI.map(m => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setPayFor(null)}>Annulla</Button>
            <Button className="rounded-2xl font-semibold" style={{ backgroundColor: C.accentGreen }}
              disabled={busy || !payAmount} onClick={salvaIncasso} data-testid="incasso-submit">Registra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog nuovo piano */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent data-testid="piano-dialog">
          <DialogHeader><DialogTitle>Nuovo piano retta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500">Nome del piano</Label>
              <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Es. Tempo pieno"
                className="rounded-xl h-9" data-testid="piano-name" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Voci</Label>
              {planRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2" data-testid={`piano-row-${i}`}>
                  <Input value={row.label} onChange={e => setPlanRow(i, 'label', e.target.value)} placeholder="Voce (es. Mensa)"
                    className="rounded-xl h-9 flex-1" />
                  <Input type="number" step="0.01" value={row.amount} onChange={e => setPlanRow(i, 'amount', e.target.value)}
                    placeholder="€" className="rounded-xl h-9 w-20" />
                  <Select value={row.kind} onValueChange={v => setPlanRow(i, 'kind', v)}>
                    <SelectTrigger className="rounded-xl h-9 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensile">Mensile</SelectItem>
                      <SelectItem value="una_tantum">Una tantum</SelectItem>
                      <SelectItem value="annuale">Annuale</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={() => delPlanRow(i)} className="text-gray-300 hover:text-red-500" data-testid={`piano-del-row-${i}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button onClick={addPlanRow} className="text-xs font-semibold flex items-center gap-1" style={{ color: C.primary }} data-testid="piano-add-row">
                <Plus className="w-3.5 h-3.5" />Aggiungi voce
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setPlanOpen(false)}>Annulla</Button>
            <Button className="rounded-2xl font-semibold" style={{ backgroundColor: C.primary }}
              disabled={busy || !planName.trim()} onClick={salvaPiano} data-testid="piano-submit">Salva piano</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
