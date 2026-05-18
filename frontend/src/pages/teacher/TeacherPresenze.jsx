import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  Save, Users, BarChart2, Calendar, BookOpen,
} from 'lucide-react';

const TAB_OGGI    = 'oggi';
const TAB_MESE    = 'mese';
const TAB_ANNO    = 'anno';

const MESE_NOMI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function pad(n) { return String(n).padStart(2, '0'); }

export default function TeacherPresenze() {
  const { user } = useAuth();

  const primaryClassId = (user?.class_ids?.[0]) || user?.class_id;

  const [tab, setTab]           = useState(TAB_OGGI);
  const [students, setStudents] = useState([]);
  const [className, setClassName] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  // ── Stato OGGI ────────────────────────────────────────────────────────────
  const [dateOffset, setDateOffset] = useState(0);
  const [presenze, setPresenze]     = useState({}); // { student_id: { presente, nota } }

  const getDate = (offset = 0) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };
  const currentDate = getDate(dateOffset);
  const dateDisplay = new Date(currentDate + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // ── Stato ARCHIVIO ────────────────────────────────────────────────────────
  const now = new Date();
  const [archMese, setArchMese] = useState(now.getMonth());
  const [archAnno, setArchAnno] = useState(now.getFullYear());
  const [archData, setArchData] = useState([]);  // records raw
  const [archLoading, setArchLoading] = useState(false);

  // ── Carica studenti e classe ──────────────────────────────────────────────
  useEffect(() => {
    if (!primaryClassId) return;
    api.get('/students').then(r => setStudents(r.data));
    api.get('/classes').then(r => {
      const cls = r.data.find(c => c.id === primaryClassId);
      if (cls) setClassName(cls.name);
    });
  }, [user]); // eslint-disable-line

  // ── Carica presenze del giorno ────────────────────────────────────────────
  useEffect(() => {
    if (!primaryClassId || !students.length) return;
    api.get(`/presenze?class_id=${primaryClassId}&date=${currentDate}`).then(r => {
      const p = {};
      students.forEach(s => { p[s.id] = { presente: true, nota: '' }; });
      r.data.forEach(rec => {
        p[rec.student_id] = { presente: rec.presente, nota: rec.nota || '' };
      });
      setPresenze(p);
    });
  }, [currentDate, students.length, primaryClassId]); // eslint-disable-line

  // ── Toggle presenza ───────────────────────────────────────────────────────
  const toggle = (sid) => {
    setPresenze(prev => ({
      ...prev,
      [sid]: { ...prev[sid], presente: !prev[sid]?.presente }
    }));
  };

  // ── Seleziona tutti presenti / tutti assenti ──────────────────────────────
  const setAll = (presente) => {
    const p = {};
    students.forEach(s => { p[s.id] = { presente, nota: presenze[s.id]?.nota || '' }; });
    setPresenze(p);
  };

  // ── Salva ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/presenze', {
        class_id: primaryClassId,
        date:     currentDate,
        records:  students.map(s => ({
          student_id: s.id,
          presente:   presenze[s.id]?.presente ?? true,
          nota:       presenze[s.id]?.nota || '',
        })),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // ── Carica archivio ───────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === TAB_OGGI || !primaryClassId) return;
    setArchLoading(true);
    const query = tab === TAB_MESE
      ? `mese=${archAnno}-${pad(archMese + 1)}`
      : `anno=${archAnno}`;
    api.get(`/presenze?class_id=${primaryClassId}&${query}`)
      .then(r => setArchData(r.data))
      .catch(console.error)
      .finally(() => setArchLoading(false));
  }, [tab, archMese, archAnno, primaryClassId]); // eslint-disable-line

  // Raggruppa records per data
  const byDate = archData.reduce((acc, r) => {
    (acc[r.date] = acc[r.date] || []).push(r);
    return acc;
  }, {});

  const presentiCount = students.filter(s => presenze[s.id]?.presente !== false).length;
  const assentiCount  = students.length - presentiCount;

  // Nessuna classe assegnata → messaggio di errore
  if (!primaryClassId) {
    return (
      <AppLayout title="Registro Presenze" showBack>
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-orange-100">
            <BookOpen className="w-12 h-12 mx-auto text-orange-300 mb-3" />
            <p className="text-sm font-bold text-gray-700" style={{ fontFamily: 'Nunito' }}>
              Nessuna classe assegnata
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Contatta l'amministrazione per associare la tua classe al tuo account.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Registro Presenze" showBack>
      <div className="max-w-lg mx-auto space-y-4" data-testid="teacher-presenze-page">

        {/* Header classe */}
        <div className="bg-white rounded-2xl shadow-md px-5 py-4 border border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FF69B415' }}>
            <BookOpen className="w-5 h-5" style={{ color: '#FF69B4' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>
              {className || 'La mia classe'}
            </p>
            <p className="text-xs text-gray-400">{students.length} alunni registrati</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 p-1 bg-white rounded-2xl shadow-md" data-testid="presenze-tabs">
          {[
            { key: TAB_OGGI, label: 'Oggi', icon: CheckCircle2 },
            { key: TAB_MESE, label: 'Archivio Mese', icon: Calendar },
            { key: TAB_ANNO, label: 'Archivio Anno', icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${tab === key ? 'text-white shadow-sm' : 'text-gray-500'}`}
              style={tab === key ? { backgroundColor: '#FF69B4' } : {}}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* ── TAB OGGI ──────────────────────────────────────────────────── */}
        {tab === TAB_OGGI && (
          <>
            {/* Navigazione data */}
            <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <button onClick={() => setDateOffset(d => d - 1)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100">
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="text-center">
                  <p className="text-sm font-bold capitalize" style={{ fontFamily: 'Nunito' }}>{dateDisplay}</p>
                  {saved && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                      style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>✓ Salvato!</span>
                  )}
                </div>
                <button onClick={() => setDateOffset(d => d + 1)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100">
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              {/* Contatori */}
              <div className="flex gap-3 mt-3">
                <div className="flex-1 text-center py-2 rounded-xl" style={{ backgroundColor: '#DCFCE7' }}>
                  <p className="text-lg font-bold" style={{ color: '#166534' }}>{presentiCount}</p>
                  <p className="text-[10px] font-semibold text-gray-500">Presenti</p>
                </div>
                <div className="flex-1 text-center py-2 rounded-xl" style={{ backgroundColor: '#FEE2E2' }}>
                  <p className="text-lg font-bold" style={{ color: '#991B1B' }}>{assentiCount}</p>
                  <p className="text-[10px] font-semibold text-gray-500">Assenti</p>
                </div>
                <div className="flex-1 text-center py-2 rounded-xl bg-gray-50">
                  <p className="text-lg font-bold text-gray-600">{students.length}</p>
                  <p className="text-[10px] font-semibold text-gray-500">Totale</p>
                </div>
              </div>
            </div>

            {/* Azioni rapide */}
            <div className="flex gap-2">
              <button onClick={() => setAll(true)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors"
                style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>
                ✓ Tutti presenti
              </button>
              <button onClick={() => setAll(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors"
                style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                ✗ Tutti assenti
              </button>
            </div>

            {/* Lista studenti */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 divide-y divide-gray-50" data-testid="presenze-list">
              {students.map(s => {
                const presente = presenze[s.id]?.presente !== false;
                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3"
                    data-testid={`presenza-row-${s.id}`}>
                    <button onClick={() => toggle(s.id)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ backgroundColor: presente ? '#DCFCE7' : '#FEE2E2' }}>
                      {presente
                        ? <CheckCircle2 className="w-5 h-5" style={{ color: '#22C55E' }} />
                        : <XCircle     className="w-5 h-5" style={{ color: '#EF4444' }} />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {s.name} <span className="font-normal text-gray-600">{s.cognome || ''}</span>
                      </p>
                      <p className={`text-xs font-medium ${presente ? 'text-green-600' : 'text-red-500'}`}>
                        {presente ? 'Presente' : 'Assente'}
                      </p>
                    </div>
                    <input
                      type="text"
                      placeholder="Nota..."
                      value={presenze[s.id]?.nota || ''}
                      onChange={e => setPresenze(prev => ({
                        ...prev,
                        [s.id]: { ...prev[s.id], nota: e.target.value }
                      }))}
                      className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pink-200"
                    />
                  </div>
                );
              })}
            </div>

            {/* Salva */}
            <Button onClick={handleSave} disabled={saving}
              className="w-full rounded-2xl font-bold h-12 text-base shadow-md"
              style={{ backgroundColor: '#FF69B4', color: 'white' }}
              data-testid="save-presenze-btn">
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Salvataggio...' : 'Salva Registro'}
            </Button>
          </>
        )}

        {/* ── TAB ARCHIVIO MESE ─────────────────────────────────────────── */}
        {tab === TAB_MESE && (
          <>
            {/* Navigazione mese */}
            <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 flex items-center justify-between">
              <button onClick={() => {
                if (archMese === 0) { setArchMese(11); setArchAnno(y => y - 1); }
                else setArchMese(m => m - 1);
              }} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <p className="text-sm font-bold" style={{ fontFamily: 'Nunito' }}>
                {MESE_NOMI[archMese]} {archAnno}
              </p>
              <button onClick={() => {
                if (archMese === 11) { setArchMese(0); setArchAnno(y => y + 1); }
                else setArchMese(m => m + 1);
              }} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <ArchivioTabella byDate={byDate} students={students} loading={archLoading} />
          </>
        )}

        {/* ── TAB ARCHIVIO ANNO ─────────────────────────────────────────── */}
        {tab === TAB_ANNO && (
          <>
            <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 flex items-center justify-between">
              <button onClick={() => setArchAnno(y => y - 1)}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <p className="text-sm font-bold" style={{ fontFamily: 'Nunito' }}>Anno {archAnno}</p>
              <button onClick={() => setArchAnno(y => y + 1)}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <ArchivioTabella byDate={byDate} students={students} loading={archLoading} showMonth />
          </>
        )}
      </div>
    </AppLayout>
  );
}

/* ─────────────────────────────────────────────────────────
   Tabella archivio condivisa tra mese e anno
───────────────────────────────────────────────────────── */
function ArchivioTabella({ byDate, students, loading, showMonth = false }) {
  if (loading) return (
    <div className="bg-white rounded-2xl shadow-md p-8 text-center">
      <p className="text-sm text-gray-400 animate-pulse">Caricamento...</p>
    </div>
  );
  const dates = Object.keys(byDate).sort();
  if (!dates.length) return (
    <div className="bg-white rounded-2xl shadow-md p-8 text-center">
      <Calendar className="w-10 h-10 mx-auto text-gray-200 mb-2" />
      <p className="text-sm text-gray-400">Nessun registro trovato per questo periodo</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden" data-testid="archivio-tabella">
      {dates.map(date => {
        const recs = byDate[date];
        const presenti = recs.filter(r => r.presente).length;
        const assenti  = recs.length - presenti;
        const label    = new Date(date + 'T12:00:00').toLocaleDateString('it-IT', {
          weekday: 'short', day: '2-digit', month: showMonth ? 'long' : 'short'
        });
        return (
          <div key={date} className="px-4 py-3 border-b border-gray-50 last:border-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-700 capitalize">{label}</p>
              <div className="flex gap-2 text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>
                  {presenti} pres.
                </span>
                <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                  {assenti} ass.
                </span>
              </div>
            </div>
            {/* Assenti con nota */}
            {recs.filter(r => !r.presente).map(r => {
              const s = students.find(st => st.id === r.student_id);
              return (
                <div key={r.student_id} className="flex items-center gap-2 mt-1">
                  <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                  <span className="text-xs text-red-600 font-medium">{s?.name || r.student_id}</span>
                  {r.nota && <span className="text-[10px] text-gray-400 italic">— {r.nota}</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
