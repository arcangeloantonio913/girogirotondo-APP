import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookMarked, CheckCircle, Users, Baby, ChevronDown, ChevronUp, Check } from 'lucide-react';

const today = new Date().toISOString().split('T')[0];

export default function TeacherDiario() {
  const { user } = useAuth();
  const [classes,  setClasses]  = useState([]);
  const [students, setStudents] = useState([]);
  const [entries,  setEntries]  = useState([]);

  // Form
  const [classId,     setClassId]     = useState('');
  const [date,        setDate]        = useState(today);
  const [summary,     setSummary]     = useState('');
  const [allStudents, setAllStudents] = useState(true);  // true = tutta la classe
  const [selStudents, setSelStudents] = useState([]);    // IDs selezionati
  const [showPicker,  setShowPicker]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');

  const teacherClassIds = useMemo(() => {
    const ids = [...(user?.class_ids || [])];
    if (user?.class_id && !ids.includes(user.class_id)) ids.push(user.class_id);
    return ids;
  }, [user]);

  useEffect(() => {
    if (!teacherClassIds.length) return;
    Promise.all([api.get('/classes'), api.get('/students')]).then(([cRes, sRes]) => {
      const myClasses = cRes.data.filter(c => teacherClassIds.includes(c.id));
      setClasses(myClasses);
      setStudents(sRes.data);
      if (myClasses.length > 0) setClassId(myClasses[0].id);
    }).catch(console.error);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!classId || !date) return;
    api.get(`/diary?class_id=${classId}&date=${date}`)
      .then(r => setEntries(r.data || []))
      .catch(() => setEntries([]));
  }, [classId, date]);

  const classStudents = useMemo(() =>
    students.filter(s => s.class_id === classId),
    [students, classId]
  );

  const toggleStudent = (id) =>
    setSelStudents(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!classId || !date || !summary.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/diary', {
        class_id:    classId,
        date,
        summary:     summary.trim(),
        student_ids: allStudents ? null : selStudents,
      });
      setSaved(true);
      setSummary('');
      setSelStudents([]);
      setAllStudents(true);
      // Ricarica entries
      const r = await api.get(`/diary?class_id=${classId}&date=${date}`);
      setEntries(r.data || []);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante il salvataggio');
    } finally { setLoading(false); }
  };

  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  return (
    <AppLayout title="Diario di Bordo" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="teacher-diario-page">

        {/* Selettori classe e data */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            {classes.length > 1 && (
              <div>
                <Label className="text-xs font-medium text-gray-600">Classe</Label>
                <Select value={classId} onValueChange={v => { setClassId(v); setSelStudents([]); }}>
                  <SelectTrigger className="rounded-xl mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className={classes.length > 1 ? '' : 'col-span-2'}>
              <Label className="text-xs font-medium text-gray-600">Data</Label>
              <input type="date" value={date} max={today}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-xl mt-1 h-9 border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
        </div>

        {/* Nuovo entry */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 space-y-3">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4" style={{ color: '#A7C7E7' }} />
            <p className="text-sm font-bold text-gray-800" style={{ fontFamily: 'Nunito' }}>
              Scrivi nel diario — <span className="text-gray-400 font-normal capitalize">{formatted}</span>
            </p>
          </div>

          {/* Selezione alunni */}
          <div>
            <button type="button"
              onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-2 w-full text-left py-1">
              <Baby className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-semibold text-gray-700">
                Alunni destinatari
                <span className="text-gray-400 font-normal ml-1">
                  ({allStudents ? `tutti — ${classStudents.length}` : `${selStudents.length} selezionati`})
                </span>
              </span>
              {showPicker ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                           : <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />}
            </button>

            {showPicker && (
              <div className="mt-1.5 space-y-1 max-h-44 overflow-y-auto">
                {/* Tutti */}
                <button type="button"
                  onClick={() => { setAllStudents(true); setSelStudents([]); }}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors
                    ${allStudents ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                  {allStudents && <Check className="w-3 h-3 flex-shrink-0" />}
                  <Users className="w-3.5 h-3.5 flex-shrink-0" />
                  Tutta la classe ({classStudents.length})
                </button>
                {classStudents.map(s => {
                  const isSel = selStudents.includes(s.id);
                  return (
                    <button key={s.id} type="button"
                      onClick={() => { setAllStudents(false); toggleStudent(s.id); }}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs transition-colors
                        ${isSel ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                      {isSel && <Check className="w-3 h-3 flex-shrink-0" />}
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: '#A7C7E7' }}>
                        {s.name.charAt(0)}
                      </div>
                      {s.name} {s.cognome || ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Testo diario */}
          <div>
            <Label className="text-xs font-medium text-gray-600">Aggiornamento della giornata *</Label>
            <Textarea value={summary} onChange={e => setSummary(e.target.value)}
              rows={5} className="rounded-xl mt-1 text-sm resize-none"
              placeholder="Descrivi come è andata la giornata, le attività svolte, eventuali note..." />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          {saved && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-700 font-semibold">Diario salvato con successo!</span>
            </div>
          )}

          <Button onClick={handleSubmit}
            disabled={loading || !summary.trim() || (!allStudents && selStudents.length === 0)}
            className="w-full rounded-2xl h-11 font-bold"
            style={{ backgroundColor: '#A7C7E7' }}>
            {loading ? 'Salvataggio...' : 'Pubblica nel Diario'}
          </Button>
        </div>

        {/* Entries precedenti per questa data */}
        {entries.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
              Già pubblicato per {formatted}
            </p>
            {entries.map(e => (
              <div key={e.id} className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-2 capitalize">{formatted}</p>
                <p className="text-sm text-gray-800 leading-relaxed">{e.summary}</p>
                {e.student_ids?.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-2">
                    Per: {e.student_ids.map(id => {
                      const s = students.find(st => st.id === id);
                      return s?.name || id;
                    }).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
