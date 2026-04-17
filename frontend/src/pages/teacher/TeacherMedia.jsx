import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Upload, Image, Check, Plus, X, FileImage, Film, CheckSquare, Square } from 'lucide-react';

export default function TeacherMedia() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const fileInputRef = useRef(null);

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

  const selectAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setSelectedFiles(files);
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviewUrls(urls);
  };

  const removeFile = (idx) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const resetModal = () => {
    setSelectedFiles([]);
    previewUrls.forEach(u => URL.revokeObjectURL(u));
    setPreviewUrls([]);
    setSelectedStudents([]);
    setCaption('');
  };

  const handleUpload = async () => {
    if (selectedStudents.length === 0 || !caption || selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const mediaUrl = previewUrls[0] || 'uploaded_file';
      const mediaType = selectedFiles[0]?.type?.startsWith('video') ? 'video' : 'photo';
      const res = await api.post('/gallery', {
        class_id: user.class_id,
        student_ids: selectedStudents,
        media_url: mediaUrl,
        media_type: mediaType,
        caption,
      });
      setGallery([res.data, ...gallery]);
      resetModal();
      setUploadModalOpen(false);
      setUploaded(true);
      setTimeout(() => setUploaded(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const allSelected = students.length > 0 && selectedStudents.length === students.length;

  return (
    <AppLayout title="Carica Media" showBack>
      <div className="max-w-lg mx-auto space-y-4" data-testid="teacher-media-page">
        {/* Hidden native file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
          data-testid="native-file-input"
        />

        {/* Upload Button */}
        <button
          data-testid="open-upload-modal-button"
          onClick={() => setUploadModalOpen(true)}
          className="w-full bg-white rounded-2xl shadow-md p-6 border-2 border-dashed border-gray-200 hover:border-green-300 transition-all text-center group"
        >
          <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center transition-colors" style={{ backgroundColor: '#F0FFF0' }}>
            <Plus className="w-7 h-7" style={{ color: '#32CD32' }} />
          </div>
          <p className="text-sm font-bold text-gray-700" style={{ fontFamily: 'Nunito' }}>Carica Nuova Foto o Video</p>
          <p className="text-xs text-gray-400 mt-1">Tocca per aprire il caricamento</p>
        </button>

        {uploaded && (
          <div className="bg-green-50 rounded-2xl p-3 text-center" data-testid="upload-success-msg">
            <p className="text-sm font-semibold" style={{ color: '#32CD32' }}>Media caricato con successo!</p>
          </div>
        )}

        {/* Recent Gallery */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden" data-testid="recent-gallery">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Image className="w-4 h-4" style={{ color: '#32CD32' }} />
            <span className="text-sm font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>Caricamenti Recenti</span>
            <span className="text-xs text-gray-400 ml-auto">{gallery.length} file</span>
          </div>
          {gallery.length > 0 ? (
            <div className="grid grid-cols-3 gap-1 p-2">
              {gallery.slice(0, 9).map((item) => (
                <div key={item.id} className="aspect-square rounded-xl overflow-hidden relative group">
                  <img src={item.media_url} alt={item.caption} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                    <p className="text-white text-[9px] font-medium truncate">{item.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <Image className="w-10 h-10 mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">Nessun media caricato</p>
            </div>
          )}
        </div>

        {/* Upload Modal */}
        <Dialog open={uploadModalOpen} onOpenChange={(open) => { if (!open) resetModal(); setUploadModalOpen(open); }}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto max-h-[90vh] overflow-y-auto" data-testid="upload-modal" aria-describedby="upload-dialog-desc">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>
                Carica Media
              </DialogTitle>
              <p className="sr-only" id="upload-dialog-desc">Seleziona file, tagga alunni e carica media</p>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* File Selection Area - triggers native OS file picker */}
              <button
                data-testid="file-select-area"
                onClick={openFilePicker}
                className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-5 text-center hover:border-green-300 transition-colors"
              >
                {previewUrls.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {previewUrls.map((url, idx) => (
                        <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden">
                          {selectedFiles[idx]?.type?.startsWith('video') ? (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <Film className="w-6 h-6 text-white" />
                            </div>
                          ) : (
                            <img src={url} alt={`Anteprima ${idx + 1}`} className="w-full h-full object-cover" />
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                            data-testid={`remove-file-${idx}`}
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 font-medium">{selectedFiles.length} file selezionati - Tocca per aggiungere</p>
                  </div>
                ) : (
                  <>
                    <Camera className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500 font-medium">Tocca per selezionare foto o video</p>
                    <p className="text-xs text-gray-400 mt-1">Supporta immagini e video multipli</p>
                  </>
                )}
              </button>

              {/* Student Checklist - vertical list with checkboxes */}
              <div>
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tagga Alunni</Label>
                <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden" data-testid="student-checklist">
                  {/* Select All button */}
                  <button
                    data-testid="select-all-students"
                    onClick={selectAll}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    {allSelected ? (
                      <CheckSquare className="w-5 h-5 flex-shrink-0" style={{ color: '#32CD32' }} />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    )}
                    <span className="text-sm font-bold" style={{ color: allSelected ? '#32CD32' : '#374151' }}>
                      Seleziona Tutti
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {selectedStudents.length}/{students.length}
                    </span>
                  </button>

                  {/* Individual students */}
                  <div className="max-h-48 overflow-y-auto">
                    {students.map((s) => {
                      const isChecked = selectedStudents.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          data-testid={`student-check-${s.id}`}
                          onClick={() => toggleStudent(s.id)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 flex-shrink-0" style={{ color: '#32CD32' }} />
                          ) : (
                            <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />
                          )}
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: isChecked ? '#32CD32' : '#D1D5DB' }}>
                            {s.name.charAt(0)}
                          </div>
                          <span className={`text-sm font-medium ${isChecked ? 'text-gray-900' : 'text-gray-600'}`}>
                            {s.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Caption */}
              <div>
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Descrizione</Label>
                <Input
                  data-testid="modal-caption-input"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Descrizione della foto/video..."
                  className="rounded-xl mt-2"
                />
              </div>

              {/* Upload Button */}
              <Button
                data-testid="modal-upload-button"
                onClick={handleUpload}
                disabled={uploading || selectedStudents.length === 0 || !caption || selectedFiles.length === 0}
                className="w-full rounded-2xl font-bold h-11"
                style={{ backgroundColor: '#32CD32' }}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Caricamento...' : 'Carica Media'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
