import { useState, useEffect } from 'react';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Calendar, Clock, User, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

function getStatusStyle(status) {
  if (status === 'confirmed') return { bg: '#F0FFF0', color: '#32CD32', label: 'Confermato', Icon: CheckCircle2 };
  if (status === 'cancelled') return { bg: '#FEF2F2', color: '#EF4444', label: 'Annullato', Icon: XCircle };
  return { bg: '#FFFBEB', color: '#F59E0B', label: 'In Attesa', Icon: AlertCircle };
}

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    api.get('/appointments').then(res => setAppointments(res.data));
  }, []);

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/appointments/${id}/status?status=${status}`);
      setAppointments(appointments.map(a => a.id === id ? { ...a, status } : a));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AppLayout title="Appuntamenti" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-appointments-page">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5" style={{ color: '#F59E0B' }} />
          <span className="text-sm font-bold text-gray-700">{appointments.length} prenotazioni</span>
        </div>

        {appointments.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Nessun appuntamento</p>
          </div>
        ) : (
          appointments.map((apt) => {
            const statusInfo = getStatusStyle(apt.status);
            return (
              <div key={apt.id} data-testid={`appointment-card-${apt.id}`} className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5 border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#4169E1' }}>
                      {apt.parent_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>{apt.parent_name}</p>
                      <p className="text-xs text-gray-500">{apt.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: statusInfo.bg }}>
                    <statusInfo.Icon className="w-3.5 h-3.5" style={{ color: statusInfo.color }} />
                    <span className="text-xs font-bold" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(apt.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{apt.time_slot}</span>
                  </div>
                </div>

                {apt.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      data-testid={`confirm-appointment-${apt.id}`}
                      onClick={() => handleStatusChange(apt.id, 'confirmed')}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-colors"
                      style={{ backgroundColor: '#32CD32' }}
                    >
                      Conferma
                    </button>
                    <button
                      data-testid={`cancel-appointment-${apt.id}`}
                      onClick={() => handleStatusChange(apt.id, 'cancelled')}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      Annulla
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
