import React, { useState } from 'react';
import { C } from '@/config/tenant';
import { upsertSubmission, uploadScan } from '@/lib/intakeApi';

const OK_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB — limite di storage documenti lato backend

export default function UploadRegistro({ token, onBack }) {
  const [submissionId, setSubmissionId] = useState(null);
  const [uploaded, setUploaded] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function ensureSubmission() {
    if (submissionId) return submissionId;
    const res = await upsertSubmission(token, { mode: 'scan', status: 'bozza', children: [] });
    setSubmissionId(res.id);
    return res.id;
  }

  async function onFiles(fileList) {
    setMsg(''); setBusy(true);
    try {
      const sid = await ensureSubmission();
      for (const f of Array.from(fileList)) {
        if (!OK_TYPES.includes(f.type)) { setMsg(`"${f.name}" ignorato: usa JPG, PNG o PDF.`); continue; }
        if (f.size > MAX_SIZE) { setMsg(`"${f.name}" troppo grande (max 10MB).`); continue; }
        const res = await uploadScan(token, sid, f);
        setUploaded(u => [...u, res.scan.filename]);
      }
    } catch (e) {
      setMsg(e?.response?.data?.detail || 'Errore nel caricamento.');
    } finally { setBusy(false); }
  }

  async function finish() {
    if (!submissionId) { setMsg('Carica almeno una scansione.'); return; }
    await upsertSubmission(token, { mode: 'scan', status: 'inviata', submission_id: submissionId, children: [] });
    setMsg('Registro inviato! Grazie.');
  }

  return (
    <div>
      <button data-testid="back" onClick={onBack}>← Indietro</button>
      <h2 style={{ color: C.primary }}>Carica il registro</h2>
      <p>Carica <strong>scansioni pulite e leggibili</strong> (JPG, PNG o PDF, max 10MB ciascuna). Evita foto sfocate,
        storte o con ombre: se non sono leggibili non possiamo trascriverle correttamente.</p>
      <input data-testid="scan-input" type="file" multiple accept="image/*,application/pdf"
             onChange={e => onFiles(e.target.files)} disabled={busy} />
      <ul data-testid="scan-list">
        {uploaded.map((n, i) => <li key={i}>{n}</li>)}
      </ul>
      <button data-testid="finish-scan" onClick={finish} disabled={busy || !submissionId}
        style={{ background: C.primary, color: '#fff' }}>Ho caricato tutto — Invia</button>
      {msg && <p data-testid="scan-msg">{msg}</p>}
    </div>
  );
}
