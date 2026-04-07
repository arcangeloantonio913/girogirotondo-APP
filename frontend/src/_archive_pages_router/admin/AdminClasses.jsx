import { useState, useEffect } from 'react';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Plus, Trash2, Users } from 'lucide-react';

export default function AdminClasses() {
  const [classes, setClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', teacher_id: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cRes, uRes, sRes] = await Promise.all([
      api.get('/classes'),
      api.get('/users'),
      api.get('/students'),
    ]);
    setClasses(cRes.data);
    setUsers(uRes.data);
    setStudents(sRes.data);
  };

  const handleCreate = async () => {
    try {
      await api.post('/classes', form);
      setDialogOpen(false);
      setForm({ name: '', teacher_id: '' });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/classes/${id}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const teachers = users.filter(u => u.role === 'teacher');
  const classColors = ['#4169E1', '#FF69B4', '#32CD32', '#F59E0B', '#8B5CF6'];

  return (
    <AppLayout title="Gestione Classi" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-classes-page">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" style={{ color: '#FF69B4' }} />
            <span className="text-sm font-bold text-gray-700">{classes.length} classi</span>
          </div>
          <Button
            data-testid="add-class-button"
            onClick={() => setDialogOpen(true)}
            className="rounded-2xl font-semibold h-9 text-sm"
            style={{ backgroundColor: '#FF69B4' }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuova Classe
          </Button>
        </div>

        {/* Classes List */}
        {classes.map((cls, idx) => {
          const teacher = users.find(u => u.id === cls.teacher_id);
          const classStudents = students.filter(s => s.class_id === cls.id);
          const color = classColors[idx % classColors.length];

          return (
            <div key={cls.id} data-testid={`class-card-${cls.id}`} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: color }}>
                      {cls.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold" style={{ fontFamily: 'Nunito', color: '#1A202C' }}>{cls.name}</h3>
                      <p className="text-xs text-gray-500">{teacher ? `Maestra ${teacher.name}` : 'Nessuna maestra assegnata'}</p>
                    </div>
                  </div>
                  <button
                    data-testid={`delete-class-${cls.id}`}
                    onClick={() => handleDelete(cls.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500">{classStudents.length} alunni</span>
                </div>

                {classStudents.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {classStudents.map(s => (
                      <span key={s.id} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                        {s.name.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Create Class Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-class-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>Nuova Classe</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs font-medium text-gray-600">Nome Classe</Label>
                <Input data-testid="class-name-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl mt-1" placeholder="Es. Farfalle" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Maestra Assegnata</Label>
                <Select value={form.teacher_id} onValueChange={v => setForm({ ...form, teacher_id: v })}>
                  <SelectTrigger className="rounded-xl mt-1" data-testid="class-teacher-select">
                    <SelectValue placeholder="Seleziona maestra" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button
                data-testid="create-class-submit"
                onClick={handleCreate}
                disabled={!form.name}
                className="w-full rounded-2xl font-bold h-11"
                style={{ backgroundColor: '#FF69B4' }}
              >
                Crea Classe
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
