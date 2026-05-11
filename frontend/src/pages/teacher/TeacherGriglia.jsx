import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckSquare, Save, ChevronLeft, ChevronRight, Info } from 'lucide-react';

// Colonne pasto con dropdown quantità
const MEAL_COLS = [
  { key: 'pasta',   label: 'Pasta',    short: 'PAS', color: '#F4C2C2' },
  { key: 'secondo', label: 'Secondo',  short: 'SEC', color: '#A7C7E7' },
  { key: 'pane',    label: 'Pane',     short: 'PAN', color: '#FFD699' },
  { key: 'frutta',  label: 'Frutta',   short: 'FRU', color: '#98FB98' },
  { key: 'merenda', label: 'Merenda',  short: 'MER', color: '#FFB347' },
];

// Colonna igiene (toggle boolean)
const HYGIENE_COL = { key: 'pupu', label: 'Pupù', short: 'PPU', color: '#D4B8E0' };

const ALL_COLS = [...MEAL_COLS, HYGIENE_COL];

const QUANTITA_OPTIONS = [
  { value: '',      label: '—',    bg: '#F3F4F6', text: '#9CA3AF' },
  { value: 'tutto', label: 'Tutto', bg: '#DCFCE7', text: '#166534' },
  { value: 'molta', label: 'Molta', bg: '#D1FAE5', text: '#065F46' },
  { value: 'metà',  label: 'Metà',  bg: '#FEF9C3', text: '#854D0E' },
  { value: 'poca',  label: 'Poca',  bg: '#FEE2E2', text: '#991B1B' },
];

const defaultGrid = () => ({
  pasta: false, pasta_qty: '',
  secondo: false, secondo_qty: '',
  pane: false, pane_qty: '',
  frutta: false, frutta_qty: '',
  merenda: false, merenda_qty: '',
  pupu: false, notes: '',
});

export default function TeacherGriglia() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [grid, setGrid] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dateOffset, setDateOffset] = useState(0);

  const getDate = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };
  const currentDate = getDate(dateOffset);
  const dateDisplay = new Date(currentDate + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const primaryClassId = (user?.class_ids && user.class_ids[0]) || user?.class_id;

  // Carica studenti
  useEffect(() => {
    if (primaryClassId) {
      api.get('/students').then(res => {
        setStudents(res.data);
        const g = {};
        res.data.forEach(s => { g[s.id] = defaultGrid(); });
        setGrid(g);
      });
    }
  }, [user]); // eslint-disable-line

  // Carica dati griglia per la data selezionata
  useEffect(() => {
    if (primaryClassId && students.length > 0) {
      api.get(`/griglia?class_id=${primaryClassId}&date=${currentDate}`).then(res => {
        setGrid(prev => {
          const g = { ...prev };
          res.data.forEach(entry => {
            if (g[entry.student_id] !== undefined) {
              g[entry.student_id] = {
                pasta:       entry.pasta       || false,
                pasta_qty:   entry.pasta_qty   || '',
                secondo:     entry.secondo     || false,
                secondo_qty: entry.secondo_qty || '',
                pane:        entry.pane        || false,
                pane_qty:    entry.pane_qty    || '',
                frutta:      entry.frutta      || false,
                frutta_qty:  entry.frutta_qty  || '',
                merenda:     entry.merenda     || false,
                merenda_qty: entry.merenda_qty || '',
                pupu:        entry.pupu        || false,
                notes:       entry.notes       || '',
              };
            }
          });
          return g;
        });
      });
    }
  }, [user, currentDate, students.length]); // eslint-disable-line

  const toggleSelectAll = () => {
    setSelectedStudents(prev =>
      prev.length === students.length ? [] : students.map(s => s.id)
    );
  };
  const toggleStudent = (id) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  // Imposta quantità pasto per uno studente
  const setQty = (studentId, col, qty) => {
    setGrid(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [col]: !!qty,           // boolean derivato
        [`${col}_qty`]: qty,
      }
    }));
  };

  // Toggle boolean (solo pupu)
  const toggleCell = (studentId, key) => {
    setGrid(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [key]: !prev[studentId]?.[key] }
    }));
  };

  const setNote = (studentId, note) => {
    setGrid(prev => ({ ...prev, [studentId]: { ...prev[studentId], notes: note } }));
  };

  // Azione rapida: imposta stessa quantità per tutti i selezionati
  const bulkSetQty = (col, qty) => {
    setGrid(prev => {
      const g = { ...prev };
      selectedStudents.forEach(sid => {
        g[sid] = { ...g[sid], [col]: !!qty, [`${col}_qty`]: qty };
      });
      return g;
    });
  };
  const bulkToggle = (key) => {
    const allActive = selectedStudents.every(sid => grid[sid]?.[key]);
    setGrid(prev => {
      const g = { ...prev };
      selectedStudents.forEach(sid => { g[sid] = { ...g[sid], [key]: !allActive }; });
      return g;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(students.map(s => {
        const data = grid[s.id] || defaultGrid();
        return api.post('/griglia', {
          class_id: primaryClassId,
          student_ids: [s.id],
          date: currentDate,
          ...data,
        });
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Griglia Giornaliera" showBack>
      <div className="max-w-4xl mx-auto space-y-4" data-testid="teacher-griglia-page">

        {/* Date Navigation */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <button onClick={() => setDateOffset(d => d - 1)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100" data-testid="date-prev">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-center">
              <h3 className="text-base font-bold capitalize" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{dateDisplay}</h3>
              <p className="text-xs text-gray-500">Registro pasti e igiene</p>
            </div>
            <button onClick={() => setDateOffset(d => d + 1)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100" data-testid="date-next">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          {saved && (
            <div className="mt-3 text-center">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#166534' }} data-testid="save-success-badge">
                ✓ Salvato e pubblicato ai genitori!
              </span>
            </div>
          )}
        </div>

        {/* Seleziona tutti */}
        <div className="flex items-center justify-between bg-white rounded-2xl shadow-md px-4 py-3 border border-gray-100">
          <span className="text-sm font-semibold text-gray-700">{selectedStudents.length}/{students.length} selezionati</span>
          <Button data-testid="select-all-button" onClick={toggleSelectAll} variant="outline" size="sm"
            className="rounded-xl text-xs h-8 font-bold border-2"
            style={{ borderColor: '#F4C2C2', color: selectedStudents.length === students.length ? 'white' : '#E8919A', backgroundColor: selectedStudents.length === students.length ? '#F4C2C2' : 'transparent' }}>
            <CheckSquare className="w-3.5 h-3.5 mr-1.5" />Seleziona Tutti
          </Button>
        </div>

        {/* Azioni rapide sui selezionati */}
        {selectedStudents.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-3 border border-gray-100" data-testid="bulk-actions">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Azione rapida — imposta quantità per i selezionati</p>
            <div className="space-y-2">
              {MEAL_COLS.map(col => (
                <div key={col.key} className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-gray-600 w-16">{col.label}</span>
                  {QUANTITA_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => bulkSetQty(col.key, opt.value)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all hover:opacity-80"
                      style={{ backgroundColor: opt.bg, color: opt.text }}>
                      {opt.label || '—'}
                    </button>
                  ))}
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <span className="text-[11px] font-bold text-gray-600 w-16">Pupù</span>
                <button onClick={() => bulkToggle('pupu')}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                  style={{ backgroundColor: '#D4B8E040', color: '#7B5EA7' }}>
                  Attiva/Disattiva
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabella griglia */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden" data-testid="griglia-table">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr style={{ backgroundColor: '#FFF5EE' }}>
                  <th className="sticky left-0 z-10 px-3 py-2.5 text-left text-xs font-bold text-gray-700 w-36" style={{ fontFamily: 'Nunito', backgroundColor: '#FFF5EE' }}>
                    Bambino
                  </th>
                  {MEAL_COLS.map(col => (
                    <th key={col.key} className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-600" style={{ fontFamily: 'Nunito', minWidth: '90px' }}>
                      <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center mb-0.5" style={{ backgroundColor: `${col.color}50` }}>
                        <span className="text-[9px] font-black">{col.short}</span>
                      </div>
                      <span className="text-[9px]">{col.label}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-600" style={{ fontFamily: 'Nunito', minWidth: '60px' }}>
                    <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center mb-0.5" style={{ backgroundColor: '#D4B8E050' }}>
                      <span className="text-[9px] font-black">PPU</span>
                    </div>
                    <span className="text-[9px]">Pupù</span>
                  </th>
                  <th className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-600 min-w-[110px]" style={{ fontFamily: 'Nunito' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => {
                  const isSelected = selectedStudents.includes(student.id);
                  const sg = grid[student.id] || defaultGrid();
                  const rowBg = isSelected ? '#F4C2C210' : (idx % 2 === 0 ? 'white' : '#FAFAFA');
                  return (
                    <tr key={student.id} data-testid={`griglia-row-${student.id}`}
                      className="border-t border-gray-50 transition-colors" style={{ backgroundColor: rowBg }}>

                      {/* Nome studente */}
                      <td className="sticky left-0 z-10 px-3 py-2" style={{ backgroundColor: rowBg }}>
                        <button onClick={() => toggleStudent(student.id)}
                          className="flex items-center gap-2 w-full text-left"
                          data-testid={`student-select-${student.id}`}>
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'border-transparent' : 'border-gray-300'}`}
                            style={isSelected ? { backgroundColor: '#F4C2C2' } : {}}>
                            {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: '#F4C2C2' }}>
                              {student.name.charAt(0)}
                            </div>
                            <span className="text-xs font-semibold text-gray-800 truncate max-w-[80px]">{student.name.split(' ')[0]}</span>
                          </div>
                        </button>
                      </td>

                      {/* Dropdown quantità per ogni pasto */}
                      {MEAL_COLS.map(col => {
                        const qtyKey = `${col.key}_qty`;
                        const currentQty = sg[qtyKey] || '';
                        const opt = QUANTITA_OPTIONS.find(o => o.value === currentQty) || QUANTITA_OPTIONS[0];
                        return (
                          <td key={col.key} className="px-1.5 py-2 text-center">
                            <select
                              data-testid={`qty-${student.id}-${col.key}`}
                              value={currentQty}
                              onChange={(e) => setQty(student.id, col.key, e.target.value)}
                              className="w-full rounded-lg text-[11px] font-bold text-center py-1.5 px-1 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1"
                              style={{
                                backgroundColor: opt.bg,
                                color: opt.text,
                                focusRingColor: col.color,
                              }}>
                              {QUANTITA_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label || '—'}</option>
                              ))}
                            </select>
                          </td>
                        );
                      })}

                      {/* Pupù — toggle boolean */}
                      <td className="px-2 py-2 text-center">
                        <button
                          data-testid={`cell-${student.id}-pupu`}
                          onClick={() => toggleCell(student.id, 'pupu')}
                          className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center transition-all text-xs font-bold ${sg.pupu ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                          style={sg.pupu ? { backgroundColor: '#D4B8E0' } : {}}>
                          {sg.pupu ? '✓' : '—'}
                        </button>
                      </td>

                      {/* Note */}
                      <td className="px-2 py-2">
                        <Input
                          data-testid={`note-${student.id}`}
                          value={sg.notes || ''}
                          onChange={(e) => setNote(student.id, e.target.value)}
                          placeholder="Note..."
                          className="rounded-lg text-[11px] h-8 min-w-[90px]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legenda */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100" data-testid="griglia-legend">
          <div className="flex items-center gap-1.5 mb-3">
            <Info className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Legenda quantità</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {QUANTITA_OPTIONS.filter(o => o.value).map(o => (
              <div key={o.value} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ backgroundColor: o.bg }}>
                <span className="text-[10px] font-bold" style={{ color: o.text }}>{o.label}</span>
                <span className="text-[9px] text-gray-400">= {o.value === 'tutto' ? 'ha mangiato tutto' : o.value === 'molta' ? 'ha mangiato molto' : o.value === 'metà' ? 'ha mangiato metà' : 'ha mangiato poco'}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_COLS.map(col => (
              <div key={col.key} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: col.color }} />
                <span className="text-[10px] text-gray-600 font-medium">{col.short} = {col.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Salva */}
        <Button data-testid="save-griglia-button" onClick={handleSave} disabled={saving}
          className="w-full rounded-2xl font-bold h-14 text-base shadow-md hover:shadow-lg transition-all"
          style={{ backgroundColor: '#F4C2C2', color: '#7A3B3B' }}>
          <Save className="w-5 h-5 mr-2" />
          {saving ? 'Salvataggio...' : 'Salva e Pubblica ai Genitori'}
        </Button>
      </div>
    </AppLayout>
  );
}
