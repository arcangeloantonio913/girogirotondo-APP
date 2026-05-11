import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, BarChart2, Calendar, Users, BookOpen } from 'lucide-react';

const TAB_OGGI = 'oggi';
const TAB_MESE = 'mese';
const TAB_ANNO = 'anno';
const MESE_NOMI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
function pad(n) { return String(n).padStart(2,'0'); }

export default function AdminPresenze() {
  const { sede } = useAuth();

  const [tab, setTab]             = useState(TAB_OGGI);
  const [classes, setClasses]     = useState([]);
  const [students, setStudents]   = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading]     = useState(false);

  // Oggi
  const today = new Date().toISOString().split('T')[0];
  const [viewDate, setViewDate]   = useState(today);
  const [daySummary, setDaySummary] = useState(null);  // { date, classes: {classId: {presenti,assenti,totale}} }
  const [dayRecords, setDayRecords] = useState([]);    // records della classe selezionata

  // Archivio
  const now = new Date();
  const [archMese, setArchMese]   = useState(now.getMonth());
  const [archAnno, setArchAnno]   = useState(now.getFullYear());
  const [archData, setArchData]   = useState([]);

  const dateDisplay = new Date(viewDate + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Carica classi e studenti
  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/classes'), api.get('/students')])
      .then(([cr, sr]) => {
        setClasses(cr.data);
        setStudents(sr.data);
        if (cr.data.length) setSelectedClass(cr.data[0].id);
      })
      .finally(() => setLoading(false));
  }, [sede]);

  // Carica summary oggi
  useEffect(() => {
    if (tab !== TAB_OGGI) return;
    api.get(`/presenze/classi-summary?date=${viewDate}`)
      .then(r => setDaySummary(r.data))
      .catch(console.error);
  }, [viewDate, tab]);

  // Carica dettaglio classe selezionata (oggi)
  useEffect(() => {
    if (tab !== TAB_OGGI || !selectedClass) return;
    api.get(`/presenze?class_id=${selectedClass}&date=${viewDate}`)
      .then(r => setDayRecords(r.data))
      .catch(console.error);
  }, [viewDate, selectedClass, tab]);

  // Carica archivio
  useEffect(() => {
    if (tab === TAB_OGGI || !selectedClass) return;
    const query = tab === TAB_MESE
      ? `mese=${archAnno}-${pad(archMese + 1)}`
      : `anno=${archAnno}`;
    setLoading(true);
    api.get(`/presenze?class_id=${selectedClass}&${query}`)
      .then(r => setArchData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tab, selectedClass, archMese, archAnno]);

  const studentsInClass = students.filter(s => s.class_id === selectedClass);
  const cls = classes.find(c => c.id === selectedClass);

  // byDate per archivio
  const byDate = archData.reduce((acc, r) => {
    (acc[r.date] = acc[r.date] || []).push(r); return acc;
  }, {});

  return (
    <AppLayout title="Registro Presenze" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-presenze-page">

        {/* Tab selector */}
        <div className="flex gap-1 p-1 bg-white rounded-2xl shadow-md">
          {[
            { key: TAB_OGGI, label: 'Oggi', icon: CheckCircle2 },
            { key: TAB_MESE, label: 'Mese',  icon: Calendar },
            { key: TAB_ANNO, label: 'Anno',  icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === key ? 'text-white shadow-sm' : 'text-gray-500'}`}
              style={tab === key ? { backgroundColor: '#4169E1' } : {}}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* ── Navigazione data / periodo ────────────────────────────────── */}
        {tab === TAB_OGGI && (
          <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 flex items-center justify-between">
            <button onClick={() => {
              const d = new Date(viewDate); d.setDate(d.getDate() - 1);
              setViewDate(d.toISOString().split('T')[0]);
            }} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <p className="text-sm font-bold capitalize" style={{ fontFamily: 'Nunito' }}>{dateDisplay}</p>
            <button onClick={() => {
              const d = new Date(viewDate); d.setDate(d.getDate() + 1);
              setViewDate(d.toISOString().split('T')[0]);
            }} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        )}

        {tab === TAB_MESE && (
          <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 flex items-center justify-between">
            <button onClick={() => { if (archMese === 0) { setArchMese(11); setArchAnno(y=>y-1); } else setArchMese(m=>m-1); }}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
            <p className="text-sm font-bold">{MESE_NOMI[archMese]} {archAnno}</p>
            <button onClick={() => { if (archMese === 11) { setArchMese(0); setArchAnno(y=>y+1); } else setArchMese(m=>m+1); }}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
          </div>
        )}

        {tab === TAB_ANNO && (
          <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 flex items-center justify-between">
            <button onClick={() => setArchAnno(y=>y-1)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
            <p className="text-sm font-bold">Anno {archAnno}</p>
            <button onClick={() => setArchAnno(y=>y+1)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
          </div>
        )}

        {/* ── Summary tutte le classi (solo TAB_OGGI) ───────────────────── */}
        {tab === TAB_OGGI && daySummary && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: '#4169E108' }}>
              <Users className="w-4 h-4" style={{ color: '#4169E1' }} />
              <span className="text-sm font-bold" style={{ color: '#4169E1', fontFamily: 'Nunito' }}>
                Riepilogo tutte le classi
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {classes.map(c => {
                const s = daySummary.classes?.[c.id];
                const nStudents = students.filter(st => st.class_id === c.id).length;
                return (
                  <button key={c.id} onClick={() => setSelectedClass(c.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors ${selectedClass === c.id ? 'bg-blue-50' : ''}`}
                    data-testid={`class-row-${c.id}`}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: selectedClass === c.id ? '#4169E1' : '#EBF0FF' }}>
                      <BookOpen className="w-4 h-4" style={{ color: selectedClass === c.id ? 'white' : '#4169E1' }} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                      {!s ? (
                        <p className="text-xs text-gray-400">Nessun registro per oggi</p>
                      ) : (
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>{s.presenti} pres.</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{s.assenti} ass.</span>
                          <span className="text-[10px] text-gray-400">{nStudents} totali</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Selettore classe (per archivio) ───────────────────────────── */}
        {tab !== TAB_OGGI && (
          <div className="flex gap-2 flex-wrap">
            {classes.map(c => (
              <button key={c.id} onClick={() => setSelectedClass(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${selectedClass === c.id ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'}`}
                style={selectedClass === c.id ? { backgroundColor: '#4169E1' } : {}}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Dettaglio classe oggi ─────────────────────────────────────── */}
        {tab === TAB_OGGI && selectedClass && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100" style={{ backgroundColor: '#4169E108' }}>
              <p className="text-sm font-bold" style={{ color: '#4169E1', fontFamily: 'Nunito' }}>
                {cls?.name} — dettaglio
              </p>
            </div>
            {dayRecords.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400">Nessun registro inserito dalla maestra per oggi</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {studentsInClass.map(s => {
                  const rec = dayRecords.find(r => r.student_id === s.id);
                  const presente = rec ? rec.presente : null;
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                      {presente === null ? (
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0" />
                      ) : presente ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{s.name}</p>
                        {rec?.nota && <p className="text-xs text-gray-400 italic">{rec.nota}</p>}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        presente === null ? 'bg-gray-100 text-gray-400' :
                        presente ? 'text-green-700' : 'text-red-600'}`}
                        style={presente === true ? { backgroundColor: '#DCFCE7' } : presente === false ? { backgroundColor: '#FEE2E2' } : {}}>
                        {presente === null ? '—' : presente ? 'Presente' : 'Assente'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Archivio (mese o anno) ────────────────────────────────────── */}
        {tab !== TAB_OGGI && (
          loading ? (
            <div className="bg-white rounded-2xl shadow-md p-8 text-center">
              <p className="text-sm text-gray-400 animate-pulse">Caricamento archivio...</p>
            </div>
          ) : Object.keys(byDate).length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md p-8 text-center">
              <BarChart2 className="w-10 h-10 mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Nessun dato per questo periodo</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100" style={{ backgroundColor: '#4169E108' }}>
                <p className="text-sm font-bold" style={{ color: '#4169E1', fontFamily: 'Nunito' }}>
                  {cls?.name} — {tab === TAB_MESE ? MESE_NOMI[archMese] : `Anno ${archAnno}`}
                </p>
              </div>
              {Object.keys(byDate).sort().map(date => {
                const recs     = byDate[date];
                const presenti = recs.filter(r => r.presente).length;
                const assenti  = recs.length - presenti;
                const label    = new Date(date + 'T12:00:00').toLocaleDateString('it-IT', {
                  weekday: 'short', day: '2-digit', month: tab === TAB_ANNO ? 'short' : undefined
                });
                return (
                  <div key={date} className="px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold text-gray-700 capitalize">{label}</p>
                      <div className="flex gap-2 text-[10px] font-bold">
                        <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>{presenti} pres.</span>
                        <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{assenti} ass.</span>
                      </div>
                    </div>
                    {recs.filter(r => !r.presente).map(r => {
                      const s = students.find(st => st.id === r.student_id);
                      return (
                        <div key={r.student_id} className="flex items-center gap-1.5 mb-0.5">
                          <XCircle className="w-3 h-3 text-red-400" />
                          <span className="text-xs text-red-600">{s?.name || '?'}</span>
                          {r.nota && <span className="text-[10px] text-gray-400 italic">— {r.nota}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </AppLayout>
  );
}
