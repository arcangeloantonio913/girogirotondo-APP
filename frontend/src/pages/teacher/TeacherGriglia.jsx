import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { CheckSquare, Save, Users } from 'lucide-react';

export default function TeacherGriglia() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [activities, setActivities] = useState({
    presence: false,
    bathroom: false,
    sleep: false,
    meal_first: false,
    meal_second: false,
    snack: false,
  });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (user?.class_id) {
      api.get(`/students?class_id=${user.class_id}`).then(res => setStudents(res.data));
    }
  }, [user]);

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

  const toggleActivity = (key) => {
    setActivities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (selectedStudents.length === 0) return;
    setSaving(true);
    try {
      await api.post('/griglia', {
        class_id: user.class_id,
        student_ids: selectedStudents,
        date: today,
        ...activities,
        notes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const activityLabels = [
    { key: 'presence', label: 'Presenza', emoji: 'P' },
    { key: 'bathroom', label: 'Bagno', emoji: 'B' },
    { key: 'sleep', label: 'Riposo', emoji: 'R' },
    { key: 'meal_first', label: 'Primo', emoji: '1' },
    { key: 'meal_second', label: 'Secondo', emoji: '2' },
    { key: 'snack', label: 'Merenda', emoji: 'M' },
  ];

  return (
    <AppLayout title="Griglia Giornaliera" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="teacher-griglia-page">
        {/* Date Header */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 border border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
              {new Date(today).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <p className="text-xs text-gray-500">{selectedStudents.length} alunni selezionati</p>
          </div>
          {saved && (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ backgroundColor: '#32CD32' }} data-testid="save-success-badge">
              Salvato!
            </span>
          )}
        </div>

        {/* Student Selection */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden" data-testid="student-selection-panel">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: '#FF69B4' }} />
              <span className="text-sm font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>Alunni</span>
            </div>
            <Button
              data-testid="select-all-button"
              onClick={toggleSelectAll}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs h-8 font-semibold border-2"
              style={{ borderColor: '#FF69B4', color: selectedStudents.length === students.length ? 'white' : '#FF69B4', backgroundColor: selectedStudents.length === students.length ? '#FF69B4' : 'transparent' }}
            >
              <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
              Seleziona Tutti
            </Button>
          </div>
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {students.map((student) => {
              const selected = selectedStudents.includes(student.id);
              return (
                <button
                  key={student.id}
                  data-testid={`student-select-${student.id}`}
                  onClick={() => toggleStudent(student.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all text-sm ${selected ? 'text-white shadow-sm' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                  style={selected ? { backgroundColor: '#FF69B4' } : {}}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${selected ? 'bg-white/20 text-white' : 'bg-white text-gray-600'}`}>
                    {student.name.charAt(0)}
                  </div>
                  <span className="font-medium truncate text-xs">{student.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Activity Grid */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden" data-testid="activity-grid">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>Attivita</span>
          </div>
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {activityLabels.map(({ key, label, emoji }) => {
              const active = activities[key];
              return (
                <button
                  key={key}
                  data-testid={`activity-toggle-${key}`}
                  onClick={() => toggleActivity(key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'text-white shadow-sm' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                  style={active ? { backgroundColor: '#4169E1' } : {}}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${active ? 'bg-white/20 text-white' : 'bg-white text-gray-500'}`}>
                    {emoji}
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 border border-gray-100" data-testid="notes-section">
          <label className="text-sm font-bold block mb-2" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>Note</label>
          <Input
            data-testid="griglia-notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Aggiungi note per gli alunni selezionati..."
            className="rounded-xl"
          />
        </div>

        {/* Save Button */}
        <Button
          data-testid="save-griglia-button"
          onClick={handleSave}
          disabled={saving || selectedStudents.length === 0}
          className="w-full rounded-2xl font-bold h-12 text-base shadow-md"
          style={{ backgroundColor: '#FF69B4' }}
        >
          <Save className="w-5 h-5 mr-2" />
          {saving ? 'Salvataggio...' : 'Salva Griglia'}
        </Button>
      </div>
    </AppLayout>
  );
}
