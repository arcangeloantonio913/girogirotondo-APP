import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Image, Play } from 'lucide-react';

export default function ParentGallery() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [selectedImg, setSelectedImg] = useState(null);

  useEffect(() => {
    if (user?.child_id) {
      api.get(`/gallery?student_id=${user.child_id}`).then(res => setItems(res.data));
    }
  }, [user]);

  return (
    <AppLayout title="Galleria Personale" showBack>
      <div className="max-w-lg mx-auto" data-testid="parent-gallery-page">
        {items.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md">
            <Image className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Nessuna foto disponibile</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3" data-testid="gallery-grid">
            {items.map((item) => (
              <button
                key={item.id}
                data-testid={`gallery-item-${item.id}`}
                onClick={() => setSelectedImg(item)}
                className="relative aspect-square rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all hover:-translate-y-1 group"
              >
                <img
                  src={item.media_url}
                  alt={item.caption}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {item.media_type === 'video' && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <Play className="w-10 h-10 text-white fill-white" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-white text-xs font-medium truncate">{item.caption}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {selectedImg && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedImg(null)}
            data-testid="gallery-lightbox"
          >
            <div className="max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <img
                src={selectedImg.media_url}
                alt={selectedImg.caption}
                className="w-full rounded-2xl"
              />
              <p className="text-white text-sm text-center mt-3 font-medium">{selectedImg.caption}</p>
              <p className="text-gray-400 text-xs text-center mt-1">
                {new Date(selectedImg.created_at).toLocaleDateString('it-IT')}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
