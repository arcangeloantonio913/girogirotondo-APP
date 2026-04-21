import { useState, useEffect } from 'react';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bell, Plus, Trash2, Globe, BookOpen } from 'lucide-react';

export default function AdminAvvisi() {
  const [avvisi, setAvvisi] = useState([]);
  const [classes, setClasses] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ titolo: '', testo: '', target: 'global', class_id: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [aRes, cRes] = await Promise.all([
      api.get('/avvisi'),
      api.get('/classes'),
    ]);
    setAvvisi(aRes.data);
    setClasses(cRes.data);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const payload = { ...form };
      if (payload.target !== 'class') delete payload.class_id;
      await api.post('/avvisi', payload);
      setDialogOpen(false);
      setForm({ titolo: '', testo: '', target: 'global', class_id: '' });
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/avvisi/${id}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const getClassName = (classId) => classes.find(c => c.id === classId)?.name || classId;

  return (
    <AppLayout title="Avvisi e Comunicazioni" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-avvisi-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" style={{ color: '#4169E1' }} />
            <span className="text-sm font-bold text-gray-700">{avvisi.length} avvisi pubblicati</span>
          </div>
          <Button
            data-testid="add-avviso-button"
            onClick={() => setDialogOpen(true)}
            className="rounded-2xl font-semibold h-9 text-sm"
            style={{ backgroundColor: '#4169E1' }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuovo Avviso
          </Button>
        </div>

        {/* Lista avvisi */}
        {avvisi.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-gray-100">
            <Bell className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400 font-medium">Nessun avviso pubblicato</p>
          </div>
        ) : (
          <div className="space-y-3">
            {avvisi.map((a) => (
              <div key={a.id} data-testid={`avviso-${a.id}`} className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.target === 'global' ? (
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#4169E115' }}>
                        <Globe className="w-4 h-4" style={{ color: '#4169E1' }} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FF69B415' }}>
                        <BookOpen className="w-4 h-4" style={{ color: '#FF69B4' }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: 'Nunito' }}>{a.titolo}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${a.target === 'global' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                        {a.target === 'global' ? 'Tutti' : getClassName(a.class_id)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{a.testo}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(a.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} · {a.author_name}</p>
                  </div>
                  <button
                    data-testid={`delete-avviso-${a.id}`}
                    onClick={() => handleDelete(a.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dialog nuovo avviso */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-avviso-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>Nuovo Avviso</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs font-medium text-gray-600">Titolo</Label>
                <Input
                  data-testid="avviso-titolo-input"
                  value={form.titolo}
                  onChange={e => setForm({ ...form, titolo: e.target.value })}
                  className="rounded-xl mt-1"
                  placeholder="Titolo dell'avviso..."
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Messaggio</Label>
                <Textarea
                  data-testid="avviso-testo-input"
                  value={form.testo}
                  onChange={e => setForm({ ...form, testo: e.target.value })}
                  className="rounded-xl mt-1 text-sm resize-none"
                  rows={4}
                  placeholder="Scrivi il comunicato..."
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Destinatari</Label>
                <Select value={form.target} onValueChange={v => setForm({ ...form, target: v, class_id: '' })}>
                  <SelectTrigger className="rounded-xl mt-1" data-testid="avviso-target-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Tutti (genitori e maestre)</SelectItem>
                    <SelectItem value="class">Classe specifica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.target === 'class' && (
                <div>
                  <Label className="text-xs font-medium text-gray-600">Classe</Label>
                  <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
                    <SelectTrigger className="rounded-xl mt-1" data-testid="avviso-class-select">
                      <SelectValue placeholder="Seleziona classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                data-testid="create-avviso-submit"
                onClick={handleCreate}
                disabled={loading || !form.titolo || !form.testo || (form.target === 'class' && !form.class_id)}
                className="w-full rounded-2xl font-bold h-11"
                style={{ backgroundColor: '#4169E1' }}
              >
                {loading ? 'Pubblicazione...' : 'Pubblica Avviso'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
