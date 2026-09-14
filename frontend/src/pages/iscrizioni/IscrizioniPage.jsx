import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { tenant, C } from '@/config/tenant';
import { getConfig } from '@/lib/intakeApi';
import SchedaStrutturata from './SchedaStrutturata';
import UploadRegistro from './UploadRegistro';

export default function IscrizioniPage() {
  const [params] = useSearchParams();
  const token = params.get('t');
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(null); // 'form' | 'scan' | null

  useEffect(() => {
    if (!token) { setError('Link non valido: manca il codice di accesso.'); return; }
    getConfig(token)
      .then(setConfig)
      .catch(() => setError('Link non valido, scaduto o revocato. Contatta la scuola/Omnia.'));
  }, [token]);

  if (error) {
    return <CenteredCard><p data-testid="intake-error">{error}</p></CenteredCard>;
  }
  if (!config) {
    return <CenteredCard><p>Caricamento…</p></CenteredCard>;
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <header style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={tenant.logo} alt={tenant.appName} style={{ height: 48, borderRadius: 12 }} />
        <div>
          <h1 style={{ color: C.primary, margin: 0 }}>{tenant.appName}</h1>
          <p style={{ margin: 0 }}>Raccolta iscrizioni {config.org_id ? '' : ''}</p>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: 20 }}>
        <section style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <p><strong>Informativa:</strong> i dati inseriti (bambini e genitori) sono trattati
            dalla scuola per la gestione delle iscrizioni, in conformità al GDPR. Non inserire
            dati non richiesti.</p>
        </section>

        {!mode && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ModeCard testid="mode-form" title="Compila la scheda"
              desc="Inserisci bambini, maestre e direttrice in un modulo guidato e validato."
              onClick={() => setMode('form')} color={C.primary} />
            <ModeCard testid="mode-scan" title="Carica il registro"
              desc="Hai già un registro? Carica scansioni pulite e leggibili."
              onClick={() => setMode('scan')} color={C.accentPink} />
          </div>
        )}

        {mode === 'form' && <SchedaStrutturata token={token} config={config} onBack={() => setMode(null)} />}
        {mode === 'scan' && <UploadRegistro token={token} config={config} onBack={() => setMode(null)} />}
      </main>

      <footer style={{ textAlign: 'center', padding: 20, fontSize: 12, color: '#666' }}>
        {tenant.footer}
      </footer>
    </div>
  );
}

function CenteredCard({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: C.bg }}>
      <div style={{ background: '#fff', padding: 24, borderRadius: 16 }}>{children}</div>
    </div>
  );
}

function ModeCard({ title, desc, onClick, color, testid }) {
  return (
    <button data-testid={testid} onClick={onClick}
      style={{ background: '#fff', border: `2px solid ${color}`, borderRadius: 16,
               padding: 24, textAlign: 'left', cursor: 'pointer' }}>
      <h3 style={{ color, marginTop: 0 }}>{title}</h3>
      <p style={{ margin: 0 }}>{desc}</p>
    </button>
  );
}
