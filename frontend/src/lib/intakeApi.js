// Client per gli endpoint Raccolta Iscrizioni (/api/intake).
// Gli endpoint pubblici usano il token in query (?t=); quelli admin l'axios `api` (JWT).
import axios from 'axios';
import api from './api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
const BASE = `${BACKEND_URL}/api/intake`;

// ── Pubblici (token) ─────────────────────────────────────────────
export async function getConfig(token) {
  const { data } = await axios.get(`${BASE}/config`, { params: { t: token } });
  return data;
}

export async function upsertSubmission(token, payload) {
  const { data } = await axios.post(`${BASE}/submissions`, payload, { params: { t: token } });
  return data;
}

export async function uploadScan(token, submissionId, file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await axios.post(`${BASE}/submissions/${submissionId}/scans`, form, {
    params: { t: token },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ── Admin (JWT via api client) ───────────────────────────────────
export async function createToken(label, expiresAt = null) {
  const { data } = await api.post('/intake/tokens', { label, expires_at: expiresAt });
  return data; // { id, org_id, label, token }  ← token in chiaro UNA volta
}
export async function listTokens() {
  return (await api.get('/intake/tokens')).data;
}
export async function revokeToken(id) {
  return (await api.delete(`/intake/tokens/${id}`)).data;
}
export async function listSubmissions() {
  return (await api.get('/intake/submissions')).data;
}
export async function getSubmission(id) {
  return (await api.get(`/intake/submissions/${id}`)).data;
}
export async function patchSubmission(id, payload) {
  return (await api.patch(`/intake/submissions/${id}`, payload)).data;
}
export async function exportSubmission(id) {
  return (await api.post(`/intake/submissions/${id}/export`)).data;
}
