import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckSquare, Save, ChevronLeft, ChevronRight, Info } from 'lucide-react';

const ACTIVITY_COLS = [
  { key: 'colazione', label: 'Colazione', short: 'COL', color: '#F4C2C2' },
  { key: 'pranzo', label: 'Pranzo', short: 'PRA', color: '#A7C7E7' },
  { key: 'frutta', label: 'Frutta', short: 'FRU', color: '#98FB98' },
  { key: 'merenda', label: 'Merenda', short: 'MER', color: '#FFD699' },
  { key: 'cacca', label: 'Cacca', short: 'CAC', color: '#D4B8E0' },
  { key: 'pisolino', label: 'Pisolino', short: 'PIS', color: '#B8D4E3' },
];

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
  const dateDisplay = new Date(currentDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    if (user?.class_id) {
      api.get(`/students?class_id=${user.class_id}`).then(res => {
        setStudents(res.data);
        // Init grid with defaults
        const g = {};
        res.data.forEach(s => {
          g[s.id] = { colazione: false, pranzo: false, frutta: false, merenda: false, cacca: false, pisolino: false, notes: '' };
        });
        setGrid(g);
      });
    }
  }, [user]);

  // Load existing data for the date
  useEffect(() => {
    if (user?.class_id && students.length > 0) {
      api.get(`/griglia?class_id=${user.class_id}&date=${currentDate}`).then(res => {
        setGrid(prev => {
          const g = { ...prev };
          res.data.forEach(entry => {
            if (g[entry.student_id]) {
              g[entry.student_id] = {
                colazione: entry.colazione || false,
                pranzo: entry.pranzo || false,
                frutta: entry.frutta || false,
                merenda: entry.merenda || false,
                cacca: entry.cacca || false,
                pisolino: entry.pisolino || false,
                notes: entry.notes || '',
              };
            }
          });
          return g;
        });
      });
    }
  }, [user, currentDate, students.length]);

  const toggleSelectAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
  };

  const toggleStudent = (id) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleCell = (studentId, key) => {
    setGrid(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [key]: !prev[studentId]?.[key] }
    }));
  };

  const setNoteForStudent = (studentId, note) => {
    setGrid(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], notes: note }
    }));
  };

  // Bulk toggle: set an activity for all selected students
  const bulkToggle = (key) => {
    const allActive = selectedStudents.every(sid => grid[sid]?.[key]);
    setGrid(prev => {
      const g = { ...prev };
      selectedStudents.forEach(sid => {
        g[sid] = { ...g[sid], [key]: !allActive };
      });
      return g;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save each student's grid individually
      const promises = students.map(s => {
        const data = grid[s.id] || {};
        return api.post('/griglia', {
          class_id: user.class_id,
          student_ids: [s.id],
          date: currentDate,
          ...data,
        });
      });
      await Promise.all(promises);
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
      <div className="max-w-3xl mx-auto space-y-4" data-testid="teacher-griglia-page">
        {/* Date Navigation */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <button onClick={() => setDateOffset(d => d - 1)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100" data-testid="date-prev">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-center">
              <h3 className="text-base font-bold capitalize" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{dateDisplay}</h3>
              <p className="text-xs text-gray-500">Registro attivita e pasti</p>
            </div>
            <button onClick={() => setDateOffset(d => d + 1)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100" data-testid="date-next">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          {saved && (
            <div className="mt-3 text-center">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ backgroundColor: '#98FB98', color: '#2D5A27' }} data-testid="save-success-badge">
                Salvato e pubblicato!
              </span>
            </div>
          )}
        </div>

        {/* Select All Bar */}
        <div className="flex items-center justify-between bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] px-4 py-3 border border-gray-100">
          <span className="text-sm font-semibold text-gray-700">{selectedStudents.length}/{students.length} selezionati</span>
          <Button
            data-testid="select-all-button"
            onClick={toggleSelectAll}
            variant="outline"
            size="sm"
            className="rounded-xl text-xs h-8 font-bold border-2"
            style={{
              borderColor: '#F4C2C2',
              color: selectedStudents.length === students.length ? 'white' : '#E8919A',
              backgroundColor: selectedStudents.length === students.length ? '#F4C2C2' : 'transparent'
            }}
          >
            <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
            Seleziona Tutti
          </Button>
        </div>

        {/* Bulk Actions for Selected Students */}
        {selectedStudents.length > 0 && (
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-3 border border-gray-100" data-testid="bulk-actions">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Azione rapida per i selezionati</p>
            <div className="flex gap-1.5 flex-wrap">
              {ACTIVITY_COLS.map(col => (
                <button
                  key={col.key}
                  data-testid={`bulk-toggle-${col.key}`}
                  onClick={() => bulkToggle(col.key)}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-80"
                  style={{ backgroundColor: `${col.color}40`, color: '#555' }}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid Table */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden" data-testid="griglia-table">
          {/* Table Header */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr style={{ backgroundColor: '#FFF5EE' }}>
                  <th className="sticky left-0 z-10 px-3 py-2.5 text-left text-xs font-bold text-gray-700 w-36" style={{ fontFamily: 'Nunito', backgroundColor: '#FFF5EE' }}>
                    Bambino
                  </th>
                  {ACTIVITY_COLS.map(col => (
                    <th key={col.key} className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-600 w-16" style={{ fontFamily: 'Nunito' }}>
                      <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center mb-0.5" style={{ backgroundColor: `${col.color}50` }}>
                        <span className="text-[9px] font-black">{col.short}</span>
                      </div>
                      <span className="text-[9px]">{col.label}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-600 min-w-[120px]" style={{ fontFamily: 'Nunito' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => {
                  const isSelected = selectedStudents.includes(student.id);
                  const studentGrid = grid[student.id] || {};
                  return (
                    <tr
                      key={student.id}
                      data-testid={`griglia-row-${student.id}`}
                      className={`border-t border-gray-50 transition-colors ${isSelected ? '' : ''}`}
                      style={isSelected ? { backgroundColor: '#F4C2C210' } : (idx % 2 === 0 ? {} : { backgroundColor: '#FAFAFA' })}
                    >
                      <td className="sticky left-0 z-10 px-3 py-2" style={{ backgroundColor: isSelected ? '#F4C2C215' : (idx % 2 === 0 ? 'white' : '#FAFAFA') }}>
                        <button
                          onClick={() => toggleStudent(student.id)}
                          className="flex items-center gap-2 w-full text-left"
                          data-testid={`student-select-${student.id}`}
                        >
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'border-transparent' : 'border-gray-300'}`}
                            style={isSelected ? { backgroundColor: '#F4C2C2' } : {}}
                          >
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
                      {ACTIVITY_COLS.map(col => (
                        <td key={col.key} className="px-2 py-2 text-center">
                          <button
                            data-testid={`cell-${student.id}-${col.key}`}
                            onClick={() => toggleCell(student.id, col.key)}
                            className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center transition-all text-xs font-bold ${studentGrid[col.key] ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                            style={studentGrid[col.key] ? { backgroundColor: col.color } : {}}
                          >
                            {studentGrid[col.key] ? '✓' : '—'}
                          </button>
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        <Input
                          data-testid={`note-${student.id}`}
                          value={studentGrid.notes || ''}
                          onChange={(e) => setNoteForStudent(student.id, e.target.value)}
                          placeholder="Note..."
                          className="rounded-lg text-[11px] h-8 min-w-[100px]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 border border-gray-100" data-testid="griglia-legend">
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Legenda</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_COLS.map(col => (
              <div key={col.key} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: col.color }} />
                <span className="text-[10px] text-gray-600 font-medium">{col.short} = {col.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <Button
          data-testid="save-griglia-button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl font-bold h-14 text-base shadow-md hover:shadow-lg transition-all"
          style={{ backgroundColor: '#F4C2C2', color: '#7A3B3B' }}
        >
          <Save className="w-5 h-5 mr-2" />
          {saving ? 'Salvataggio...' : 'Salva e Pubblica ai Genitori'}
        </Button>
      </div>
    </AppLayout>
  );
}
