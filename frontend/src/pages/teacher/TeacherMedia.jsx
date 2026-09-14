import { C } from '@/config/tenant';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Upload, Image, Check, Plus, X, FileImage, Film, CheckSquare, Square } from 'lucide-react';

// Comprime immagine via canvas — riduce il peso da 3-5MB a ~200-400KB
function compressImage(file, maxSize = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let url = null;
    const done = (v) => { if (settled) return; settled = true; clearTimeout(timer); if (url) URL.revokeObjectURL(url); resolve(v); };
    const fail = (e) => { if (settled) return; settled = true; clearTimeout(timer); if (url) URL.revokeObjectURL(url); reject(e); };
    // Fallback: legge il file originale come data URL (senza compressione).
    const readOriginal = () => {
      const reader = new FileReader();
      reader.onloadend = () => done(reader.result);
      reader.onerror  = () => fail(new Error('File non leggibile'));
      reader.readAsDataURL(file);
    };
    if (file.type.startsWith('video/')) { readOriginal(); return; }
    // TIMEOUT di sicurezza: alcune immagini (es. HEIC iPhone) non si decodificano e NON
    // scatenano onload/onerror → prima la Promise restava appesa e l'upload girava
    // all'infinito. Dopo 6s carichiamo l'originale.
    const timer = setTimeout(readOriginal, 6000);
    const img = new window.Image();
    url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        done(canvas.toDataURL('image/jpeg', quality));
      } catch {
        readOriginal();
      }
    };
    img.onerror = () => readOriginal();
    img.src = url;
  });
}

export default function TeacherMedia() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [gallery, setGallery] = useState([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const fileInputRef = useRef(null);

  // Un maestro può avere più classi: mostriamo un selettore e filtriamo studenti/foto
  // per la classe attiva (mirror di TeacherDiario) — così le foto non finiscono
  // taggate alla classe sbagliata.
  const teacherClassIds = useMemo(() => {
    const ids = [...(user?.class_ids || [])];
    if (user?.class_id && !ids.includes(user.class_id)) ids.push(user.class_id);
    return ids;
  }, [user]);

  const loadStudents = () => {
    api.get('/students').then(r => setStudents(r.data || [])).catch(console.error);
  };

  useEffect(() => {
    if (!teacherClassIds.length) return;
    Promise.all([api.get('/classes'), api.get('/students')]).then(([cRes, sRes]) => {
      const myClasses = (cRes.data || []).filter(c => teacherClassIds.includes(c.id));
      setClasses(myClasses);
      setStudents(sRes.data || []);
      if (myClasses.length > 0) setClassId(prev => prev || myClasses[0].id);
    }).catch(console.error);
  }, [user]); // eslint-disable-line

  // Ricarica la galleria della classe attiva quando cambia
  useEffect(() => {
    if (!classId) return;
    api.get(`/gallery?class_id=${classId}&limit=24&offset=0`)
      .then(gRes => setGallery(gRes.data || []))
      .catch(console.error);
  }, [classId]);

  // Ricarica studenti ogni volta che il modal si apre (fix: lista vuota dopo upload)
  useEffect(() => {
    if (uploadModalOpen) {
      loadStudents();
      setSelectedStudents([]); // reset selezione
    }
  }, [uploadModalOpen]); // eslint-disable-line

  // Studenti della classe attiva — solo questi sono taggabili
  const classStudents = useMemo(
    () => students.filter(s => s.class_id === classId),
    [students, classId]
  );

  const toggleStudent = (id) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedStudents.length === classStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(classStudents.map(s => s.id));
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
    setUploadError('');
    setUploadProgress({ current: 0, total: 0 });
  };

  const handleUpload = async () => {
    if (selectedStudents.length === 0 || selectedFiles.length === 0) return;
    // Caption automatica basata sulla data
    const autoCaption = caption || new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!classId) return;

    setUploading(true);
    setUploadError('');
    setUploadProgress({ current: 0, total: selectedFiles.length });

    const newItems = [];
    const failed   = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress({ current: i + 1, total: selectedFiles.length });

      try {
        // Comprime l'immagine (max 1200px, 75% quality) prima dell'upload
        // Riduce da 3-5MB a ~200-400KB → caricamento molto più veloce
        const dataURL = await compressImage(file, 1200, 0.75);

        const res = await api.post('/gallery/upload-b64', {
          class_id:    classId,
          student_ids: selectedStudents,
          media_type:  file.type.startsWith('video') ? 'video' : 'photo',
          caption:     autoCaption,
          media_url:   dataURL,
        });
        newItems.push(res.data);
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || 'Errore sconosciuto';
        console.error(`[UPLOAD] Fallito ${file.name}: ${err.response?.status || ''} ${msg}`);
        failed.push(file.name);
        setUploadError(`❌ ${msg}`);
      }
    }

    setUploading(false);
    if (newItems.length > 0) {
      setGallery(prev => [...newItems, ...prev]);
    }
    if (failed.length === 0) {
      // Successo pieno: chiudi e mostra conferma
      resetModal();
      setUploadModalOpen(false);
      setUploaded(true);
      setTimeout(() => setUploaded(false), 4000);
    } else if (newItems.length === 0) {
      // Fallimento totale
      setUploadError('❌ Caricamento fallito. Controlla la connessione e riprova.');
    } else {
      // Fallimento parziale: alcuni caricati, altri no — resta aperto e mostra i falliti
      setUploadError(`⚠️ ${newItems.length} caricati, ${failed.length} falliti (${failed.join(', ')}). Riprova i file falliti.`);
    }
  };

  const allSelected = classStudents.length > 0 && selectedStudents.length === classStudents.length;

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
          <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center transition-colors" style={{ backgroundColor: C.tintGreen }}>
            <Plus className="w-7 h-7" style={{ color: C.accentGreen }} />
          </div>
          <p className="text-sm font-bold text-gray-700" style={{ fontFamily: 'Nunito' }}>Carica Nuova Foto o Video</p>
          <p className="text-xs text-gray-400 mt-1">Tocca per aprire il caricamento</p>
        </button>

        {uploaded && (
          <div className="bg-green-50 rounded-2xl p-3 text-center" data-testid="upload-success-msg">
            <p className="text-sm font-semibold" style={{ color: C.accentGreen }}>Media caricato con successo!</p>
          </div>
        )}

        {/* Recent Gallery */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden" data-testid="recent-gallery">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Image className="w-4 h-4" style={{ color: C.accentGreen }} />
            <span className="text-sm font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>Caricamenti Recenti</span>
            <span className="text-xs text-gray-400 ml-auto">{gallery.length} file</span>
          </div>
          {gallery.length > 0 ? (
            <div className="grid grid-cols-3 gap-1 p-2">
              {gallery.slice(0, 9).map((item) => (
                <div key={item.id} className="aspect-square rounded-xl overflow-hidden relative group">
                  <img src={item.thumbnail_url || item.media_url} alt={item.caption} className="w-full h-full object-cover" loading="lazy" />
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
              {/* Selettore classe — solo se il maestro gestisce più classi */}
              {classes.length > 1 && (
                <div>
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Classe</Label>
                  <Select value={classId} onValueChange={v => { setClassId(v); setSelectedStudents([]); }}>
                    <SelectTrigger className="rounded-xl mt-2 h-10 text-sm" data-testid="media-class-select">
                      <SelectValue placeholder="Seleziona classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                      <CheckSquare className="w-5 h-5 flex-shrink-0" style={{ color: C.accentGreen }} />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    )}
                    <span className="text-sm font-bold" style={{ color: allSelected ? C.accentGreen : '#374151' }}>
                      Seleziona Tutti
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {selectedStudents.length}/{classStudents.length}
                    </span>
                  </button>

                  {/* Individual students */}
                  <div className="max-h-48 overflow-y-auto">
                    {classStudents.map((s) => {
                      const isChecked = selectedStudents.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          data-testid={`student-check-${s.id}`}
                          onClick={() => toggleStudent(s.id)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 flex-shrink-0" style={{ color: C.accentGreen }} />
                          ) : (
                            <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />
                          )}
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: isChecked ? C.accentGreen : '#D1D5DB' }}>
                            {s.name.charAt(0)}
                          </div>
                          <span className={`text-sm font-medium ${isChecked ? 'text-gray-900' : 'text-gray-600'}`}>
                            {s.name} <span className="font-normal text-xs text-gray-400">{s.cognome || ''}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Upload Error */}
              {uploadError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{uploadError}</p>
              )}

              {/* Upload Button */}
              <Button
                data-testid="modal-upload-button"
                onClick={handleUpload}
                disabled={uploading || selectedStudents.length === 0 || selectedFiles.length === 0}
                className="w-full rounded-2xl font-bold h-11"
                style={{ backgroundColor: C.accentGreen }}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading
                  ? `Caricamento ${uploadProgress.current}/${uploadProgress.total}...`
                  : `Carica ${selectedFiles.length > 1 ? `${selectedFiles.length} file` : 'Media'}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
