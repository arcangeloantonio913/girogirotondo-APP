import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { BookOpen, Grid3X3, Image, UtensilsCrossed, Calendar, ChevronRight, Camera, Clock, CheckCircle2, Moon, Bath, Cookie } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    { label: 'Presente', active: griglia.presence, icon: CheckCircle2, color: '#32CD32' },
    { label: 'Bagno', active: griglia.bathroom, icon: Bath, color: '#4169E1' },
    { label: 'Riposo', active: griglia.sleep, icon: Moon, color: '#8B5CF6' },
    { label: 'Merenda', active: griglia.snack, icon: Cookie, color: '#F59E0B' },
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
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm" style={{ backgroundColor: '#FF69B4' }}>
            {child?.name?.charAt(0) || user?.name?.charAt(0) || '?'}
          </div>
        </div>
        {child && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ backgroundColor: '#4169E1' }}>
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
        className="w-full bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5 border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 text-left mb-4 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#EBF0FF' }}>
            <BookOpen className="w-5 h-5" style={{ color: '#4169E1' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>Diario di Bordo</h3>
            <p className="text-[10px] text-gray-400 font-medium">Aggiornamento di oggi</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
        <div className="bg-blue-50/60 rounded-xl p-3.5">
          <p className="text-xs text-gray-700 leading-relaxed line-clamp-3" data-testid="diario-preview-text">
            {diary?.summary || 'Nessun aggiornamento disponibile per oggi. La maestra non ha ancora pubblicato il diario.'}
          </p>
        </div>
      </button>

      {/* === GRIGLIA GIORNALIERA === */}
      <button
        data-testid="parent-card-griglia"
        onClick={() => navigate('/parent/griglia')}
        className="w-full bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5 border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 text-left mb-4 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FFF0F7' }}>
            <Grid3X3 className="w-5 h-5" style={{ color: '#FF69B4' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>Griglia Giornaliera</h3>
            <p className="text-[10px] text-gray-400 font-medium">La giornata di {child?.name?.split(' ')[0] || 'tuo figlio/a'}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
        {grigliaActivities.length > 0 ? (
          <div className="grid grid-cols-4 gap-2" data-testid="griglia-preview-badges">
            {grigliaActivities.map((act, i) => (
              <div key={i} className={`flex flex-col items-center gap-1 p-2 rounded-xl ${act.active ? 'bg-opacity-10' : 'bg-gray-50'}`} style={act.active ? { backgroundColor: `${act.color}12` } : {}}>
                <act.icon className="w-4 h-4" style={{ color: act.active ? act.color : '#D1D5DB' }} />
                <span className="text-[9px] font-semibold" style={{ color: act.active ? act.color : '#9CA3AF' }}>{act.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-pink-50/60 rounded-xl p-3">
            <p className="text-xs text-gray-500 text-center">Dati non ancora disponibili</p>
          </div>
        )}
        {griglia?.notes && (
          <div className="mt-2 px-1">
            <p className="text-[10px] text-gray-500 italic">Nota: {griglia.notes}</p>
          </div>
        )}
      </button>

      {/* === FOTO E VIDEO DEL GIORNO === */}
      <div className="mb-4" data-testid="parent-card-galleria">
        <button
          onClick={() => navigate('/parent/gallery')}
          className="w-full text-left mb-2"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F0FFF0' }}>
              <Camera className="w-5 h-5" style={{ color: '#32CD32' }} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>Foto e Video del Giorno</h3>
              <p className="text-[10px] text-gray-400 font-medium">{displayGallery.length} contenuti disponibili</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </button>
        {/* Horizontal Thumbnail Gallery */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" data-testid="gallery-thumbnail-strip">
          {displayGallery.slice(0, 6).map((item, idx) => (
            <button
              key={item.id || idx}
              onClick={() => navigate('/parent/gallery')}
              className="flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-lg transition-all hover:-translate-y-0.5 relative group"
              data-testid={`gallery-thumb-${idx}`}
            >
              <img
                src={item.media_url || item.url}
                alt={item.caption}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
          {displayGallery.length > 4 && (
            <button
              onClick={() => navigate('/parent/gallery')}
              className="flex-shrink-0 w-28 h-28 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-200 hover:border-green-300 transition-colors"
              data-testid="gallery-view-all"
            >
              <div className="text-center">
                <Image className="w-6 h-6 mx-auto text-gray-300 mb-1" />
                <span className="text-[10px] font-semibold text-gray-400">Vedi tutte</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* === ALIMENTAZIONE & DIETA === */}
      <button
        data-testid="parent-card-alimentazione"
        onClick={() => navigate('/parent/alimentazione')}
        className="w-full bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5 border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 text-left mb-4 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
            <UtensilsCrossed className="w-5 h-5" style={{ color: '#F59E0B' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>Alimentazione & Dieta</h3>
            <p className="text-[10px] text-gray-400 font-medium">Menu del giorno</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
        {meal ? (
          <div className="grid grid-cols-2 gap-2" data-testid="meal-preview-grid">
            <div className="bg-pink-50/60 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400 font-medium">Primo</p>
              <p className="text-xs font-semibold text-gray-800 truncate">{meal.primo}</p>
            </div>
            <div className="bg-blue-50/60 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400 font-medium">Secondo</p>
              <p className="text-xs font-semibold text-gray-800 truncate">{meal.secondo}</p>
            </div>
            <div className="bg-green-50/60 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400 font-medium">Contorno</p>
              <p className="text-xs font-semibold text-gray-800 truncate">{meal.contorno}</p>
            </div>
            <div className="bg-amber-50/60 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400 font-medium">Frutta</p>
              <p className="text-xs font-semibold text-gray-800 truncate">{meal.frutta}</p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50/60 rounded-xl p-3">
            <p className="text-xs text-gray-500 text-center">Menu non ancora disponibile</p>
          </div>
        )}
      </button>

      {/* Floating Action Button */}
      <button
        data-testid="book-appointment-fab"
        onClick={() => setBookingOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 active:scale-95 z-20"
        style={{ backgroundColor: '#4169E1' }}
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
              style={{ backgroundColor: '#4169E1' }}
            >
              {bookingLoading ? 'Prenotazione...' : 'Conferma Prenotazione'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
