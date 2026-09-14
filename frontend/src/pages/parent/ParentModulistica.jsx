import { C } from '@/config/tenant';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { FileText, CheckCircle2, Circle, Shield, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ParentModulistica() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [acknowledging, setAcknowledging] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoadError(false);
      try {
        const [docsRes, receiptsRes] = await Promise.allSettled([
          api.get('/documents'),
          api.get(`/read-receipts?parent_id=${user?.id}`),
        ]);
        const val = r => r.status === 'fulfilled' ? r.value.data : undefined;
        if (docsRes.status === 'rejected') setLoadError(true);
        setDocuments(val(docsRes) || []);
        setReceipts(val(receiptsRes) || []);
      } catch (err) {
        console.error(err);
        setLoadError(true);
      }
    };
    load();
  }, [user]);

  const isAcknowledged = (docId) => receipts.some(r => r.document_id === docId);

  const [downloadingId, setDownloadingId] = useState(null);

  // Scarica il file. PERF: la lista NON porta più il base64 (troppo pesante), quindi il
  // file vero si recupera on-demand con GET /documents/{id} solo al momento del download.
  const handleDownload = async (doc) => {
    setDownloadError('');
    let fileUrl = doc.file_url;
    if (!fileUrl) {
      try {
        setDownloadingId(doc.id);
        const res = await api.get(`/documents/${doc.id}`);
        fileUrl = res.data?.file_url;
      } catch (e) {
        console.error(e);
        setDownloadError('Impossibile scaricare il documento. Riprova.');
      } finally {
        setDownloadingId(null);
      }
    }
    if (!fileUrl) { setDownloadError('Impossibile scaricare il documento. Riprova.'); return; }
    if (fileUrl.startsWith('data:')) {
      // Base64 data URL → download diretto
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = doc.title || 'documento';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // URL remoto (Firebase Storage, ecc.) → apri in nuova scheda
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAcknowledge = async (docId) => {
    setAcknowledging(docId);
    try {
      const res = await api.post('/read-receipts', {
        document_id: docId,
        parent_id: user.id,
      });
      // Always add to local state on success (even if already acknowledged server-side)
      setReceipts(prev => {
        if (prev.some(r => r.document_id === docId && r.parent_id === user.id)) return prev;
        return [...prev, { document_id: docId, parent_id: user.id, id: res.data.id || 'local', acknowledged_at: new Date().toISOString() }];
      });
    } catch (err) {
      console.error(err);
    } finally {
      setAcknowledging(null);
    }
  };

  return (
    <AppLayout title="Documenti" showBack>
      <div className="max-w-lg mx-auto space-y-4" data-testid="parent-modulistica-page">
        {/* GDPR Notice */}
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ backgroundColor: '#A7C7E715' }} data-testid="gdpr-notice">
          <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.babyBlue }} />
          <p className="text-xs text-gray-700 leading-relaxed">
            Il trattamento di dati e foto è rigorosamente conforme alle normative GDPR e alle leggi sulla privacy vigenti. Tutti i documenti sono gestiti nel rispetto della normativa sulla tutela dei minori.
          </p>
        </div>

        {downloadError && (
          <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 font-semibold"
            data-testid="download-error">{downloadError}</p>
        )}

        {/* Documents */}
        {loadError ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md" data-testid="documents-load-error">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Impossibile caricare, riprova</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Nessun documento disponibile</p>
          </div>
        ) : (
          documents.map((doc) => {
            const ack = isAcknowledged(doc.id);
            return (
              <div
                key={doc.id}
                data-testid={`document-card-${doc.id}`}
                className="bg-white rounded-2xl shadow-md p-5 border border-gray-100"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#A7C7E720' }}>
                    <FileText className="w-5 h-5" style={{ color: C.babyBlue }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>{doc.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{doc.description}</p>
                    {doc.categoria && (
                      <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                        style={{ backgroundColor: '#A7C7E720', color: '#7BA7C7' }}>
                        {doc.categoria}
                      </span>
                    )}
                  </div>
                  {/* Pulsante download — se il documento ha un file (has_file: la lista non
                      porta più il base64, quindi ci si basa sul flag; file_url per retro-compat) */}
                  {(doc.has_file || doc.file_url) && (
                    <button
                      data-testid={`document-download-${doc.id}`}
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id}
                      title="Scarica documento"
                      className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      style={{ color: C.primary }}>
                      <Download className="w-4.5 h-4.5" />
                    </button>
                  )}
                </div>

                {ack ? (
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-xl" data-testid={`document-acknowledged-${doc.id}`}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: C.accentGreen }} />
                    <span className="text-xs font-semibold" style={{ color: C.accentGreen }}>Presa Visione Confermata</span>
                  </div>
                ) : (
                  <Button
                    data-testid={`document-acknowledge-btn-${doc.id}`}
                    onClick={() => handleAcknowledge(doc.id)}
                    disabled={acknowledging === doc.id}
                    className="w-full rounded-xl font-semibold h-10 text-sm"
                    style={{ backgroundColor: C.babyBlue }}
                  >
                    <Circle className="w-4 h-4 mr-2" />
                    {acknowledging === doc.id ? 'Confermando...' : 'Presa Visione'}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
