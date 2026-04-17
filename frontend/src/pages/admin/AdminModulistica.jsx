import { useState, useEffect } from 'react';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Plus, Trash2, CheckCircle2, XCircle, Eye, Upload } from 'lucide-react';

export default function AdminModulistica() {
  const [documents, setDocuments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [parents, setParents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDoc, setDetailDoc] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', file_url: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [dRes, rRes, uRes] = await Promise.all([
      api.get('/documents'),
      api.get('/read-receipts'),
      api.get('/users'),
    ]);
    setDocuments(dRes.data);
    setReceipts(rRes.data);
    setParents(uRes.data.filter(u => u.role === 'parent'));
  };

  const handleCreate = async () => {
    try {
      await api.post('/documents', {
        ...form,
        file_url: form.file_url || 'https://example.com/docs/placeholder.pdf',
      });
      setDialogOpen(false);
      setForm({ title: '', description: '', file_url: '' });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/documents/${id}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const getDocReceipts = (docId) => receipts.filter(r => r.document_id === docId);
  const hasRead = (docId, parentId) => receipts.some(r => r.document_id === docId && r.parent_id === parentId);

  return (
    <AppLayout title="Modulistica" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-modulistica-page">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: '#32CD32' }} />
            <span className="text-sm font-bold text-gray-700">{documents.length} documenti</span>
          </div>
          <Button
            data-testid="add-document-button"
            onClick={() => setDialogOpen(true)}
            className="rounded-2xl font-semibold h-9 text-sm"
            style={{ backgroundColor: '#32CD32' }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuovo Documento
          </Button>
        </div>

        {/* Documents List */}
        {documents.map((doc) => {
          const docReceipts = getDocReceipts(doc.id);
          const readCount = docReceipts.length;
          const progress = parents.length > 0 ? Math.round((readCount / parents.length) * 100) : 0;

          return (
            <div key={doc.id} data-testid={`admin-doc-card-${doc.id}`} className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>{doc.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{doc.description}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    data-testid={`view-receipts-${doc.id}`}
                    onClick={() => setDetailDoc(doc)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    data-testid={`delete-doc-${doc.id}`}
                    onClick={() => handleDelete(doc.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-500 font-medium">Prese Visione</span>
                  <span className="font-bold" style={{ color: progress === 100 ? '#32CD32' : '#4169E1' }}>{readCount}/{parents.length}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#32CD32' : '#4169E1' }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Create Document Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-document-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>Nuovo Documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs font-medium text-gray-600">Titolo</Label>
                <Input data-testid="doc-title-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="rounded-xl mt-1" placeholder="Titolo documento" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Descrizione</Label>
                <Input data-testid="doc-description-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="rounded-xl mt-1" placeholder="Breve descrizione" />
              </div>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-green-300 transition-colors">
                <Upload className="w-8 h-8 mx-auto text-gray-300 mb-1" />
                <p className="text-xs text-gray-500">Simulazione upload PDF</p>
              </div>
              <Button
                data-testid="create-doc-submit"
                onClick={handleCreate}
                disabled={!form.title}
                className="w-full rounded-2xl font-bold h-11"
                style={{ backgroundColor: '#32CD32' }}
              >
                Pubblica Documento
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Receipt Detail Dialog */}
        <Dialog open={!!detailDoc} onOpenChange={() => setDetailDoc(null)}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="receipt-detail-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>Stato Prese Visione</DialogTitle>
            </DialogHeader>
            {detailDoc && (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-semibold text-gray-800 mb-3">{detailDoc.title}</p>
                {parents.map((parent) => {
                  const read = hasRead(detailDoc.id, parent.id);
                  return (
                    <div key={parent.id} data-testid={`receipt-row-${parent.id}`} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: read ? '#32CD32' : '#CBD5E0' }}>
                          {parent.name.charAt(0)}
                        </div>
                        <span className="text-sm text-gray-700 font-medium">{parent.name}</span>
                      </div>
                      {read ? (
                        <CheckCircle2 className="w-5 h-5" style={{ color: '#32CD32' }} />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
