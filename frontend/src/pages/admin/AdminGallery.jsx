import { C } from '@/config/tenant';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Image as ImageIcon, Trash2, X, Check } from 'lucide-react';

/**
 * Galleria per la DIREZIONE: la dirigente sceglie una classe, vede le foto/video
 * pubblicati e può ELIMINARLE. Il backend consente la delete al ruolo admin
 * (DELETE /api/gallery/{id}, scoping per sede/org). Foto di minori → conferma esplicita.
 */
export default function AdminGallery() {
  const { sede } = useAuth();
  const PAGE = 48;
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('all');   // 'all' = TUTTE le classi (default direzione)
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);   // foto in attesa di conferma eliminazione
  const [deletingId, setDeletingId] = useState(null);

  // Carica le classi della sede attiva (la dirigente cambia sede dallo switcher in alto)
  useEffect(() => {
    api.get('/classes')
      .then(r => {
        const cs = r.data || [];
        setClasses(cs);
        setClassId(prev => (prev === 'all' || cs.some(c => c.id === prev)) ? prev : 'all');
      })
      .catch(() => setError('Impossibile caricare le classi.'));
  }, [sede]);

  // Carica le foto: 'all' = TUTTE le classi accessibili (il backend scopa per sede/org della
  // direzione — per una superadmin: tutte le sedi dell'org); altrimenti la singola classe.
  const loadPhotos = (reset) => {
    const off = reset ? 0 : offset;
    const q = classId === 'all'
      ? `/gallery?limit=${PAGE}&offset=${off}`
      : `/gallery?class_id=${classId}&limit=${PAGE}&offset=${off}`;
    setError('');
    reset ? setLoading(true) : setLoadingMore(true);
    api.get(q)
      .then(r => {
        const data = r.data || [];
        setItems(prev => reset ? data : [...prev, ...data]);
        setOffset(off + data.length);
        setHasMore(data.length === PAGE);
      })
      .catch(() => setError('Impossibile caricare le foto.'))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  };
  useEffect(() => { loadPhotos(true); /* eslint-disable-next-line */ }, [classId, sede]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    setError('');
    try {
      await api.delete(`/gallery/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
      setConfirmId(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Impossibile eliminare la foto. Riprova.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout title="Galleria" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-gallery-page">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${C.accentGreen}1a`, color: C.accentGreen }}>
            <ImageIcon className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>Galleria foto</h1>
            <p className="text-xs text-gray-500">Tutte le foto di tutte le classi. Rivedi ed elimina.</p>
          </div>
        </div>

        {/* Selettore classe — "Tutte le classi" + ogni sezione */}
        <div className="flex gap-1.5 flex-wrap" data-testid="admin-gallery-classes">
          {[{ id: 'all', name: '🏫 Tutte le classi' }, ...classes].map(c => {
            const active = c.id === classId;
            return (
              <button key={c.id} onClick={() => setClassId(c.id)} data-testid={`gallery-class-${c.id}`}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                style={active ? { backgroundColor: C.accentPink, borderColor: 'transparent', color: '#fff' } : { borderColor: '#E5E7EB', color: '#6B7280' }}>
                {c.name}
              </button>
            );
          })}
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2" data-testid="admin-gallery-error">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Caricamento…</p>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <ImageIcon className="w-10 h-10 mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Nessuna foto</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-3 gap-2" data-testid="admin-gallery-grid">
            {items.map(item => (
              <div key={item.id} className="aspect-square rounded-xl overflow-hidden relative bg-gray-100" data-testid={`gallery-item-${item.id}`}>
                <img src={item.thumbnail_url || item.media_url} alt={item.caption || ''} className="w-full h-full object-cover" loading="lazy" />

                {confirmId === item.id ? (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 p-2">
                    <p className="text-white text-[11px] font-bold text-center">Eliminare questa foto?</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}
                        data-testid={`gallery-confirm-delete-${item.id}`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white"
                        style={{ backgroundColor: '#ef4444' }}>
                        <Check className="w-3 h-3" /> {deletingId === item.id ? '…' : 'Sì'}
                      </button>
                      <button onClick={() => setConfirmId(null)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-700 bg-white">
                        <X className="w-3 h-3" /> No
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmId(item.id)} data-testid={`gallery-delete-${item.id}`}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/50 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
                    title="Elimina foto">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {hasMore && (
            <button onClick={() => loadPhotos(false)} disabled={loadingMore}
              data-testid="admin-gallery-more"
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold border"
              style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>
              {loadingMore ? 'Caricamento…' : 'Carica altre foto'}
            </button>
          )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
