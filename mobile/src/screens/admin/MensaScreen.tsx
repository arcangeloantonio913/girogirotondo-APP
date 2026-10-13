import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';
import { todayLocal } from '../../lib/dates';

const C = { ...tenant.colors, border: tenant.colors.divider };

const TODAY = todayLocal();

// Etichette ufficiali pasti (da screenshot Girogirotondo)
const PASTI = [
  { key: 'merenda_mattina',    label: 'Merenda mattina',    icon: '☕', required: false },
  { key: 'primo',              label: 'Pasta / Primo',      icon: '🍝', required: true  },
  { key: 'secondo',            label: 'Secondo',            icon: '🍗', required: true  },
  { key: 'contorno',           label: 'Contorno / Pane',    icon: '🍞', required: false },
  { key: 'frutta',             label: 'Frutta',             icon: '🍎', required: false },
  { key: 'merenda_pomeriggio', label: 'Merenda pomeriggio', icon: '🍪', required: false },
];

type Sede = { id: string; name: string; color?: string };

const PRESETS = [
  { label: '1 giorno',     days: 1  },
  { label: '1 settimana',  days: 7  },
  { label: '2 settimane',  days: 14 },
  { label: '1 mese',       days: 30 },
];

function addDays(d: string, n: number) {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n - 1);
  return dt.toISOString().split('T')[0];
}
function shiftDay(d: string, n: number) {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n);
  return dt.toISOString().split('T')[0];
}
function fmtDay(d: string) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch { return d; }
}
function daysBetween(a: string, b: string) {
  try { return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000) + 1; }
  catch { return 1; }
}
// Elenco date (stringhe YYYY-MM-DD) da 'from' a 'to' inclusi (max 31 giorni di sicurezza)
function rangeDates(from: string, to: string): string[] {
  const out: string[] = []; let d = from; let g = 0;
  while (d <= to && g < 31) { out.push(d); d = shiftDay(d, 1); g++; }
  return out.length ? out : [from];
}
const EMPTY_MEAL = { primo: '', secondo: '', contorno: '', frutta: '', merenda_mattina: '', merenda_pomeriggio: '' };

export default function AdminMensa() {
  const { sede } = useAuth();
  const [meals,   setMeals]   = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,  setEditId]  = useState<string | null>(null);  // menu in modifica
  const [saving,  setSaving]  = useState(false);
  const [sedi,    setSedi]    = useState<Sede[]>([]);

  // Navigazione date
  const [navDate, setNavDate] = useState(TODAY);

  // Form. dayMenus: un menu per giorno (chiave = data YYYY-MM-DD) → piatti diversi per
  // ogni giorno del periodo selezionato.
  const [form, setForm] = useState({
    date_from: TODAY, date_to: TODAY,
    dayMenus: { [TODAY]: { ...EMPTY_MEAL } } as Record<string, Record<string, string>>,
    class_ids: [] as string[], // [] = tutte le classi; altrimenti una o più classi
    sede_ids: sede ? [sede] : [],
  });

  // aggiorna un campo pasto di uno specifico giorno
  const setDayField = (date: string, key: string, val: string) =>
    setForm(f => ({ ...f, dayMenus: { ...f.dayMenus, [date]: { ...(f.dayMenus[date] || EMPTY_MEAL), [key]: val } } }));
  const copyPrevDay = (date: string) =>
    setForm(f => {
      const dates = rangeDates(f.date_from, f.date_to);
      const i = dates.indexOf(date);
      if (i <= 0) return f;
      const prev = f.dayMenus[dates[i - 1]] || EMPTY_MEAL;
      return { ...f, dayMenus: { ...f.dayMenus, [date]: { ...prev } } };
    });

  useEffect(() => {
    Promise.allSettled([api.get('/meals'), api.get('/classes')])
      .then(([mR, cR]) => {
        const val = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value.data : undefined;
        setMeals(val(mR) || []); setClasses(val(cR) || []);
      })
      .catch(() => {}).finally(() => setLoading(false));
  }, [sede]);

  // Sedi dell'org del caller (org-aware lato backend) — solo per il selettore
  useEffect(() => {
    api.get('/sedi').then(r => setSedi(r.data ?? [])).catch(() => setSedi([]));
  }, []);

  // Filtro per data selezionata. I menu a data SINGOLA (creati con solo `date`, senza
  // date_from/date_to — es. dalla web app) non hanno il range: vanno confrontati su `date`,
  // altrimenti (undefined <= navDate === false) sparirebbero dalla lista admin.
  const todayMeals = meals.filter(m =>
    (m.date_from && m.date_to) ? (m.date_from <= navDate && m.date_to >= navDate) : (m.date === navDate)
  );

  const applyPreset = (days: number) => {
    setForm(p => ({ ...p, date_to: addDays(p.date_from, days) }));
  };

  const handleSave = async () => {
    const dates = rangeDates(form.date_from, form.date_to);
    const filled = dates.filter(d => { const m = form.dayMenus[d]; return m && (m.primo || m.secondo); });
    if (filled.length === 0) { Alert.alert('Attenzione', 'Inserisci almeno Pasta e Secondo per un giorno'); return; }
    const targets: string[] = form.class_ids; // [] = tutte le classi
    if (targets.length > 0 && !editId) {
      const label = targets.length === 1
        ? `"${classes.find((c: any) => c.id === targets[0])?.name || 'questa classe'}"`
        : `${targets.length} classi selezionate`;
      Alert.alert(
        'Solo alcune classi',
        `Questo menu sarà visibile SOLO a ${label}. Per farlo vedere a TUTTI i genitori scegli "Tutte le classi".`,
        [
          { text: '✓ Rendi per tutti', onPress: () => doSaveMulti([''], filled) },
          { text: targets.length === 1 ? 'Solo questa' : 'Solo queste', style: 'destructive', onPress: () => doSaveMulti(targets, filled) },
          { text: 'Annulla', style: 'cancel' },
        ],
      );
      return;
    }
    doSaveMulti(targets.length ? targets : [''], filled);
  };

  // Crea un menu per OGNI giorno compilato × OGNI classe selezionata.
  const doSaveMulti = async (targets: string[], dates: string[]) => {
    setSaving(true);
    try {
      const cfg = form.sede_ids[0] ? { headers: { 'X-Sede-Id': form.sede_ids[0] } } : undefined;
      if (editId) {
        const d = dates[0];
        const dm = form.dayMenus[d] || EMPTY_MEAL;
        const res = await api.put(`/meals/menu/${editId}`, { ...dm, date_from: d, date_to: d, date: d, class_id: targets[0] || '', sede_id: form.sede_ids[0] }, cfg);
        setMeals(prev => prev.map(m => m.id === editId ? res.data : m));
      } else {
        const created: any[] = [];
        for (const d of dates) {
          const dm = form.dayMenus[d] || EMPTY_MEAL;
          for (const t of targets) {
            const res = await api.post('/meals/menu', { ...dm, date_from: d, date_to: d, date: d, class_id: t, sede_id: form.sede_ids[0] }, cfg);
            created.push(res.data);
          }
        }
        setMeals(prev => [...created, ...prev]);
      }
      setShowForm(false);
      setEditId(null);
      resetForm();
    } catch (e: any) { Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile salvare il menu'); }
    finally { setSaving(false); }
  };

  const resetForm = () => setForm({ date_from: TODAY, date_to: TODAY, dayMenus: { [TODAY]: { ...EMPTY_MEAL } }, class_ids: [] as string[], sede_ids: sede ? [sede] : [] });

  const openNew = () => { setEditId(null); resetForm(); setShowForm(true); };

  const openEdit = (m: any) => {
    setEditId(m.id);
    const d = m.date_from || m.date || TODAY;
    setForm({
      date_from: d,
      date_to:   d,  // in modifica si lavora su un singolo giorno
      dayMenus: { [d]: {
        primo: m.primo || '', secondo: m.secondo || '', contorno: m.contorno || '',
        frutta: m.frutta || '', merenda_mattina: m.merenda_mattina || '', merenda_pomeriggio: m.merenda_pomeriggio || '',
      } },
      class_ids: m.class_id ? [m.class_id] : [],
      sede_ids: m.sede_id ? [m.sede_id] : (sede ? [sede] : []),
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Elimina menu', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/meals/menu/${id}`); setMeals(prev => prev.filter(m => m.id !== id)); }
        catch { Alert.alert('Errore'); }
      }},
    ]);
  };

  // Selezione SINGOLA: un menu viene creato in UNA sede (il backend salva un solo doc con
  // una sola sede). La multi-selezione precedente era fuorviante — venivano scartate tutte
  // tranne la prima. Ora si sceglie esattamente la sede di destinazione.
  const toggleSede = (id: string) => {
    setForm(p => ({ ...p, sede_ids: [id] }));
  };

  return (
    <ScreenLayout title="Menu Mensa" showBack color={C.primary} loading={loading} scrollable={false}>
      {/* Navigazione date */}
      <View style={s.dateNav}>
        <TouchableOpacity onPress={() => {
          const d = new Date(navDate + 'T12:00:00'); d.setDate(d.getDate() - 1);
          setNavDate(d.toISOString().split('T')[0]);
        }} style={s.navBtn}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={s.dateText}>{new Date(navDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          {navDate === TODAY && <View style={s.todayBadge}><Text style={s.todayText}>Oggi</Text></View>}
        </View>
        <TouchableOpacity onPress={() => {
          const d = new Date(navDate + 'T12:00:00'); d.setDate(d.getDate() + 1);
          setNavDate(d.toISOString().split('T')[0]);
        }} style={s.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={C.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={todayMeals}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={openNew} style={s.addBtn}>
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={s.addBtnText}>Aggiungi Menu</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>🍽️</Text>
            <Text style={s.emptyText}>Nessun menu per questo giorno</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardClass}>{item.class_id ? classes.find(c => c.id === item.class_id)?.name || 'Classe' : 'Tutte le classi'}</Text>
                <Text style={s.cardDates}>{item.date_from}{item.date_to !== item.date_from ? ` → ${item.date_to}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(item)} style={s.delBtn}>
                <Ionicons name="create-outline" size={18} color={C.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.delBtn}>
                <Ionicons name="trash-outline" size={16} color={C.red} />
              </TouchableOpacity>
            </View>
            <View style={s.pastiGrid}>
              {PASTI.filter(p => item[p.key]).map(p => (
                <View key={p.key} style={s.pastoItem}>
                  <Text style={{ fontSize: 16 }}>{p.icon}</Text>
                  <View>
                    <Text style={s.pastoLabel}>{p.label}</Text>
                    <Text style={s.pastoValue}>{item[p.key]}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      />

      {/* ── FORM NUOVO MENU ───────────────────────────────────────────────── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editId ? 'Modifica Menu' : 'Nuovo Menu'}</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={C.text}/></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Sede */}
            <Text style={s.fl}>Sede</Text>
            <View style={s.chipRow}>
              {sedi.map(sd => (
                <TouchableOpacity key={sd.id} onPress={() => toggleSede(sd.id)}
                  style={[s.chip, form.sede_ids.includes(sd.id) && { backgroundColor: sd.color ?? C.primary, borderColor: sd.color ?? C.primary }]}>
                  <Text style={[s.chipText, form.sede_ids.includes(sd.id) && { color: C.white }]}>{sd.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Classi — multi-selezione: "Tutte" oppure una o più classi */}
            <Text style={s.fl}>Per quali classi</Text>
            <TouchableOpacity onPress={() => setForm(p => ({ ...p, class_ids: [] }))}
              style={[s.chip, form.class_ids.length === 0 && { backgroundColor: C.primary, borderColor: C.primary }, { marginBottom: 6 }]}>
              <Text style={[s.chipText, form.class_ids.length === 0 && { color: C.white }]}>✓ Tutte le classi</Text>
            </TouchableOpacity>
            <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
              {classes.map(cls => {
                const sel = form.class_ids.includes(cls.id);
                return (
                  <TouchableOpacity key={cls.id}
                    onPress={() => setForm(p => ({ ...p, class_ids: sel ? p.class_ids.filter(x => x !== cls.id) : [...p.class_ids, cls.id] }))}
                    style={[s.chip, sel && { backgroundColor: C.primary, borderColor: C.primary }]}>
                    <Text style={[s.chipText, sel && { color: C.white }]}>{sel ? '✓ ' : ''}{cls.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {form.class_ids.length > 1 && (
              <Text style={{ fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 6 }}>
                Verrà creato un menu per ognuna delle {form.class_ids.length} classi scelte.
              </Text>
            )}

            {/* Periodo del menu — frecce, niente date scritte a mano */}
            <Text style={s.fl}>Dal giorno</Text>
            <View style={s.dateStepper}>
              <TouchableOpacity onPress={() => setForm(p => { const nf = shiftDay(p.date_from, -1); return { ...p, date_from: nf, date_to: p.date_to < nf ? nf : p.date_to }; })} style={s.stepBtn}>
                <Ionicons name="chevron-back" size={22} color={C.primary} />
              </TouchableOpacity>
              <Text style={s.dateStepTxt}>{fmtDay(form.date_from)}</Text>
              <TouchableOpacity onPress={() => setForm(p => { const nf = shiftDay(p.date_from, 1); return { ...p, date_from: nf, date_to: p.date_to < nf ? nf : p.date_to }; })} style={s.stepBtn}>
                <Ionicons name="chevron-forward" size={22} color={C.primary} />
              </TouchableOpacity>
            </View>

            <Text style={[s.fl, { marginTop: 12 }]}>Fino al giorno</Text>
            <View style={s.dateStepper}>
              <TouchableOpacity onPress={() => setForm(p => ({ ...p, date_to: p.date_to > p.date_from ? shiftDay(p.date_to, -1) : p.date_to }))} style={s.stepBtn}>
                <Ionicons name="chevron-back" size={22} color={C.primary} />
              </TouchableOpacity>
              <Text style={s.dateStepTxt}>{fmtDay(form.date_to)}</Text>
              <TouchableOpacity onPress={() => setForm(p => ({ ...p, date_to: shiftDay(p.date_to, 1) }))} style={s.stepBtn}>
                <Ionicons name="chevron-forward" size={22} color={C.primary} />
              </TouchableOpacity>
            </View>

            <Text style={[s.fl, { marginTop: 12 }]}>Durata rapida</Text>
            <View style={s.chipRow}>
              {PRESETS.map(pr => (
                <TouchableOpacity key={pr.days} onPress={() => applyPreset(pr.days)} style={s.presetBtn}>
                  <Text style={s.presetText}>{pr.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.periodBox}>
              <Ionicons name="calendar-outline" size={16} color={C.primary} />
              <Text style={s.periodTxt}>{daysBetween(form.date_from, form.date_to) === 1 ? 'Compila il menu del giorno' : `${daysBetween(form.date_from, form.date_to)} giorni — compila un menu per ogni giorno`}</Text>
            </View>

            {/* Pasti — UNA sezione per OGNI giorno del periodo (menu diversi per ogni giorno) */}
            {rangeDates(form.date_from, form.date_to).map((date, i) => {
              const dm = form.dayMenus[date] || EMPTY_MEAL;
              const multi = form.date_from !== form.date_to;
              return (
                <View key={date} style={multi ? s.dayCard : { marginTop: 16 }}>
                  {multi ? (
                    <View style={s.dayCardHead}>
                      <Text style={s.dayCardTitle}>Menu Giorno {i + 1} — {fmtDay(date)}</Text>
                      {i > 0 && (
                        <TouchableOpacity onPress={() => copyPrevDay(date)}>
                          <Text style={s.copyPrev}>↩ Copia da ieri</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : <Text style={s.fl}>Pasti</Text>}
                  {PASTI.map(p => (
                    <View key={p.key} style={s.pastoInputRow}>
                      <Text style={s.pastoInputIcon}>{p.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.pastoInputLabel}>{p.label}{p.required ? ' *' : ''}</Text>
                        <TextInput style={s.pastoInput}
                          value={(dm as any)[p.key]}
                          onChangeText={t => setDayField(date, p.key, t)}
                          placeholder={`Es. ${p.key === 'primo' ? 'Pasta al pomodoro' : p.key === 'secondo' ? 'Pollo arrosto' : p.key === 'frutta' ? 'Mela' : p.key === 'merenda_mattina' ? 'Latte e biscotti' : 'Frutta di stagione'}`}
                          placeholderTextColor={C.muted}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}

            <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={s.submitText}>{saving ? 'Salvataggio...' : (editId ? 'Salva Modifiche' : 'Salva Menu')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  dateNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
  navBtn:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dateText:      { fontSize: 14, fontWeight: '700', color: C.text, textTransform: 'capitalize' },
  todayBadge:    { backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  todayText:     { fontSize: 10, color: C.white, fontWeight: '700' },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 12, marginBottom: 12, justifyContent: 'center' },
  addBtnText:    { color: C.white, fontWeight: '700', fontSize: 14 },
  empty:         { alignItems: 'center', paddingTop: 50 },
  emptyText:     { fontSize: 14, color: C.muted, marginTop: 12, textAlign: 'center' },
  card:          { backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: C.border },
  cardTop:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardClass:     { fontSize: 13, fontWeight: '700', color: C.text },
  cardDates:     { fontSize: 11, color: C.muted },
  delBtn:        { padding: 6 },
  pastiGrid:     { gap: 6 },
  pastoItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 8 },
  pastoLabel:    { fontSize: 10, color: C.muted, fontWeight: '600' },
  pastoValue:    { fontSize: 13, fontWeight: '700', color: C.text },
  modal:         { flex: 1, padding: 20, backgroundColor: '#FFFDD0' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: C.text },
  fl:            { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6, marginTop: 14 },
  input:         { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white },
  chipRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  chipText:      { fontSize: 13, fontWeight: '600', color: C.text },
  presetBtn:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.primary, backgroundColor: C.white },
  presetText:    { fontSize: 12, fontWeight: '600', color: C.primary },
  dateStepper:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 4, marginTop: 4 },
  stepBtn:       { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary + '12' },
  dateStepTxt:   { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: C.text, textTransform: 'capitalize' },
  periodBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: C.primary + '0F', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  periodTxt:     { fontSize: 13, fontWeight: '700', color: C.primary },
  dayCard:       { marginTop: 14, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.primary + '06' },
  dayCardHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  dayCardTitle:  { fontSize: 14, fontWeight: '800', color: C.primary, textTransform: 'capitalize' },
  copyPrev:      { fontSize: 12, fontWeight: '700', color: C.primary },
  pastoInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  pastoInputIcon:{ fontSize: 24, width: 36, textAlign: 'center' },
  pastoInputLabel:{ fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 3 },
  pastoInput:    { borderWidth: 0.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: C.text, backgroundColor: C.white },
  submitBtn:     { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText:    { color: C.white, fontWeight: '700', fontSize: 15 },
});
