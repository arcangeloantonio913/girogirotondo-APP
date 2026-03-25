import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { BookOpen, Calendar } from 'lucide-react';

export default function ParentDiario() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (user?.class_id) {
      api.get(`/diary?class_id=${user.class_id}`).then(res => setEntries(res.data));
    }
  }, [user]);

  return (
    <AppLayout title="Diario di Bordo" showBack>
      <div className="max-w-lg mx-auto space-y-4" data-testid="parent-diario-page">
        {entries.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Nessun aggiornamento disponibile</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              data-testid={`diary-entry-${entry.id}`}
              className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5 border border-gray-100"
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500">
                  {new Date(entry.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                {entry.date === today && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: '#32CD32' }}>Oggi</span>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{entry.summary}</p>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
