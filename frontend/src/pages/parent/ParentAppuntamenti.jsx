import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
  Plus, Trash2,
} from 'lucide-react';

const today = new Date().toISOString().split('T')[0];

function getStatusStyle(status) {
  if (status === 'confirmed') return { bg: '#F0FFF0', color: '#32CD32', label: 'Confermato', Icon: CheckCircle2 };
  if (status === 'cancelled') return { bg: '#FEF2F2', color: '#EF4444', label: 'Annullato',  Icon: XCircle };
  return                             { bg: '#FFFBEB', color: '#F59E0B', label: 'In Attesa',  Icon: AlertCircle };
}

const DEFAULT_SLOTS = [
  '09:00','09:30','10:00','10:30','11:00','11:30',
  '14:00','14:30','15:00','15:30','16:00',
];

export default function ParentAppuntamenti() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [bookingOpen, setBookingOpen]   = useState(false);
  const [bookingDate, setBookingDate]   = useState('');
  const [bookingSlot, setBookingSlot]   = useState('');
  const [bookingReason, setBookingReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [deleteId, setDeleteId]         = useState(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!bookingDate) { setAvailableSlots([]); return; }
    api.get(`/appointments/slots?date=${bookingDate}`)
      .then(r => setAvailableSlots(r.data.available_slots || DEFAULT_SLOTS))
      .catch(() => setAvailableSlots(DEFAULT_SLOTS));
  }, [bookingDate]);

  const loadData = async () => {
    try {
      const res = await api.get('/appointments');
      setAppointments(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleBook = async () => {
    if (!bookingDate || !bookingSlot || !bookingReason.trim()) return;
    setBookingLoading(true);
    try {
      await api.post('/appointments', {
        parent_id: user.id,
        date: bookingDate,
        time_slot: bookingSlot,
        reason: bookingReason.trim(),
      });
      setBookingSuccess(true);
      setBookingDate('');
      setBookingSlot('');
      setBookingReason('');
      loadData();
    } catch (err) { console.error(err); }
    finally { setBookingLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/appointments/${id}`);
      setDeleteId(null);
      loadData();
    } catch (err) { console.error(err); }
  };

  const openBooking = () => {
    setBookingDate('');
    setBookingSlot('');
    setBookingReason('');
    setBookingSuccess(false);
    setBookingOpen(true);
  };

  const pending   = appointments.filter(a => a.status === 'pending');
  const confirmed = appointments.filter(a => a.status === 'confirmed');
  const past      = appointments.filter(a => a.status === 'cancelled' || (a.date < today && a.status === 'confirmed'));

  return (
    <AppLayout title="Le mie Prenotazioni" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="parent-appuntamenti-page">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: '#A7C7E7' }} />
            <span className="text-sm font-bold text-gray-700">
              {appointments.length} prenotazion{appointments.length === 1 ? 'e' : 'i'}
            </span>
          </div>
          <Button onClick={openBooking}
            className="rounded-2xl font-semibold h-9 text-sm"
            style={{ backgroundColor: '#A7C7E7' }}>
            <Plus className="w-4 h-4 mr-1" />
            Nuova Prenotazione
          </Button>
        </div>

        {/* In attesa */}
        {pending.length > 0 && (
          <Section title="In Attesa di Conferma" color="#F59E0B">
            {pending.map(apt => (
              <AptCard key={apt.id} apt={apt} onDelete={() => setDeleteId(apt.id)} />
            ))}
          </Section>
        )}

        {/* Confermate */}
        {confirmed.length > 0 && (
          <Section title="Confermate" color="#32CD32">
            {confirmed.filter(a => a.date >= today).map(apt => (
              <AptCard key={apt.id} apt={apt} onDelete={() => setDeleteId(apt.id)} />
            ))}
          </Section>
        )}

        {/* Nessuna prenotazione */}
        {appointments.length === 0 && !loading && (
          <div className="bg-white rounded-2xl shadow-md p-10 text-center border border-gray-100">
            <Calendar className="w-14 h-14 mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 font-medium">Nessuna prenotazione</p>
            <p className="text-xs text-gray-400 mt-1">Clicca "Nuova Prenotazione" per fissare un colloquio</p>
          </div>
        )}

        {/* Storico */}
        {past.length > 0 && (
          <Section title="Storico" color="#9CA3AF">
            {past.map(apt => (
              <AptCard key={apt.id} apt={apt} />
            ))}
          </Section>
        )}

        {/* Dialog prenotazione */}
        <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="booking-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>
                Prenota Colloquio
              </DialogTitle>
            </DialogHeader>
            {bookingSuccess ? (
              <div className="py-6 flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="w-14 h-14" style={{ color: '#32CD32' }} />
                <p className="text-base font-bold text-gray-900">Prenotazione inviata!</p>
                <p className="text-sm text-gray-500">
                  Riceverai una email di conferma. L'amministrazione confermerà l'appuntamento a breve.
                </p>
                <Button onClick={() => { setBookingOpen(false); setBookingSuccess(false); }}
                  className="w-full rounded-2xl h-10 mt-2" style={{ backgroundColor: '#A7C7E7' }}>
                  Chiudi
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Data *</Label>
                  <Input type="date" value={bookingDate} min={today}
                    onChange={e => { setBookingDate(e.target.value); setBookingSlot(''); }}
                    className="rounded-xl mt-1" />
                </div>

                {bookingDate && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Orario *
                      {availableSlots.length === 0 && <span className="text-amber-500 text-xs ml-2">Nessuno slot disponibile</span>}
                    </Label>
                    {availableSlots.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {availableSlots.map(slot => (
                          <button key={slot} type="button" onClick={() => setBookingSlot(slot)}
                            className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${bookingSlot === slot ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-blue-200'}`}
                            style={bookingSlot === slot ? { backgroundColor: '#A7C7E7', borderColor: '#A7C7E7' } : {}}>
                            {slot}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2 mt-1">
                        Tutti gli slot per questa data sono occupati. Scegli un altro giorno.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-gray-700">Motivo *</Label>
                  <Input value={bookingReason}
                    onChange={e => setBookingReason(e.target.value)}
                    placeholder="Es. Colloquio, chiarimento, aggiornamento..."
                    className="rounded-xl mt-1" autoComplete="off" />
                </div>

                <Button onClick={handleBook}
                  disabled={bookingLoading || !bookingDate || !bookingSlot || !bookingReason.trim()}
                  className="w-full rounded-2xl font-bold h-11"
                  style={{ backgroundColor: '#A7C7E7' }}>
                  {bookingLoading ? 'Invio in corso...' : 'Prenota e Invia Richiesta'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog conferma eliminazione */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent className="rounded-2xl max-w-xs mx-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-red-500">Cancella prenotazione?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <p className="text-sm text-gray-600">Questa azione è irreversibile.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDeleteId(null)}
                  className="flex-1 rounded-xl h-10 text-sm">Annulla</Button>
                <Button onClick={() => handleDelete(deleteId)}
                  className="flex-1 rounded-xl h-10 text-sm font-bold text-white"
                  style={{ backgroundColor: '#EF4444' }}>
                  Cancella
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

function Section({ title, color, children }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider mb-2 px-1" style={{ color }}>{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function AptCard({ apt, onDelete }) {
  const { bg, color, label, Icon } = getStatusStyle(apt.status);
  return (
    <div data-testid={`apt-card-${apt.id}`}
      className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#A7C7E715' }}>
            <Calendar className="w-4 h-4" style={{ color: '#A7C7E7' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>{apt.reason}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(apt.date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />{apt.time_slot}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ backgroundColor: bg }}>
            <Icon className="w-3 h-3" style={{ color }} />
            <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
          </div>
          {apt.status === 'pending' && onDelete && (
            <button onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
