import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Bell, Megaphone, FileText, Camera, UtensilsCrossed, BookMarked } from 'lucide-react';

const ICON_MAP = {
  avviso:   { icon: Megaphone,      color: '#4169E1', bg: '#EBF0FF' },
  document: { icon: FileText,       color: '#32CD32', bg: '#F0FFF0' },
  gallery:  { icon: Camera,         color: '#FF69B4', bg: '#FFF0F7' },
  meal:     { icon: UtensilsCrossed,color: '#F59E0B', bg: '#FFFBEB' },
  diary:    { icon: BookMarked,     color: '#A7C7E7', bg: '#EBF5FF' },
};

export default function ParentNotifiche() {
  const { user } = useAuth();
  const [notifiche, setNotifiche] = useState([]);
  const [avvisi, setAvvisi]       = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes] = await Promise.all([
          api.get('/avvisi'),
        ]);
        // Gli avvisi sono le notifiche principali per i genitori
        setAvvisi(aRes.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const allItems = [
    ...avvisi.map(a => ({
      id: a.id,
      type: 'avviso',
      titolo: a.titolo,
      testo: a.testo,
      created_at: a.created_at,
      author_name: a.author_name,
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <AppLayout title="Notifiche" showBack>
      <div className="max-w-2xl mx-auto space-y-3" data-testid="parent-notifiche-page">

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5" style={{ color: '#4169E1' }} />
          <span className="text-sm font-bold text-gray-700">{allItems.length} notifiche</span>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!loading && allItems.length === 0 && (
          <div className="bg-white rounded-2xl shadow-md p-10 text-center border border-gray-100">
            <Bell className="w-12 h-12 mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 font-medium">Nessuna notifica ricevuta</p>
          </div>
        )}

        {allItems.map(item => {
          const style = ICON_MAP[item.type] || ICON_MAP.avviso;
          const Icon  = style.icon;
          return (
            <div key={item.id} data-testid={`notifica-${item.id}`}
              className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: style.bg }}>
                  <Icon className="w-4 h-4" style={{ color: style.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: 'Nunito' }}>
                    {item.titolo}
                  </p>
                  {item.testo && (
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{item.testo}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(item.created_at).toLocaleDateString('it-IT', {
                      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                    })}
                    {item.author_name && ` · ${item.author_name}`}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
