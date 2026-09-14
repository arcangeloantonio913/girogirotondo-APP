import React, { useEffect, useState } from 'react';
import { C } from '@/config/tenant';
import {
  createToken, listTokens, revokeToken,
  listSubmissions, getSubmission, patchSubmission, exportSubmission,
} from '@/lib/intakeApi';

export default function AdminIscrizioni() {
  const [tokens, setTokens] = useState([]);
  const [subs, setSubs] = useState([]);
  const [sel, setSel] = useState(null);
  const [newToken, setNewToken] = useState(null); // token in chiaro appena creato
  const [msg, setMsg] = useState('');

  const reload = async () => {
    setTokens(await listTokens());
    setSubs(await listSubmissions());
  };
  useEffect(() => { reload().catch(() => setMsg('Errore nel caricamento.')); }, []);

  async function genToken() {
    const label = window.prompt('Etichetta del link (es. "Segreteria 2026/27")');
    if (!label) return;
    const t = await createToken(label);
    setNewToken(t);
    await reload();
  }

  function linkFor(rawToken) {
    return `${window.location.origin}/iscrizioni?t=${rawToken}`;
  }

  async function openDetail(id) { setSel(await getSubmission(id)); }

  async function doExport(id) {
    const data = await exportSubmission(id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'iscrizioni_normalized.json';
    a.click();
    await reload();
    setMsg('File generato: iscrizioni_normalized.json (consegnalo a Omnia per l\'import).');
  }

  return (
    <div style={{ padding: 20 }} data-testid="admin-iscrizioni">
      <h1 style={{ color: C.primary }}>Raccolta Iscrizioni</h1>

      <section style={{ marginBottom: 24 }}>
        <h2>Link per le scuole</h2>
        <button data-testid="gen-token" onClick={genToken}>+ Genera link segreteria</button>
        {newToken && (
          <div data-testid="new-token" style={{ background: '#fffae6', padding: 12, borderRadius: 8, marginTop: 8 }}>
            <strong>Copia e invia ora questo link (mostrato una sola volta):</strong>
            <input readOnly value={linkFor(newToken.token)} style={{ width: '100%' }}
                   onFocus={e => e.target.select()} />
          </div>
        )}
        <ul>
          {tokens.map(t => (
            <li key={t.id} data-testid={`token-${t.id}`}>
              {t.label} — {t.active ? 'attivo' : 'revocato'}
              {t.active && (
                <button data-testid={`revoke-token-${t.id}`}
                  onClick={async () => { await revokeToken(t.id); reload(); }}>Revoca</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Iscrizioni ricevute</h2>
        <table style={{ width: '100%' }}>
          <thead><tr><th>Data</th><th>Modalità</th><th>Stato</th><th>Bambini</th><th>Maestre</th><th>Direttrici</th><th></th></tr></thead>
          <tbody>
            {subs.map(s => (
              <tr key={s.id} data-testid={`sub-${s.id}`}>
                <td>{(s.created_at || '').slice(0, 10)}</td>
                <td>{s.mode}</td>
                <td>{s.status}</td>
                <td>{(s.children || []).length}</td>
                <td>{(s.staff || []).length}</td>
                <td>{(s.direttrici || []).length}</td>
                <td>
                  <button data-testid={`open-${s.id}`} onClick={() => openDetail(s.id)}>Apri</button>
                  <button data-testid={`export-${s.id}`} onClick={() => doExport(s.id)}>Genera file import</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {sel && <SubmissionDetail sub={sel} onClose={() => setSel(null)}
        onSaved={async () => { await reload(); setSel(null); }} />}
      {msg && <p data-testid="admin-msg">{msg}</p>}
    </div>
  );
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function SubmissionDetail({ sub, onClose, onSaved }) {
  const [staff, setStaff] = useState(sub.staff || []);
  const [children, setChildren] = useState(sub.children || []);
  const [direttrici, setDirettrici] = useState(sub.direttrici || []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const setChildCell = (i, k, v) => setChildren(cs => cs.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  const setStaffCell = (i, k, v) => setStaff(cs => cs.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  const setDirCell = (i, k, v) => setDirettrici(cs => cs.map((c, idx) => idx === i ? { ...c, [k]: v } : c));

  const addStaffRow = () => setStaff(cs => [...cs, { nome: '', cognome: '', email: '', sede_id: sub.staff?.[0]?.sede_id || '', sezioni: [] }]);
  const delStaffRow = (i) => setStaff(cs => cs.filter((_, idx) => idx !== i));
  const addChildRow = () => setChildren(cs => [...cs, { nome: '', cognome: '', data_nascita: '', sede_id: '', classe: '', genitore_nome: '', genitore_cognome: '', genitore_email: '' }]);
  const delChildRow = (i) => setChildren(cs => cs.filter((_, idx) => idx !== i));
  const addDirRow = () => setDirettrici(cs => [...cs, { nome: '', cognome: '', email: '' }]);
  const delDirRow = (i) => setDirettrici(cs => cs.filter((_, idx) => idx !== i));

  async function save() {
    setErr('');
    const badStaff = staff.some(s => !s.nome?.trim() || !s.cognome?.trim() || !EMAIL_RE.test(s.email || ''));
    const badChild = children.some(c => !c.nome?.trim() || !c.cognome?.trim() || !EMAIL_RE.test(c.genitore_email || ''));
    const badDir = direttrici.some(d => !d.nome?.trim() || !d.cognome?.trim() || !EMAIL_RE.test(d.email || ''));
    if (badStaff || badChild || badDir) {
      setErr('Controlla i campi obbligatori (nome, cognome, email) prima di salvare.');
      return;
    }
    setSaving(true);
    try {
      await patchSubmission(sub.id, { children, staff, direttrici, status: 'revisionata' });
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Errore nel salvataggio.');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, marginTop: 16 }} data-testid="sub-detail">
      <button data-testid="close-detail" onClick={onClose}>Chiudi</button>
      <h3>Dettaglio ({sub.mode})</h3>
      {sub.mode === 'scan' && (
        <ul>{(sub.scans || []).map(sc => <li key={sc.file_id}>{sc.filename} ({Math.round(sc.size / 1024)} KB)</li>)}</ul>
      )}

      {/* ── Maestre ──────────────────────────────────────────── */}
      <section data-testid="detail-maestre" style={{ marginBottom: 16 }}>
        <h4>Maestre</h4>
        {staff.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <input data-testid={`detail-maestra-nome-${i}`} placeholder="Nome" value={c.nome || ''} onChange={e => setStaffCell(i, 'nome', e.target.value)} />
            <input placeholder="Cognome" value={c.cognome || ''} onChange={e => setStaffCell(i, 'cognome', e.target.value)} />
            <input placeholder="Email" value={c.email || ''} onChange={e => setStaffCell(i, 'email', e.target.value)} />
            <input placeholder="Sede" value={c.sede_id || ''} onChange={e => setStaffCell(i, 'sede_id', e.target.value)} />
            <input placeholder="Sezioni (separate da virgola)" value={(c.sezioni || []).join(', ')}
              onChange={e => setStaffCell(i, 'sezioni', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            <button onClick={() => delStaffRow(i)}>✕</button>
          </div>
        ))}
        <button data-testid="detail-add-maestra" onClick={addStaffRow}>+ Aggiungi maestra</button>
      </section>

      {/* ── Famiglie ─────────────────────────────────────────── */}
      <section data-testid="detail-famiglie" style={{ marginBottom: 16 }}>
        <h4>Famiglie</h4>
        {children.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <input data-testid={`detail-nome-${i}`} placeholder="Nome" value={c.nome || ''} onChange={e => setChildCell(i, 'nome', e.target.value)} />
            <input placeholder="Cognome" value={c.cognome || ''} onChange={e => setChildCell(i, 'cognome', e.target.value)} />
            <input placeholder="Data nascita" value={c.data_nascita || ''} onChange={e => setChildCell(i, 'data_nascita', e.target.value)} />
            <input placeholder="Sezione" value={c.classe || ''} onChange={e => setChildCell(i, 'classe', e.target.value)} />
            <input placeholder="Email genitore" value={c.genitore_email || ''} onChange={e => setChildCell(i, 'genitore_email', e.target.value)} />
            <button onClick={() => delChildRow(i)}>✕</button>
          </div>
        ))}
        <button data-testid="detail-add-bambino" onClick={addChildRow}>+ Aggiungi bambino</button>
      </section>

      {/* ── Direttrice ───────────────────────────────────────── */}
      <section data-testid="detail-direttrice" style={{ marginBottom: 16, background: '#fff4e5', border: '1px solid #f0ad4e', borderRadius: 8, padding: 10 }}>
        <h4 style={{ color: '#a15c00' }}>Direttrice</h4>
        <p style={{ color: '#a15c00', fontWeight: 'bold', fontSize: 13 }} data-testid="direttrice-warning">
          Attenzione: questa sezione crea account con privilegi di amministrazione.
        </p>
        {direttrici.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <input data-testid={`detail-direttrice-nome-${i}`} placeholder="Nome" value={c.nome || ''} onChange={e => setDirCell(i, 'nome', e.target.value)} />
            <input placeholder="Cognome" value={c.cognome || ''} onChange={e => setDirCell(i, 'cognome', e.target.value)} />
            <input placeholder="Email" value={c.email || ''} onChange={e => setDirCell(i, 'email', e.target.value)} />
            <button onClick={() => delDirRow(i)}>✕</button>
          </div>
        ))}
        <button data-testid="detail-add-direttrice" onClick={addDirRow}>+ Aggiungi direttrice</button>
      </section>

      {err && <p style={{ color: 'crimson' }} data-testid="detail-err">{err}</p>}
      <button data-testid="save-detail" onClick={save} disabled={saving}>Salva correzioni</button>
    </div>
  );
}
