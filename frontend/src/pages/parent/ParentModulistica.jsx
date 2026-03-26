import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { FileText, CheckCircle2, Circle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ParentModulistica() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [acknowledging, setAcknowledging] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [docsRes, receiptsRes] = await Promise.all([
          api.get('/documents'),
          api.get(`/read-receipts?parent_id=${user?.id}`),
        ]);
        setDocuments(docsRes.data);
        setReceipts(receiptsRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, [user]);

  const isAcknowledged = (docId) => receipts.some(r => r.document_id === docId);

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
        <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3" data-testid="gdpr-notice">
          <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4169E1' }} />
          <p className="text-xs text-gray-700 leading-relaxed">
            Il trattamento di dati e foto è rigorosamente conforme alle normative GDPR e alle leggi sulla privacy vigenti. Tutti i documenti sono gestiti nel rispetto della normativa sulla tutela dei minori.
          </p>
        </div>

        {/* Documents */}
        {documents.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
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
                className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5 border border-gray-100"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EBF0FF' }}>
                    <FileText className="w-5 h-5" style={{ color: '#4169E1' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>{doc.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{doc.description}</p>
                  </div>
                </div>

                {ack ? (
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-xl" data-testid={`document-acknowledged-${doc.id}`}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: '#32CD32' }} />
                    <span className="text-xs font-semibold" style={{ color: '#32CD32' }}>Presa Visione Confermata</span>
                  </div>
                ) : (
                  <Button
                    data-testid={`document-acknowledge-btn-${doc.id}`}
                    onClick={() => handleAcknowledge(doc.id)}
                    disabled={acknowledging === doc.id}
                    className="w-full rounded-xl font-semibold h-10 text-sm"
                    style={{ backgroundColor: '#4169E1' }}
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
