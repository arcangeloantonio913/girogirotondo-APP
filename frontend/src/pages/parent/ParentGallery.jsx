import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Image, Play, User, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Grid di foto riutilizzabile
───────────────────────────────────────────────────────────── */
function PhotoGrid({ items, onSelect }) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center shadow-md">
        <Image className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Nessuna foto disponibile</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="gallery-grid">
      {items.map((item) => (
        <button
          key={item.id}
          data-testid={`gallery-item-${item.id}`}
          onClick={() => onSelect(item, items)}
          className="relative aspect-square rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all hover:-translate-y-1 group"
        >
          <img
            src={item.thumbnail_url || item.media_url}
            alt={item.caption}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {item.media_type === 'video' && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <Play className="w-10 h-10 text-white fill-white" />
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-white text-xs font-medium truncate">{item.caption}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Lightbox con navigazione frecce
───────────────────────────────────────────────────────────── */
function Lightbox({ item, items, onClose }) {
  const idx = items.findIndex(i => i.id === item.id);

  const goPrev = useCallback((e) => {
    e.stopPropagation();
    if (idx > 0) onClose(items[idx - 1]);
  }, [idx, items, onClose]);

  const goNext = useCallback((e) => {
    e.stopPropagation();
    if (idx < items.length - 1) onClose(items[idx + 1]);
  }, [idx, items, onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft' && idx > 0) onClose(items[idx - 1]);
      if (e.key === 'ArrowRight' && idx < items.length - 1) onClose(items[idx + 1]);
      if (e.key === 'Escape') onClose(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [idx, items, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={() => onClose(null)}
      data-testid="gallery-lightbox"
    >
      <div className="max-w-lg w-full relative" onClick={e => e.stopPropagation()}>
        {/* Chiudi */}
        <button
          onClick={() => onClose(null)}
          className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
          data-testid="lightbox-close">
          <X className="w-6 h-6" />
        </button>

        {item.media_type === 'video' ? (
          <video src={item.media_url} controls autoPlay className="w-full rounded-2xl" />
        ) : (
          <img src={item.media_url} alt={item.caption} className="w-full rounded-2xl" />
        )}

        <p className="text-white text-sm text-center mt-3 font-medium">{item.caption}</p>
        <p className="text-gray-400 text-xs text-center mt-1">
          {new Date(item.created_at).toLocaleDateString('it-IT', {
            day: '2-digit', month: 'long', year: 'numeric'
          })}
        </p>

        {/* Indicatore posizione */}
        {items.length > 1 && (
          <p className="text-gray-500 text-xs text-center mt-1">{idx + 1} / {items.length}</p>
        )}
      </div>

      {/* Frecce navigazione */}
      {idx > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          data-testid="lightbox-prev">
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {idx < items.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          data-testid="lightbox-next">
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Pagina principale
───────────────────────────────────────────────────────────── */
export default function ParentGallery() {
  const { user, activeChildId } = useAuth();

  const [tab, setTab] = useState('personale'); // 'personale' | 'classe'
  const [personalItems, setPersonalItems] = useState([]);
  const [classItems, setClassItems] = useState([]);
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [loadingClass, setLoadingClass] = useState(false);
  const [classId, setClassId] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { item, items }

  const childId = activeChildId
    || (user?.child_ids && user.child_ids[0])
    || user?.child_id;

  // 1) Carica galleria personale + ricava class_id dallo studente
  useEffect(() => {
    if (!childId) return;
    setLoadingPersonal(true);

    const loadPersonal = api.get(`/gallery?student_id=${childId}`)
      .then(res => setPersonalItems(res.data))
      .catch(err => console.error('gallery personale:', err))
      .finally(() => setLoadingPersonal(false));

    // Recupera il class_id del bambino per la galleria di classe
    const loadStudent = api.get(`/students?id=${childId}`)
      .then(res => {
        const students = Array.isArray(res.data) ? res.data : [res.data];
        const student = students.find(s => s.id === childId) || students[0];
        if (student?.class_id) setClassId(student.class_id);
      })
      .catch(() => {
        // fallback: cerca tra i bambini del genitore
        api.get('/students').then(res => {
          const students = Array.isArray(res.data) ? res.data : [];
          const student = students.find(s => s.id === childId);
          if (student?.class_id) setClassId(student.class_id);
        }).catch(() => {});
      });

    Promise.all([loadPersonal, loadStudent]);
  }, [childId]);

  // 2) Carica galleria di classe solo quando si seleziona il tab (lazy)
  useEffect(() => {
    if (tab !== 'classe' || !classId || classItems.length > 0) return;
    setLoadingClass(true);
    api.get(`/gallery?class_id=${classId}`)
      .then(res => setClassItems(res.data))
      .catch(err => console.error('gallery classe:', err))
      .finally(() => setLoadingClass(false));
  }, [tab, classId]);

  const activeItems = tab === 'personale' ? personalItems : classItems;
  const isLoading = tab === 'personale' ? loadingPersonal : loadingClass;

  return (
    <AppLayout title="Galleria Foto" showBack>
      <div className="max-w-lg mx-auto space-y-4" data-testid="parent-gallery-page">

        {/* Tab selector pill */}
        <div className="flex gap-2 p-1 bg-white rounded-2xl shadow-md" data-testid="gallery-tabs">
          <button
            data-testid="tab-personale"
            onClick={() => setTab('personale')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === 'personale'
                ? 'text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={tab === 'personale' ? { backgroundColor: '#FF69B4' } : {}}>
            <User className="w-4 h-4" />
            Galleria Personale
            {personalItems.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'personale' ? 'bg-white/30 text-white' : 'bg-pink-100 text-pink-500'}`}>
                {personalItems.length}
              </span>
            )}
          </button>

          <button
            data-testid="tab-classe"
            onClick={() => setTab('classe')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === 'classe'
                ? 'text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={tab === 'classe' ? { backgroundColor: '#4169E1' } : {}}>
            <Users className="w-4 h-4" />
            Galleria di Classe
            {classItems.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'classe' ? 'bg-white/30 text-white' : 'bg-blue-100 text-blue-500'}`}>
                {classItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Descrizione contestuale */}
        <p className="text-xs text-gray-400 text-center px-2">
          {tab === 'personale'
            ? '📸 Foto in cui compare il tuo bambino'
            : '🏫 Tutte le foto condivise dalla classe'}
        </p>

        {/* Contenuto */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <PhotoGrid
            items={activeItems}
            onSelect={(item, items) => setLightbox({ item, items })}
          />
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          item={lightbox.item}
          items={lightbox.items}
          onClose={(next) => {
            if (next === null) setLightbox(null);
            else setLightbox({ item: next, items: lightbox.items });
          }}
        />
      )}
    </AppLayout>
  );
}
