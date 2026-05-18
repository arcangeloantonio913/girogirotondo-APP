import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckSquare, Save, ChevronLeft, ChevronRight, Info, Moon } from 'lucide-react';

// Ordine: Merenda PRIMA, poi gli altri pasti
const MEAL_COLS = [
  { key: 'merenda', label: 'Merenda',  short: 'MER', color: '#FFB347' },
  { key: 'pasta',   label: 'Pasta',    short: 'PAS', color: '#F4C2C2' },
  { key: 'secondo', label: 'Secondo',  short: 'SEC', color: '#A7C7E7' },
  { key: 'pane',    label: 'Pane',     short: 'PAN', color: '#FFD699' },
  { key: 'frutta',  label: 'Frutta',   short: 'FRU', color: '#98FB98' },
];

// Colonne boolean (toggle)
const BOOL_COLS = [
  { key: 'pupu',  label: 'Pupù',  short: 'PPU', color: '#D4B8E0' },
  { key: 'nanna', label: 'Nanna', short: 'NAN', color: '#93C5FD' },
];

// Quantità: Tutto, Bis, Metà, Mangiata poca, Lasciata poca, No
const QUANTITA_OPTIONS = [
  { value: '',             label: '—',            bg: '#F3F4F6', text: '#9CA3AF' },
  { value: 'tutto',        label: 'Tutto',         bg: '#DCFCE7', text: '#166534' },
  { value: 'bis',          label: 'Bis',           bg: '#D1FAE5', text: '#065F46' },
  { value: 'metà',         label: 'Metà',          bg: '#FEF9C3', text: '#854D0E' },
  { value: 'mangiata_poca',label: 'Mangiata poca', bg: '#FEE2E2', text: '#991B1B' },
  { value: 'lasciata_poca',label: 'Lasciata poca', bg: '#FECACA', text: '#7F1D1D' },
  { value: 'no',           label: 'No',            bg: '#F1F5F9', text: '#64748B' },
];

const defaultGrid = () => ({
  merenda: false, merenda_qty: '',
  pasta:   false, pasta_qty:   '',
  secondo: false, secondo_qty: '',
  pane:    false, pane_qty:    '',
  frutta:  false, frutta_qty:  '',
  pupu:    false,
  nanna:   false,
  notes:   '',
});

export default function TeacherGriglia() {
  const { user } = useAuth();
  const [students, setStudents]   = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [grid, setGrid]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [dateOffset, setDateOffset] = useState(0);

  const getDate = (offset) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };
  const currentDate  = getDate(dateOffset);
  const dateDisplay  = new Date(currentDate + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const primaryClassId = (user?.class_ids?.[0]) || user?.class_id;

  // Carica studenti
  useEffect(() => {
    if (!primaryClassId) return;
    api.get('/students').then(res => {
      setStudents(res.data);
      const g = {};
      res.data.forEach(s => { g[s.id] = defaultGrid(); });
      setGrid(g);
    });
  }, [user]); // eslint-disable-line

  // Carica griglia per data selezionata
  useEffect(() => {
    if (!primaryClassId || !students.length) return;
    api.get(`/griglia?class_id=${primaryClassId}&date=${currentDate}`).then(res => {
      setGrid(prev => {
        const g = { ...prev };
        res.data.forEach(entry => {
          if (g[entry.student_id] !== undefined) {
            g[entry.student_id] = {
              merenda: entry.merenda || false, merenda_qty: entry.merenda_qty || '',
              pasta:   entry.pasta   || false, pasta_qty:   entry.pasta_qty   || '',
              secondo: entry.secondo || false, secondo_qty: entry.secondo_qty || '',
              pane:    entry.pane    || false, pane_qty:    entry.pane_qty    || '',
              frutta:  entry.frutta  || false, frutta_qty:  entry.frutta_qty  || '',
              pupu:    entry.pupu    || false,
              nanna:   entry.nanna   || false,
              notes:   entry.notes   || '',
            };
          }
        });
        return g;
      });
    });
  }, [user, currentDate, students.length]); // eslint-disable-line

  const toggleSelectAll = () =>
    setSelectedStudents(prev => prev.length === students.length ? [] : students.map(s => s.id));
  const toggleStudent = (id) =>
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  // Imposta quantità pasto
  const setQty = (sid, col, qty) => setGrid(prev => ({
    ...prev,
    [sid]: { ...prev[sid], [col]: qty !== 'no' && !!qty, [`${col}_qty`]: qty }
  }));

  // Toggle boolean (pupu, nanna)
  const toggleBool = (sid, key) => setGrid(prev => ({
    ...prev, [sid]: { ...prev[sid], [key]: !prev[sid]?.[key] }
  }));

  const setNote = (sid, note) => setGrid(prev => ({
    ...prev, [sid]: { ...prev[sid], notes: note }
  }));

  // Bulk: imposta stessa quantità a tutti i selezionati
  const bulkSetQty = (col, qty) => setGrid(prev => {
    const g = { ...prev };
    selectedStudents.forEach(sid => {
      g[sid] = { ...g[sid], [col]: qty !== 'no' && !!qty, [`${col}_qty`]: qty };
    });
    return g;
  });
  const bulkToggleBool = (key) => {
    const allOn = selectedStudents.every(sid => grid[sid]?.[key]);
    setGrid(prev => {
      const g = { ...prev };
      selectedStudents.forEach(sid => { g[sid] = { ...g[sid], [key]: !allOn }; });
      return g;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(students.map(s => {
        const d = grid[s.id] || defaultGrid();
        return api.post('/griglia', { class_id: primaryClassId, student_ids: [s.id], date: currentDate, ...d });
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <AppLayout title="Griglia Giornaliera" showBack>
      <div className="max-w-5xl mx-auto space-y-4" data-testid="teacher-griglia-page">

        {/* Data */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <button onClick={() => setDateOffset(d => d - 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100" data-testid="date-prev">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-center">
              <h3 className="text-base font-bold capitalize" style={{ fontFamily: 'Nunito' }}>{dateDisplay}</h3>
              {saved && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                style={{ backgroundColor: '#DCFCE7', color: '#166534' }} data-testid="save-success-badge">✓ Salvato!</span>}
            </div>
            <button onClick={() => setDateOffset(d => d + 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100" data-testid="date-next">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Seleziona tutti */}
        <div className="flex items-center justify-between bg-white rounded-2xl shadow-md px-4 py-3 border border-gray-100">
          <span className="text-sm font-semibold text-gray-700">{selectedStudents.length}/{students.length} selezionati</span>
          <Button onClick={toggleSelectAll} variant="outline" size="sm"
            className="rounded-xl text-xs h-8 font-bold border-2"
            style={{ borderColor: '#F4C2C2', color: selectedStudents.length === students.length ? 'white' : '#E8919A',
              backgroundColor: selectedStudents.length === students.length ? '#F4C2C2' : 'transparent' }}
            data-testid="select-all-button">
            <CheckSquare className="w-3.5 h-3.5 mr-1.5" />Seleziona Tutti
          </Button>
        </div>

        {/* Azioni rapide */}
        {selectedStudents.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-3 border border-gray-100" data-testid="bulk-actions">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Azione rapida per i selezionati</p>
            <div className="space-y-1.5">
              {MEAL_COLS.map(col => (
                <div key={col.key} className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-gray-500 w-14">{col.label}</span>
                  {QUANTITA_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => bulkSetQty(col.key, o.value)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all"
                      style={{ backgroundColor: o.bg, color: o.text }}>{o.label || '—'}</button>
                  ))}
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                {BOOL_COLS.map(col => (
                  <button key={col.key} onClick={() => bulkToggleBool(col.key)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                    style={{ backgroundColor: `${col.color}40`, color: '#555' }}>
                    {col.label} on/off
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabella */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden" data-testid="griglia-table">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: `${200 + MEAL_COLS.length * 95 + BOOL_COLS.length * 65 + 110}px` }}>
              <thead>
                <tr style={{ backgroundColor: '#FFF5EE' }}>
                  {/* Nome + Cognome */}
                  <th className="sticky left-0 z-10 px-3 py-2.5 text-left text-xs font-bold text-gray-700 w-44"
                    style={{ fontFamily: 'Nunito', backgroundColor: '#FFF5EE' }}>Bambino</th>
                  {MEAL_COLS.map(col => (
                    <th key={col.key} className="px-1.5 py-2.5 text-center text-[10px] font-bold text-gray-600"
                      style={{ minWidth: '90px', fontFamily: 'Nunito' }}>
                      <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center mb-0.5"
                        style={{ backgroundColor: `${col.color}50` }}>
                        <span className="text-[9px] font-black">{col.short}</span>
                      </div>
                      <span className="text-[9px]">{col.label}</span>
                    </th>
                  ))}
                  {BOOL_COLS.map(col => (
                    <th key={col.key} className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-600"
                      style={{ minWidth: '60px', fontFamily: 'Nunito' }}>
                      <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center mb-0.5"
                        style={{ backgroundColor: `${col.color}50` }}>
                        <span className="text-[9px] font-black">{col.short}</span>
                      </div>
                      <span className="text-[9px]">{col.label}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-600 min-w-[110px]"
                    style={{ fontFamily: 'Nunito' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => {
                  const isSelected = selectedStudents.includes(student.id);
                  const sg = grid[student.id] || defaultGrid();
                  const rowBg = isSelected ? '#F4C2C210' : idx % 2 === 0 ? 'white' : '#FAFAFA';
                  return (
                    <tr key={student.id} data-testid={`griglia-row-${student.id}`}
                      className="border-t border-gray-50 transition-colors" style={{ backgroundColor: rowBg }}>

                      {/* Nome + Cognome */}
                      <td className="sticky left-0 z-10 px-3 py-2" style={{ backgroundColor: rowBg }}>
                        <button onClick={() => toggleStudent(student.id)}
                          className="flex items-center gap-2 w-full text-left"
                          data-testid={`student-select-${student.id}`}>
                          <div className={`w-6 h-6 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all
                            ${isSelected ? 'border-transparent' : 'border-gray-300'}`}
                            style={isSelected ? { backgroundColor: '#F4C2C2' } : {}}>
                            {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-gray-800 block leading-tight">
                              {student.name}
                            </span>
                            {student.cognome && (
                              <span className="text-[10px] text-gray-500 block leading-tight">
                                {student.cognome}
                              </span>
                            )}
                          </div>
                        </button>
                      </td>

                      {/* Dropdown quantità per ogni pasto */}
                      {MEAL_COLS.map(col => {
                        const qtyKey = `${col.key}_qty`;
                        const currentQty = sg[qtyKey] || '';
                        const opt = QUANTITA_OPTIONS.find(o => o.value === currentQty) || QUANTITA_OPTIONS[0];
                        return (
                          <td key={col.key} className="px-1 py-2 text-center">
                            <select value={currentQty}
                              onChange={e => setQty(student.id, col.key, e.target.value)}
                              data-testid={`qty-${student.id}-${col.key}`}
                              className="w-full rounded-lg text-[11px] font-bold text-center py-1.5 border-0 cursor-pointer focus:outline-none"
                              style={{ backgroundColor: opt.bg, color: opt.text }}>
                              {QUANTITA_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label || '—'}</option>
                              ))}
                            </select>
                          </td>
                        );
                      })}

                      {/* Boolean: Pupù e Nanna */}
                      {BOOL_COLS.map(col => (
                        <td key={col.key} className="px-2 py-2 text-center">
                          <button onClick={() => toggleBool(student.id, col.key)}
                            data-testid={`cell-${student.id}-${col.key}`}
                            className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center transition-all text-xs font-bold
                              ${sg[col.key] ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                            style={sg[col.key] ? { backgroundColor: col.color } : {}}>
                            {sg[col.key] ? '✓' : '—'}
                          </button>
                        </td>
                      ))}

                      {/* Note */}
                      <td className="px-2 py-2">
                        <Input value={sg.notes || ''} onChange={e => setNote(student.id, e.target.value)}
                          data-testid={`note-${student.id}`}
                          placeholder="Note..." className="rounded-lg text-[11px] h-8 min-w-[90px]" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legenda */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Legenda quantità</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUANTITA_OPTIONS.filter(o => o.value).map(o => (
              <span key={o.value} className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                style={{ backgroundColor: o.bg, color: o.text }}>{o.label}</span>
            ))}
          </div>
        </div>

        {/* Salva */}
        <Button onClick={handleSave} disabled={saving} data-testid="save-griglia-button"
          className="w-full rounded-2xl font-bold h-14 text-base shadow-md"
          style={{ backgroundColor: '#F4C2C2', color: '#7A3B3B' }}>
          <Save className="w-5 h-5 mr-2" />
          {saving ? 'Salvataggio...' : 'Salva e Pubblica ai Genitori'}
        </Button>
      </div>
    </AppLayout>
  );
}
