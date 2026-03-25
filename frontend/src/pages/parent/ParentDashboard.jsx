import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { BookOpen, Grid3X3, Image, UtensilsCrossed, Calendar, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ParentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [child, setChild] = useState(null);
  const [diary, setDiary] = useState(null);
  const [griglia, setGriglia] = useState(null);
  const [galleryCount, setGalleryCount] = useState(0);
  const [meal, setMeal] = useState(null);
  const [className, setClassName] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingSlot, setBookingSlot] = useState('');
  const [bookingReason, setBookingReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

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
        setGalleryCount(galleryRes.data?.length || 0);
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

  const cards = [
    {
      id: 'diario',
      icon: BookOpen,
      color: '#4169E1',
      bgColor: '#EBF0FF',
      title: 'Diario di Bordo',
      subtitle: diary?.summary?.slice(0, 60) + (diary?.summary?.length > 60 ? '...' : '') || 'Nessun aggiornamento',
      path: '/parent/diario',
    },
    {
      id: 'griglia',
      icon: Grid3X3,
      color: '#FF69B4',
      bgColor: '#FFF0F7',
      title: 'Griglia Giornaliera',
      subtitle: griglia ? `Presente - ${griglia.notes || 'Nessuna nota'}` : 'Dati non disponibili',
      path: '/parent/griglia',
    },
    {
      id: 'galleria',
      icon: Image,
      color: '#32CD32',
      bgColor: '#F0FFF0',
      title: 'Galleria Personale',
      subtitle: `${galleryCount} foto disponibili`,
      path: '/parent/gallery',
    },
    {
      id: 'alimentazione',
      icon: UtensilsCrossed,
      color: '#F59E0B',
      bgColor: '#FFFBEB',
      title: 'Alimentazione',
      subtitle: meal ? `${meal.primo} - ${meal.secondo}` : 'Menu non disponibile',
      path: '/parent/alimentazione',
    },
  ];

  return (
    <AppLayout>
      {/* Greeting */}
      <div className="mb-6" data-testid="parent-greeting">
        <p className="text-sm text-gray-500 font-medium" style={{ fontFamily: 'Poppins' }}>Bentornato/a,</p>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
          {user?.name}
        </h2>
        {child && (
          <p className="text-sm mt-1 font-medium" style={{ color: '#4169E1' }}>
            {child.name} - Classe {className}
          </p>
        )}
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="parent-dashboard-cards">
        {cards.map((card) => (
          <button
            key={card.id}
            data-testid={`parent-card-${card.id}`}
            onClick={() => navigate(card.path)}
            className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5 border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 text-left flex items-start gap-4 active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: card.bgColor }}>
              <card.icon className="w-6 h-6" style={{ color: card.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>{card.title}</h3>
              <p className="text-xs text-gray-500 mt-1 truncate">{card.subtitle}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
          </button>
        ))}
      </div>

      {/* Floating Action Button */}
      <button
        data-testid="book-appointment-fab"
        onClick={() => setBookingOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 active:scale-95 z-20"
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
