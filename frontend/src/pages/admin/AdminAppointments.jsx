import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Calendar, Clock, User, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAYS_IT   = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];

function getStatusStyle(status) {
  if (status === 'confirmed') return { bg: '#F0FFF0', color: '#32CD32', label: 'Confermato',  Icon: CheckCircle2 };
  if (status === 'cancelled') return { bg: '#FEF2F2', color: '#EF4444', label: 'Annullato',   Icon: XCircle };
  return                             { bg: '#FFFBEB', color: '#F59E0B', label: 'In Attesa',   Icon: AlertCircle };
}

function toGoogleCalendarUrl(apt) {
  const date = apt.date.replace(/-/g, '');
  const [h, m] = (apt.time_slot || '09:00').split(':').map(Number);
  const start = `${date}T${String(h).padStart(2,'0')}${String(m).padStart(2,'0')}00`;
  const endH  = String(h + 1).padStart(2,'0');
  const end   = `${date}T${endH}${String(m).padStart(2,'0')}00`;
  const title  = encodeURIComponent(`Colloquio — ${apt.parent_name}`);
  const detail = encodeURIComponent(apt.reason || 'Colloquio scolastico');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${detail}`;
}

export default function AdminAppointments() {
  const { sede } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [view, setView]         = useState('calendar'); // 'calendar' | 'list'
  const [selectedDay, setSelectedDay] = useState(null);
  const today = new Date();
  const [calMonth, setCalMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  useEffect(() => {
    api.get('/appointments').then(res => setAppointments(res.data)).catch(() => {});
  }, [sede]);

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/appointments/${id}/status?status=${status}`);
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (err) { console.error(err); }
  };

  // Raggruppa appuntamenti per giorno
  const byDay = useMemo(() => {
    const map = {};
    appointments.forEach(a => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [appointments]);

  // Giorni del mese corrente per il calendario
  const calDays = useMemo(() => {
    const { year, month } = calMonth;
    const firstDay = new Date(year, month, 1).getDay(); // 0=dom
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [calMonth]);

  const dayKey = (d) => {
    const { year, month } = calMonth;
    return `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  };

  const selectedAppts = selectedDay ? (byDay[dayKey(selectedDay)] || []) : [];

  const totalPending   = appointments.filter(a => a.status === 'pending').length;
  const totalConfirmed = appointments.filter(a => a.status === 'confirmed').length;

  return (
    <AppLayout title="Appuntamenti" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-appointments-page">

        {/* Header stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-3 shadow-md border border-gray-100 text-center">
            <p className="text-xl font-black" style={{ color: '#4169E1' }}>{appointments.length}</p>
            <p className="text-[10px] text-gray-400 font-semibold">Totale</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-md border border-gray-100 text-center">
            <p className="text-xl font-black" style={{ color: '#F59E0B' }}>{totalPending}</p>
            <p className="text-[10px] text-gray-400 font-semibold">In attesa</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-md border border-gray-100 text-center">
            <p className="text-xl font-black" style={{ color: '#32CD32' }}>{totalConfirmed}</p>
            <p className="text-[10px] text-gray-400 font-semibold">Confermati</p>
          </div>
        </div>

        {/* Toggle vista */}
        <div className="flex bg-white rounded-2xl shadow-md border border-gray-100 p-1">
          <button onClick={() => setView('calendar')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${view === 'calendar' ? 'text-white' : 'text-gray-400'}`}
            style={view === 'calendar' ? { backgroundColor: '#4169E1' } : {}}>
            Calendario
          </button>
          <button onClick={() => setView('list')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${view === 'list' ? 'text-white' : 'text-gray-400'}`}
            style={view === 'list' ? { backgroundColor: '#4169E1' } : {}}>
            Lista
          </button>
        </div>

        {/* ── Vista Calendario ─────────────────────────────────────────────── */}
        {view === 'calendar' && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            {/* Nav mese */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <button onClick={() => setCalMonth(m => {
                const d = new Date(m.year, m.month - 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <h3 className="text-sm font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
                {MONTHS_IT[calMonth.month]} {calMonth.year}
              </h3>
              <button onClick={() => setCalMonth(m => {
                const d = new Date(m.year, m.month + 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Giorni settimana */}
            <div className="grid grid-cols-7 px-2 pt-2">
              {DAYS_IT.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-gray-400 pb-1">{d}</div>
              ))}
            </div>

            {/* Celle giorni */}
            <div className="grid grid-cols-7 px-2 pb-3 gap-1">
              {calDays.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />;
                const key  = dayKey(day);
                const apts = byDay[key] || [];
                const hasBusy    = apts.some(a => a.status !== 'cancelled');
                const hasPending = apts.some(a => a.status === 'pending');
                const isToday    = key === today.toISOString().split('T')[0];
                const isSelected = selectedDay === day;

                let bg = 'transparent';
                let textColor = '#374151';
                if (isSelected) { bg = '#4169E1'; textColor = 'white'; }
                else if (hasBusy) { bg = hasPending ? '#FFFBEB' : '#F0FFF0'; }

                return (
                  <button key={key}
                    data-testid={`cal-day-${key}`}
                    onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                    className="relative flex flex-col items-center justify-center rounded-xl py-1.5 transition-all"
                    style={{ backgroundColor: bg, minHeight: 40 }}>
                    <span className="text-xs font-semibold" style={{ color: textColor,
                      fontWeight: isToday ? 800 : 600 }}>
                      {day}
                    </span>
                    {apts.length > 0 && !isSelected && (
                      <div className="flex gap-0.5 mt-0.5">
                        {apts.slice(0, 3).map((a, idx) => (
                          <span key={idx} className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: a.status === 'confirmed' ? '#32CD32' : a.status === 'cancelled' ? '#CBD5E0' : '#F59E0B' }} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="flex gap-4 px-4 pb-3 text-[10px] text-gray-400 font-semibold">
              <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />Confermato</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />In attesa</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-gray-300 mr-1" />Annullato</span>
            </div>

            {/* Appuntamenti del giorno selezionato */}
            {selectedDay && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                <p className="text-xs font-bold text-gray-500">
                  {selectedAppts.length > 0
                    ? `${selectedAppts.length} appuntament${selectedAppts.length > 1 ? 'i' : 'o'} — ${selectedDay} ${MONTHS_IT[calMonth.month]}`
                    : `Nessun appuntamento — ${selectedDay} ${MONTHS_IT[calMonth.month]}`}
                </p>
                {selectedAppts.map(apt => <AppointmentCard key={apt.id} apt={apt} onStatus={handleStatusChange} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Vista Lista ──────────────────────────────────────────────────── */}
        {view === 'list' && (
          <div className="space-y-3">
            {appointments.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center shadow-md">
                <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">Nessun appuntamento</p>
              </div>
            )}
            {appointments
              .slice().sort((a, b) => a.date.localeCompare(b.date))
              .map(apt => <AppointmentCard key={apt.id} apt={apt} onStatus={handleStatusChange} />)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function AppointmentCard({ apt, onStatus }) {
  const statusInfo = getStatusStyle(apt.status);
  return (
    <div data-testid={`appointment-card-${apt.id}`}
      className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: '#4169E1' }}>
            {apt.parent_name?.charAt(0) || '?'}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>{apt.parent_name}</p>
            <p className="text-xs text-gray-500 line-clamp-1">{apt.reason}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusInfo.bg }}>
          <statusInfo.Icon className="w-3 h-3" style={{ color: statusInfo.color }} />
          <span className="text-[10px] font-bold" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{new Date(apt.date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{apt.time_slot}</span>
        </div>
        {/* Google Calendar */}
        <a href={toGoogleCalendarUrl(apt)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-500 hover:text-blue-700 ml-auto"
          title="Aggiungi a Google Calendar">
          <ExternalLink className="w-3 h-3" />
          <span className="text-[10px] font-semibold">Google Cal</span>
        </a>
      </div>

      {apt.status === 'pending' && (
        <div className="flex gap-2">
          <button data-testid={`confirm-appointment-${apt.id}`}
            onClick={() => onStatus(apt.id, 'confirmed')}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-white"
            style={{ backgroundColor: '#32CD32' }}>Conferma</button>
          <button data-testid={`cancel-appointment-${apt.id}`}
            onClick={() => onStatus(apt.id, 'cancelled')}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-red-500 bg-red-50">Annulla</button>
        </div>
      )}
    </div>
  );
}
