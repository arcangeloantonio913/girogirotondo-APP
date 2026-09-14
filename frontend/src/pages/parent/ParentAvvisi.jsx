import { C } from '@/config/tenant';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Bell, Globe, BookOpen, Paperclip } from 'lucide-react';

export default function ParentAvvisi() {
  const [avvisi, setAvvisi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    api.get('/avvisi').then(res => {
      setAvvisi(res.data || []);
      setLoading(false);
    }).catch(err => { console.error(err); setLoadError(true); setLoading(false); });
  }, []);

  // Allegato scaricato on-demand: la lista non trasporta più attachment_url (PERF).
  const handleDownloadAttachment = async (a) => {
    if (downloadingId) return;
    setError('');
    setDownloadingId(a.id);
    try {
      let url = a.attachment_url;
      if (!url) {
        const res = await api.get(`/avvisi/${a.id}`);
        url = res.data?.attachment_url;
      }
      if (!url) { setError('Allegato non disponibile'); return; }
      const link = document.createElement('a');
      link.href = url;
      link.download = a.attachment_name || 'allegato';
      link.target = '_blank';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Impossibile scaricare l'allegato");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppLayout title="Avvisi e Comunicazioni" showBack>
      <div className="max-w-lg mx-auto space-y-4" data-testid="parent-avvisi-page">
        {/* Info */}
        <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" style={{ color: C.accentGreen }} />
            <div>
              <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>Comunicazioni dalla Scuola</p>
              <p className="text-[10px] text-gray-400">Avvisi generali e della tua classe</p>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

        {loading ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-gray-100">
            <div className="w-8 h-8 rounded-full animate-pulse mx-auto" style={{ background: 'linear-gradient(135deg, #32CD32, #98FB98)' }} />
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-gray-100" data-testid="avvisi-load-error">
            <Bell className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400 font-medium">Impossibile caricare, riprova</p>
          </div>
        ) : avvisi.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-gray-100">
            <Bell className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400 font-medium">Nessun avviso disponibile</p>
            <p className="text-[10px] text-gray-300 mt-1">La scuola pubblicherà qui le comunicazioni importanti</p>
          </div>
        ) : (
          <div className="space-y-3">
            {avvisi.map((a) => (
              <div
                key={a.id}
                data-testid={`avviso-${a.id}`}
                className="bg-white rounded-2xl shadow-md p-4 border border-gray-100"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${a.target === 'global' ? 'bg-blue-50' : 'bg-green-50'}`}>
                    {a.target === 'global'
                      ? <Globe className="w-4 h-4 text-blue-500" />
                      : <BookOpen className="w-4 h-4 text-green-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-900 flex-1" style={{ fontFamily: 'Nunito' }}>{a.titolo}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${a.target === 'global' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                        {a.target === 'global' ? 'Tutti' : 'Classe'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{a.testo}</p>
                    {(a.has_attachment || a.attachment_url) && (
                      <button type="button"
                        data-testid={`attachment-avviso-${a.id}`}
                        onClick={() => handleDownloadAttachment(a)}
                        disabled={downloadingId === a.id}
                        className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 text-green-600 text-[11px] font-semibold hover:bg-green-100 transition-colors disabled:opacity-50">
                        <Paperclip className="w-3 h-3" />
                        {downloadingId === a.id ? 'Apertura...' : (a.attachment_name || 'Allegato')}
                      </button>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-gray-400">
                        {new Date(a.created_at).toLocaleDateString('it-IT', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-[10px] font-medium text-gray-400">{a.author_name}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
