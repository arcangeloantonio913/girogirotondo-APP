import { useState, useEffect } from 'react';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Trash2, Shield, GraduationCap, Heart } from 'lucide-react';

function getRoleIcon(role) {
  if (role === 'admin') return Shield;
  if (role === 'teacher') return GraduationCap;
  return Heart;
}

function getRoleColor(role) {
  if (role === 'admin') return '#4169E1';
  if (role === 'teacher') return '#FF69B4';
  return '#32CD32';
}

function getRoleLabel(role) {
  if (role === 'admin') return 'Amministratore';
  if (role === 'teacher') return 'Maestra';
  return 'Genitore';
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '', class_id: '', child_id: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [uRes, cRes, sRes] = await Promise.all([
      api.get('/users'),
      api.get('/classes'),
      api.get('/students'),
    ]);
    setUsers(uRes.data);
    setClasses(cRes.data);
    setStudents(sRes.data);
  };

  const handleCreate = async () => {
    try {
      await api.post('/users', form);
      setDialogOpen(false);
      setForm({ name: '', email: '', password: '', role: '', class_id: '', child_id: '' });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const grouped = {
    admin: users.filter(u => u.role === 'admin'),
    teacher: users.filter(u => u.role === 'teacher'),
    parent: users.filter(u => u.role === 'parent'),
  };

  return (
    <AppLayout title="Gestione Utenti" showBack>
      <div className="max-w-2xl mx-auto space-y-4" data-testid="admin-users-page">
        {/* Header with Add Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: '#4169E1' }} />
            <span className="text-sm font-bold text-gray-700">{users.length} utenti totali</span>
          </div>
          <Button
            data-testid="add-user-button"
            onClick={() => setDialogOpen(true)}
            className="rounded-2xl font-semibold h-9 text-sm"
            style={{ backgroundColor: '#4169E1' }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuovo Utente
          </Button>
        </div>

        {/* Users by Role */}
        {['admin', 'teacher', 'parent'].map((role) => (
          <div key={role} className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden" data-testid={`user-group-${role}`}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: `${getRoleColor(role)}08` }}>
              {(() => { const Icon = getRoleIcon(role); return <Icon className="w-4 h-4" style={{ color: getRoleColor(role) }} />; })()}
              <span className="text-sm font-bold" style={{ fontFamily: 'Nunito', color: getRoleColor(role) }}>{getRoleLabel(role)} ({grouped[role].length})</span>
            </div>
            <div className="divide-y divide-gray-50">
              {grouped[role].map((u) => (
                <div key={u.id} data-testid={`user-row-${u.id}`} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: getRoleColor(role) }}>
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <button
                    data-testid={`delete-user-${u.id}`}
                    onClick={() => handleDelete(u.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {grouped[role].length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-gray-400">Nessun utente</div>
              )}
            </div>
          </div>
        ))}

        {/* Create User Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl max-w-sm mx-auto" data-testid="create-user-dialog">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Nunito' }}>Nuovo Utente</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs font-medium text-gray-600">Nome</Label>
                <Input data-testid="user-name-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl mt-1" placeholder="Nome Cognome" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Email</Label>
                <Input data-testid="user-email-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="rounded-xl mt-1" placeholder="email@esempio.it" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Password</Label>
                <Input data-testid="user-password-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="rounded-xl mt-1" placeholder="Password" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Ruolo</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                  <SelectTrigger className="rounded-xl mt-1" data-testid="user-role-select">
                    <SelectValue placeholder="Seleziona ruolo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Amministratore</SelectItem>
                    <SelectItem value="teacher">Maestra</SelectItem>
                    <SelectItem value="parent">Genitore</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(form.role === 'teacher' || form.role === 'parent') && (
                <div>
                  <Label className="text-xs font-medium text-gray-600">Classe</Label>
                  <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
                    <SelectTrigger className="rounded-xl mt-1" data-testid="user-class-select">
                      <SelectValue placeholder="Seleziona classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.role === 'parent' && form.class_id && (
                <div>
                  <Label className="text-xs font-medium text-gray-600">Bambino</Label>
                  <Select value={form.child_id} onValueChange={v => setForm({ ...form, child_id: v })}>
                    <SelectTrigger className="rounded-xl mt-1" data-testid="user-child-select">
                      <SelectValue placeholder="Seleziona bambino" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.filter(s => s.class_id === form.class_id).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                data-testid="create-user-submit"
                onClick={handleCreate}
                disabled={!form.name || !form.email || !form.password || !form.role}
                className="w-full rounded-2xl font-bold h-11"
                style={{ backgroundColor: '#4169E1' }}
              >
                Crea Utente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
