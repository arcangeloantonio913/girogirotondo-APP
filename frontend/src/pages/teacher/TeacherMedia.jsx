import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Upload, Image, Check } from 'lucide-react';

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1627764940620-90393d0e8c34?w=600',
  'https://images.pexels.com/photos/5435599/pexels-photo-5435599.jpeg?w=600',
  'https://images.pexels.com/photos/3662648/pexels-photo-3662648.jpeg?w=600',
  'https://images.pexels.com/photos/5905683/pexels-photo-5905683.jpeg?w=600',
];

export default function TeacherMedia() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    if (user?.class_id) {
      Promise.all([
        api.get(`/students?class_id=${user.class_id}`),
        api.get(`/gallery?class_id=${user.class_id}`),
      ]).then(([sRes, gRes]) => {
        setStudents(sRes.data);
        setGallery(gRes.data);
      });
    }
  }, [user]);

  const toggleStudent = (id) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleUpload = async () => {
    if (selectedStudents.length === 0 || !caption) return;
    setUploading(true);
    try {
      const randomImg = PLACEHOLDER_IMAGES[Math.floor(Math.random() * PLACEHOLDER_IMAGES.length)];
      const res = await api.post('/gallery', {
        class_id: user.class_id,
        student_ids: selectedStudents,
        media_url: randomImg,
        media_type: 'photo',
        caption,
      });
      setGallery([res.data, ...gallery]);
      setSelectedStudents([]);
      setCaption('');
      setUploaded(true);
      setTimeout(() => setUploaded(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout title="Carica Media" showBack>
      <div className="max-w-lg mx-auto space-y-4" data-testid="teacher-media-page">
        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5 border border-gray-100">
          <h3 className="text-base font-bold mb-4" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
            Nuova Foto/Video
          </h3>

          {/* Simulated File Upload Area */}
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center mb-4 hover:border-green-300 transition-colors cursor-pointer" data-testid="upload-dropzone">
            <Camera className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500 font-medium">Tocca per scattare o selezionare</p>
            <p className="text-xs text-gray-400 mt-1">Simulazione - immagine placeholder usata</p>
          </div>

          {/* Student Selection */}
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tagga Alunni</p>
            <div className="flex flex-wrap gap-2" data-testid="media-student-tags">
              {students.map((s) => {
                const selected = selectedStudents.includes(s.id);
                return (
                  <button
                    key={s.id}
                    data-testid={`media-tag-${s.id}`}
                    onClick={() => toggleStudent(s.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selected ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    style={selected ? { backgroundColor: '#32CD32' } : {}}
                  >
                    {selected && <Check className="w-3 h-3 inline mr-1" />}
                    {s.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Caption */}
          <Input
            data-testid="media-caption-input"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Descrizione della foto..."
            className="rounded-xl mb-4"
          />

          <Button
            data-testid="media-upload-button"
            onClick={handleUpload}
            disabled={uploading || selectedStudents.length === 0 || !caption}
            className="w-full rounded-2xl font-bold h-11"
            style={{ backgroundColor: '#32CD32' }}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Caricamento...' : 'Carica'}
          </Button>

          {uploaded && (
            <p className="text-sm text-center font-semibold mt-3" style={{ color: '#32CD32' }} data-testid="upload-success-msg">
              Media caricato con successo!
            </p>
          )}
        </div>

        {/* Recent Gallery */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden" data-testid="recent-gallery">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Image className="w-4 h-4" style={{ color: '#32CD32' }} />
            <span className="text-sm font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>Caricamenti Recenti</span>
          </div>
          <div className="grid grid-cols-3 gap-1 p-2">
            {gallery.slice(0, 9).map((item) => (
              <div key={item.id} className="aspect-square rounded-xl overflow-hidden">
                <img src={item.media_url} alt={item.caption} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
