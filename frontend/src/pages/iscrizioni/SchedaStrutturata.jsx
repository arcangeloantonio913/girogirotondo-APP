import React, { useMemo, useState } from 'react';
import { C } from '@/config/tenant';
import { upsertSubmission, formatApiError } from '@/lib/intakeApi';

const EMPTY_CHILD = {
  nome: '', cognome: '', data_nascita: '', sede_id: '', classe: '',
  genitore_nome: '', genitore_cognome: '', genitore_email: '',
};
const EMPTY_STAFF = { nome: '', cognome: '', email: '', sede_id: '', sezioni: [] };
const EMPTY_DIR = { nome: '', cognome: '', email: '' };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function isBlank(v) {
  return !String(v || '').trim();
}

function isChildEmpty(r) {
  return ['nome', 'cognome', 'data_nascita', 'sede_id', 'classe',
    'genitore_nome', 'genitore_cognome', 'genitore_email'].every(k => isBlank(r[k]));
}
function isStaffEmpty(r) {
  return isBlank(r.nome) && isBlank(r.cognome) && isBlank(r.email)
    && isBlank(r.sede_id) && (r.sezioni || []).length === 0;
}
function isDirEmpty(r) {
  return isBlank(r.nome) && isBlank(r.cognome) && isBlank(r.email);
}

function validateChild(r) {
  const e = {};
  for (const k of ['nome', 'cognome', 'sede_id', 'classe', 'genitore_nome', 'genitore_cognome']) {
    if (isBlank(r[k])) e[k] = true;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data_nascita)) e.data_nascita = true;
  if (!EMAIL_RE.test(r.genitore_email)) e.genitore_email = true;
  return e;
}
function validateStaff(r) {
  const e = {};
  if (isBlank(r.nome)) e.nome = true;
  if (isBlank(r.cognome)) e.cognome = true;
  if (isBlank(r.sede_id)) e.sede_id = true;
  if (!EMAIL_RE.test(r.email)) e.email = true;
  return e;
}
function validateDir(r) {
  const e = {};
  if (isBlank(r.nome)) e.nome = true;
  if (isBlank(r.cognome)) e.cognome = true;
  if (!EMAIL_RE.test(r.email)) e.email = true;
  return e;
}

export default function SchedaStrutturata({ token, config, onBack }) {
  const [children, setChildren] = useState([{ ...EMPTY_CHILD }]);
  const [staff, setStaff] = useState([{ ...EMPTY_STAFF }]);
  const [direttrici, setDirettrici] = useState([{ ...EMPTY_DIR }]);
  const [submissionId, setSubmissionId] = useState(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const sezioniPerSede = config.sezioni_by_sede || {};

  // ── Famiglie ──────────────────────────────────────────────────
  const setChildCell = (i, k, v) =>
    setChildren(rs => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addChild = () => setChildren(rs => [...rs, { ...EMPTY_CHILD }]);
  const delChild = (i) => setChildren(rs => rs.filter((_, idx) => idx !== i));

  const childrenNonEmpty = useMemo(() => children.filter(r => !isChildEmpty(r)), [children]);
  const childErrors = useMemo(() => childrenNonEmpty.map(validateChild), [childrenNonEmpty]);
  const hasChildErrors = childErrors.some(e => Object.keys(e).length > 0);
  // Solo le righe non-vuote E valide vengono inviate al backend (bozza inclusa):
  // il backend valida IntakeChild per intero anche in stato "bozza", quindi una riga
  // parzialmente compilata farebbe 422 e perderebbe tutto il salvataggio.
  const childrenValid = useMemo(
    () => childrenNonEmpty.filter(r => Object.keys(validateChild(r)).length === 0),
    [childrenNonEmpty]
  );

  // ── Maestre ───────────────────────────────────────────────────
  const setStaffCell = (i, k, v) =>
    setStaff(rs => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addStaff = () => setStaff(rs => [...rs, { ...EMPTY_STAFF }]);
  const delStaff = (i) => setStaff(rs => rs.filter((_, idx) => idx !== i));
  const toggleStaffSezione = (i, sez) =>
    setStaff(rs => rs.map((r, idx) => {
      if (idx !== i) return r;
      const has = (r.sezioni || []).includes(sez);
      return { ...r, sezioni: has ? r.sezioni.filter(s => s !== sez) : [...(r.sezioni || []), sez] };
    }));
  const addCustomSezione = (i, sez) => {
    const name = (sez || '').trim();
    if (!name) return;
    setStaff(rs => rs.map((r, idx) => {
      if (idx !== i) return r;
      if ((r.sezioni || []).includes(name)) return r;
      return { ...r, sezioni: [...(r.sezioni || []), name] };
    }));
  };

  const staffNonEmpty = useMemo(() => staff.filter(r => !isStaffEmpty(r)), [staff]);
  const staffErrors = useMemo(() => staffNonEmpty.map(validateStaff), [staffNonEmpty]);
  const hasStaffErrors = staffErrors.some(e => Object.keys(e).length > 0);
  const staffValid = useMemo(
    () => staffNonEmpty.filter(r => Object.keys(validateStaff(r)).length === 0),
    [staffNonEmpty]
  );

  // ── Direttrice ────────────────────────────────────────────────
  const setDirCell = (i, k, v) =>
    setDirettrici(rs => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addDir = () => setDirettrici(rs => [...rs, { ...EMPTY_DIR }]);
  const delDir = (i) => setDirettrici(rs => rs.filter((_, idx) => idx !== i));

  const dirNonEmpty = useMemo(() => direttrici.filter(r => !isDirEmpty(r)), [direttrici]);
  const dirErrors = useMemo(() => dirNonEmpty.map(validateDir), [dirNonEmpty]);
  const hasDirErrors = dirErrors.some(e => Object.keys(e).length > 0);
  const dirValid = useMemo(
    () => dirNonEmpty.filter(r => Object.keys(validateDir(r)).length === 0),
    [dirNonEmpty]
  );

  const hasErrors = hasChildErrors || hasStaffErrors || hasDirErrors;

  async function save(status) {
    setSaving(true); setMsg('');
    try {
      // Solo le righe valide vengono persistite (sia bozza che invio): righe non-vuote
      // ma incomplete restano nello stato locale per essere completate in seguito, senza
      // far fallire il salvataggio con un 422 del backend.
      const res = await upsertSubmission(token, {
        mode: 'form', status, submission_id: submissionId,
        children: childrenValid,
        staff: staffValid,
        direttrici: dirValid,
      });
      setSubmissionId(res.id);
      setMsg(status === 'inviata' ? 'Iscrizioni inviate! Grazie.' : 'Bozza salvata.');
    } catch (e) {
      setMsg(formatApiError(e, 'Errore nel salvataggio.'));
    } finally { setSaving(false); }
  }

  return (
    <div>
      <button data-testid="back" onClick={onBack}>← Indietro</button>
      <h2 style={{ color: C.primary }}>Scheda iscrizioni</h2>

      {/* ── Sezione Maestre ─────────────────────────────────────── */}
      <section data-testid="sezione-maestre" style={{ marginBottom: 24 }}>
        <h3 style={{ color: C.primary }}>Maestre</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Nome', 'Cognome', 'Email', 'Sede', 'Sezioni assegnate', ''].map(h =>
                <th key={h} style={{ textAlign: 'left', fontSize: 12 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {staff.map((r, i) => {
              const opzioni = sezioniPerSede[r.sede_id] || [];
              return (
                <tr key={i}>
                  <td><input data-testid={`maestra-nome-${i}`} value={r.nome} onChange={e => setStaffCell(i, 'nome', e.target.value)} /></td>
                  <td><input data-testid={`maestra-cognome-${i}`} value={r.cognome} onChange={e => setStaffCell(i, 'cognome', e.target.value)} /></td>
                  <td><input data-testid={`maestra-email-${i}`} type="email" value={r.email} onChange={e => setStaffCell(i, 'email', e.target.value)} /></td>
                  <td>
                    <select data-testid={`maestra-sede-${i}`} value={r.sede_id} onChange={e => setStaffCell(i, 'sede_id', e.target.value)}>
                      <option value="">—</option>
                      {config.sedi.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {opzioni.map(sez => (
                        <label key={sez} style={{ fontSize: 12 }}>
                          <input type="checkbox" data-testid={`maestra-sezione-${i}-${sez}`}
                            checked={(r.sezioni || []).includes(sez)}
                            onChange={() => toggleStaffSezione(i, sez)} />
                          {sez}
                        </label>
                      ))}
                    </div>
                    {(r.sezioni || []).filter(s => !opzioni.includes(s)).map(sez => (
                      <span key={sez} style={{ fontSize: 12, marginRight: 6 }}>
                        {sez} <button type="button" onClick={() => setStaffCell(i, 'sezioni', r.sezioni.filter(s => s !== sez))}>✕</button>
                      </span>
                    ))}
                    <NewSezioneInput onAdd={(name) => addCustomSezione(i, name)} testid={`maestra-nuova-sezione-${i}`} />
                  </td>
                  <td><button onClick={() => delStaff(i)} disabled={staff.length === 1}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hasStaffErrors && <p style={{ color: 'crimson' }} data-testid="maestre-validation-hint">
          Controlla i campi evidenziati (nome/cognome, sede, email maestra).</p>}
        <button data-testid="add-maestra" onClick={addStaff}>+ Aggiungi maestra</button>
      </section>

      {/* ── Sezione Famiglie ────────────────────────────────────── */}
      <section data-testid="sezione-famiglie" style={{ marginBottom: 24 }}>
        <h3 style={{ color: C.primary }}>Famiglie</h3>
        <table data-testid="scheda-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Nome', 'Cognome', 'Data nascita', 'Sede', 'Sezione', 'Genitore nome', 'Genitore cognome', 'Email genitore', ''].map(h =>
                <th key={h} style={{ textAlign: 'left', fontSize: 12 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {children.map((r, i) => (
              <tr key={i}>
                <td><input data-testid={`nome-${i}`} value={r.nome} onChange={e => setChildCell(i, 'nome', e.target.value)} /></td>
                <td><input value={r.cognome} onChange={e => setChildCell(i, 'cognome', e.target.value)} /></td>
                <td><input type="date" value={r.data_nascita} onChange={e => setChildCell(i, 'data_nascita', e.target.value)} /></td>
                <td>
                  <select value={r.sede_id} onChange={e => setChildCell(i, 'sede_id', e.target.value)}>
                    <option value="">—</option>
                    {config.sedi.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td>
                  <input list={`sez-${r.sede_id}`} value={r.classe}
                    onChange={e => setChildCell(i, 'classe', e.target.value)} placeholder="Sezione" />
                  <datalist id={`sez-${r.sede_id}`}>
                    {(sezioniPerSede[r.sede_id] || []).map(n => <option key={n} value={n} />)}
                  </datalist>
                </td>
                <td><input value={r.genitore_nome} onChange={e => setChildCell(i, 'genitore_nome', e.target.value)} /></td>
                <td><input value={r.genitore_cognome} onChange={e => setChildCell(i, 'genitore_cognome', e.target.value)} /></td>
                <td><input type="email" value={r.genitore_email} onChange={e => setChildCell(i, 'genitore_email', e.target.value)} /></td>
                <td><button onClick={() => delChild(i)} disabled={children.length === 1}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasChildErrors && <p style={{ color: 'crimson' }} data-testid="validation-hint">
          Controlla i campi evidenziati (nome/cognome, data valida, sede, sezione, email).</p>}
        <button data-testid="add-row" onClick={addChild}>+ Aggiungi bambino</button>
      </section>

      {/* ── Sezione Direttrice ──────────────────────────────────── */}
      <section data-testid="sezione-direttrice" style={{ marginBottom: 24 }}>
        <h3 style={{ color: C.primary }}>Direttrice</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Nome', 'Cognome', 'Email', ''].map(h =>
                <th key={h} style={{ textAlign: 'left', fontSize: 12 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {direttrici.map((r, i) => (
              <tr key={i}>
                <td><input data-testid={`direttrice-nome-${i}`} value={r.nome} onChange={e => setDirCell(i, 'nome', e.target.value)} /></td>
                <td><input data-testid={`direttrice-cognome-${i}`} value={r.cognome} onChange={e => setDirCell(i, 'cognome', e.target.value)} /></td>
                <td><input data-testid={`direttrice-email-${i}`} type="email" value={r.email} onChange={e => setDirCell(i, 'email', e.target.value)} /></td>
                <td><button onClick={() => delDir(i)} disabled={direttrici.length === 1}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasDirErrors && <p style={{ color: 'crimson' }} data-testid="direttrice-validation-hint">
          Controlla i campi evidenziati (nome/cognome, email direttrice).</p>}
        <button data-testid="add-direttrice" onClick={addDir}>+ Aggiungi direttrice</button>
      </section>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button data-testid="save-draft" onClick={() => save('bozza')} disabled={saving}>Salva bozza</button>
        <button data-testid="submit" onClick={() => save('inviata')} disabled={saving || hasErrors}
          style={{ background: C.primary, color: '#fff' }}>Invia iscrizioni</button>
      </div>
      {msg && <p data-testid="scheda-msg">{msg}</p>}
    </div>
  );
}

function NewSezioneInput({ onAdd, testid }) {
  const [val, setVal] = useState('');
  return (
    <span style={{ display: 'inline-flex', gap: 4, marginTop: 4 }}>
      <input data-testid={testid} value={val} placeholder="Nuova sezione"
        onChange={e => setVal(e.target.value)} style={{ fontSize: 12, width: 100 }} />
      <button type="button" onClick={() => { onAdd(val); setVal(''); }}>+</button>
    </span>
  );
}
