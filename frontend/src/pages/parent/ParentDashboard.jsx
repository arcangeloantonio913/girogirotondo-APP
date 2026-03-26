import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Calendar, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/* Illustrated SVG icons for friendly feel */
const IllustratedDiary = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="8" y="6" width="28" height="32" rx="5" fill="#A7C7E7"/><rect x="12" y="12" width="16" height="2.5" rx="1" fill="white" opacity="0.8"/><rect x="12" y="17" width="20" height="2" rx="1" fill="white" opacity="0.5"/><rect x="12" y="22" width="14" height="2" rx="1" fill="white" opacity="0.5"/><circle cx="32" cy="32" r="8" fill="#98FB98"/><path d="M29 32l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const IllustratedGrid = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="6" y="6" width="32" height="32" rx="6" fill="#F4C2C2"/><rect x="11" y="11" width="9" height="9" rx="2" fill="white" opacity="0.7"/><rect x="24" y="11" width="9" height="9" rx="2" fill="white" opacity="0.7"/><rect x="11" y="24" width="9" height="9" rx="2" fill="white" opacity="0.7"/><rect x="24" y="24" width="9" height="9" rx="2" fill="white" opacity="0.7"/><circle cx="15.5" cy="15.5" r="2" fill="#F4C2C2"/><circle cx="28.5" cy="15.5" r="2" fill="#F4C2C2"/></svg>
);
const IllustratedCamera = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="6" y="12" width="32" height="24" rx="5" fill="#98FB98"/><circle cx="22" cy="24" r="7" fill="white" opacity="0.8"/><circle cx="22" cy="24" r="4" fill="#98FB98"/><rect x="16" y="8" width="12" height="6" rx="2" fill="#98FB98"/></svg>
);
const IllustratedMeal = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><ellipse cx="22" cy="28" rx="14" ry="10" fill="#F4C2C2" opacity="0.5"/><circle cx="22" cy="22" r="12" fill="#FFFBEB" stroke="#F4C2C2" strokeWidth="2"/><path d="M16 20c0 0 2-3 6-3s6 3 6 3" stroke="#F4C2C2" strokeWidth="1.5" strokeLinecap="round"/><circle cx="18" cy="22" r="1.5" fill="#98FB98"/><circle cx="22" cy="24" r="1.5" fill="#A7C7E7"/><circle cx="26" cy="21" r="1.5" fill="#F4C2C2"/></svg>
);
const EmptyBear = ({ text }) => (
  <div className="flex flex-col items-center py-6">
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="36" r="18" fill="#F4C2C2"/>
      <circle cx="18" cy="20" r="8" fill="#F4C2C2"/><circle cx="46" cy="20" r="8" fill="#F4C2C2"/>
      <circle cx="18" cy="20" r="5" fill="#FFFDD0"/><circle cx="46" cy="20" r="5" fill="#FFFDD0"/>
      <circle cx="26" cy="32" r="2" fill="#555"/><circle cx="38" cy="32" r="2" fill="#555"/>
      <ellipse cx="32" cy="38" rx="3" ry="2" fill="#555"/>
      <path d="M26 42c0 0 3 3 6 3s6-3 6-3" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    <p className="text-sm text-gray-400 mt-2 font-medium">{text}</p>
  </div>
);

const MOCK_GALLERY = [
  { id: 'mg1', url: 'https://images.unsplash.com/photo-1627764940620-90393d0e8c34?w=400&h=400&fit=crop', caption: 'Giochi in giardino' },
  { id: 'mg2', url: 'https://images.pexels.com/photos/5435599/pexels-photo-5435599.jpeg?w=400&h=400&fit=crop', caption: 'Blocchi creativi' },
  { id: 'mg3', url: 'https://images.pexels.com/photos/3662648/pexels-photo-3662648.jpeg?w=400&h=400&fit=crop', caption: 'Attivita artistiche' },
  { id: 'mg4', url: 'https://images.pexels.com/photos/5905683/pexels-photo-5905683.jpeg?w=400&h=400&fit=crop', caption: 'Ora di pranzo' },
];

export default function ParentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [child, setChild] = useState(null);
  const [diary, setDiary] = useState(null);
  const [griglia, setGriglia] = useState(null);
  const [galleryItems, setGalleryItems] = useState([]);
  const [meal, setMeal] = useState(null);
  const [className, setClassName] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingSlot, setBookingSlot] = useState('');
  const [bookingReason, setBookingReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    if (!user?.child_id) return;
    const load = async () => {
      try {
        const [childRes, diaryRes, grigliaRes, galleryRes, mealRes, classesRes] = await Promise.all([
          api.get(`/students/${user.child_id}`),
          api.get(`/diary?class_id=${user.class_id}&date=${today}`),
          api.get(`/griglia?student_id=${user.child_id}&date=${today}`),
          api.get(`/gallery?student_id=${user.child_id}`),
          api.get(`/meals?class_id=${user.class_id}&date=${today}`),
          api.get('/classes'),
        ]);
        setChild(childRes.data);
        setDiary(diaryRes.data?.[0] || null);
        setGriglia(grigliaRes.data?.[0] || null);
        setGalleryItems(galleryRes.data || []);
        setMeal(mealRes.data?.[0] || null);
        const cls = classesRes.data.find(c => c.id === user.class_id);
        if (cls) setClassName(cls.name);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      }
    };
    load();
  }, [user, today]);

  useEffect(() => {
    if (bookingDate) {
      api.get(`/appointment-slots?date=${bookingDate}`).then(res => {
        setAvailableSlots(res.data.available_slots || []);
      });
    }
  }, [bookingDate]);

  const handleBooking = async () => {
    if (!bookingDate || !bookingSlot || !bookingReason) return;
    setBookingLoading(true);
    try {
      await api.post('/appointments', {
        parent_id: user.id,
        date: bookingDate,
        time_slot: bookingSlot,
        reason: bookingReason,
      });
      setBookingOpen(false);
      setBookingDate('');
      setBookingSlot('');
      setBookingReason('');
    } catch (err) {
      console.error(err);
    } finally {
      setBookingLoading(false);
    }
  };

  const grigliaActivities = griglia ? [
    { label: 'Colazione', active: griglia.colazione, color: '#A7C7E7' },
    { label: 'Pranzo', active: griglia.pranzo, color: '#F4C2C2' },
    { label: 'Merenda', active: griglia.merenda, color: '#98FB98' },
    { label: 'Pisolino', active: griglia.pisolino, color: '#D4B8E0' },
  ] : [];

  const displayGallery = galleryItems.length > 0 ? galleryItems : MOCK_GALLERY;

  return (
    <AppLayout>
      {/* Greeting Header */}
      <div className="mb-5" data-testid="parent-greeting">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium" style={{ fontFamily: 'Poppins' }}>Bentornato/a,</p>
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
              {user?.name}
            </h2>
          </div>
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm" style={{ backgroundColor: '#F4C2C2' }}>
            {child?.name?.charAt(0) || user?.name?.charAt(0) || '?'}
          </div>
        </div>
        {child && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ backgroundColor: '#A7C7E7' }}>
              {child.name}
            </span>
            <span className="text-xs font-semibold text-gray-500">
              Classe {className}
            </span>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2 capitalize">{todayFormatted}</p>
      </div>

      {/* === DIARIO DI BORDO === */}
      <button
        data-testid="parent-card-diario"
        onClick={() => navigate('/parent/diario')}
        className="w-full bg-white rounded-2xl shadow-md p-5 border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 text-left mb-4 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 mb-3">
          <IllustratedDiary />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>Diario di Bordo</h3>
            <p className="text-[10px] text-gray-400 font-medium">Aggiornamento di oggi</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
        {diary ? (
          <div className="rounded-xl p-3.5" style={{ backgroundColor: '#A7C7E715' }}>
            <p className="text-xs text-gray-700 leading-relaxed line-clamp-3" data-testid="diario-preview-text">
              {diary.summary}
            </p>
          </div>
        ) : (
          <EmptyBear text="La maestra non ha ancora scritto il diario!" />
        )}
      </button>

      {/* === GRIGLIA GIORNALIERA === */}
      <button
        data-testid="parent-card-griglia"
        onClick={() => navigate('/parent/griglia')}
        className="w-full bg-white rounded-2xl shadow-md p-5 border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 text-left mb-4 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 mb-3">
          <IllustratedGrid />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>Griglia Giornaliera</h3>
            <p className="text-[10px] text-gray-400 font-medium">La giornata di {child?.name?.split(' ')[0] || 'tuo figlio/a'}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
        {grigliaActivities.length > 0 ? (
          <div className="grid grid-cols-4 gap-2" data-testid="griglia-preview-badges">
            {grigliaActivities.map((act, i) => (
              <div key={i} className="flex flex-col items-center gap-1 p-2.5 rounded-xl" style={{ backgroundColor: act.active ? `${act.color}25` : '#F9FAFB' }}>
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: act.active ? act.color : '#E5E7EB' }} />
                <span className="text-[9px] font-semibold" style={{ color: act.active ? '#555' : '#9CA3AF' }}>{act.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBear text="Nessun dato per la griglia oggi!" />
        )}
        {griglia?.notes && (
          <div className="mt-2 px-1">
            <p className="text-[10px] text-gray-500 italic">Nota: {griglia.notes}</p>
          </div>
        )}
      </button>

      {/* === FOTO E VIDEO DEL GIORNO === */}
      <div className="mb-4" data-testid="parent-card-galleria">
        <button onClick={() => navigate('/parent/gallery')} className="w-full text-left mb-2">
          <div className="flex items-center gap-3">
            <IllustratedCamera />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>Foto e Video del Giorno</h3>
              <p className="text-[10px] text-gray-400 font-medium">{displayGallery.length} contenuti disponibili</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </button>
        {displayGallery.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" data-testid="gallery-thumbnail-strip">
            {displayGallery.slice(0, 6).map((item, idx) => (
              <button
                key={item.id || idx}
                onClick={() => navigate('/parent/gallery')}
                className="flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 relative group"
                data-testid={`gallery-thumb-${idx}`}
              >
                <img src={item.media_url || item.url} alt={item.caption} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
            <EmptyBear text="Nessuna foto oggi!" />
          </div>
        )}
      </div>

      {/* === ALIMENTAZIONE & DIETA === */}
      <button
        data-testid="parent-card-alimentazione"
        onClick={() => navigate('/parent/alimentazione')}
        className="w-full bg-white rounded-2xl shadow-md p-5 border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 text-left mb-4 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 mb-3">
          <IllustratedMeal />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>Alimentazione & Dieta</h3>
            <p className="text-[10px] text-gray-400 font-medium">Menu del giorno</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
        {meal ? (
          <div className="grid grid-cols-2 gap-2" data-testid="meal-preview-grid">
            <div className="rounded-xl p-2.5" style={{ backgroundColor: '#F4C2C220' }}>
              <p className="text-[10px] text-gray-400 font-medium">Primo</p>
              <p className="text-xs font-semibold text-gray-800 truncate">{meal.primo}</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: '#A7C7E720' }}>
              <p className="text-[10px] text-gray-400 font-medium">Secondo</p>
              <p className="text-xs font-semibold text-gray-800 truncate">{meal.secondo}</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: '#98FB9820' }}>
              <p className="text-[10px] text-gray-400 font-medium">Contorno</p>
              <p className="text-xs font-semibold text-gray-800 truncate">{meal.contorno}</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: '#FFFBEB' }}>
              <p className="text-[10px] text-gray-400 font-medium">Frutta</p>
              <p className="text-xs font-semibold text-gray-800 truncate">{meal.frutta}</p>
            </div>
          </div>
        ) : (
          <EmptyBear text="Menu non ancora disponibile!" />
        )}
      </button>

      {/* Floating Action Button */}
      <button
        data-testid="book-appointment-fab"
        onClick={() => setBookingOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 active:scale-95 z-20"
        style={{ backgroundColor: '#A7C7E7' }}
      >
        <Calendar className="w-6 h-6 text-white" />
      </button>

      {/* Booking Dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="booking-dialog">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
              Prenota Segreteria
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Data</Label>
              <Input
                data-testid="booking-date-input"
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                min={today}
                className="rounded-xl"
              />
            </div>
            {availableSlots.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Orario</Label>
                <Select value={bookingSlot} onValueChange={setBookingSlot}>
                  <SelectTrigger className="rounded-xl" data-testid="booking-slot-select">
                    <SelectValue placeholder="Seleziona orario" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map(slot => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Motivo</Label>
              <Input
                data-testid="booking-reason-input"
                value={bookingReason}
                onChange={(e) => setBookingReason(e.target.value)}
                placeholder="Es. Colloquio, informazioni..."
                className="rounded-xl"
              />
            </div>
            <Button
              data-testid="booking-submit-button"
              onClick={handleBooking}
              disabled={bookingLoading || !bookingDate || !bookingSlot || !bookingReason}
              className="w-full rounded-2xl font-bold h-11"
              style={{ backgroundColor: '#A7C7E7' }}
            >
              {bookingLoading ? 'Prenotazione...' : 'Conferma Prenotazione'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
