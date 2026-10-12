// ─────────────────────────────────────────────────────────────
// Branding per-tenant della WEB APP (gemello di mobile/src/config/tenant.ts).
// Il tenant attivo è scelto a build-time via REACT_APP_TENANT (default 'girogirotondo').
// Stesso backend multi-tenant per tutti: cambia solo il branding + l'elenco sedi.
//
// `C` (= tenant.colors) è usato ovunque al posto degli hex cablati: per girogirotondo
// i valori sono IDENTICI a prima (nessuna regressione), per dimensione-bimbo diventano
// la palette arancione, coerente con l'app mobile.
// ─────────────────────────────────────────────────────────────

// Logo placeholder inline (SVG data URI) finché non c'è il logo reale del tenant.
// Cerchio a tinta brand con le iniziali — non richiede file su disco, niente immagini rotte.
function placeholderLogo(bg, initials) {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>` +
    `<circle cx='60' cy='60' r='60' fill='${bg}'/>` +
    `<text x='60' y='80' font-size='48' font-family='Arial,Helvetica,sans-serif' ` +
    `font-weight='bold' fill='#ffffff' text-anchor='middle'>${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Logo reale Dimensione Bimbo (famiglia + app, tondo). Fallback: placeholder SVG.
const DB_LOGO = '/logo-dimensione-bimbo.jpg';

const TENANTS = {
  // ── Cliente 1: Girogirotondo (palette storica, invariata) ──
  girogirotondo: {
    appName: 'Girogirotondo',
    tagline: 'La tua scuola a portata di mano',
    footer:
      '© 2026 Piattaforma Istituzionale Girogirotondo — Conforme GDPR e normative EU. Realizzato da Omnia',
    logo: '/logo-girogirotondo.png',
    favicon: '/logo-girogirotondo.png',
    manifest: {
      name: 'Girogirotondo - Gestione Asilo',
      shortName: 'Girogirotondo',
      description:
        "Piattaforma digitale per genitori e maestre della scuola dell'infanzia Girogirotondo.",
      title: "Girogirotondo - Scuola dell'Infanzia",
    },
    colors: {
      primary: '#4169E1',
      bg: '#FFFDD0',
      babyBlue: '#A7C7E7',
      babyPink: '#F4C2C2',
      babyGreen: '#98FB98',
      accentPink: '#FF69B4',
      accentGreen: '#32CD32',
      tintBlue: '#EBF0FF',
      tintGreen: '#F0FFF0',
      tintPink: '#FFF0F7',
    },
    sedi: [
      { id: 'girogirotondo',   label: 'Girogirotondo',   color: '#4169E1', logo: '/logo-girogirotondo.png' },
      { id: 'il-magico-mondo', label: 'Il Magico Mondo', color: '#FF69B4', logo: '/logo-magico-mondo.png' },
    ],
    contacts: {
      email: 'scuolagirogirotondo@libero.it',
      phoneBySede: { 'girogirotondo': '350 16 76 101', 'il-magico-mondo': '392 41 79 110' },
      phoneDefault: '350 16 76 101',
    },
    legal: {
      ragioneSociale: "Scuola dell'Infanzia Girogirotondo",
      piva: '',
      indirizzo: 'Carini (PA)',
      email: 'scuolagirogirotondo@libero.it',
    },
  },

  // ── Cliente 2: Dimensione Bimbo (palette arancione, come l'app) ──
  'dimensione-bimbo': {
    appName: 'Dimensione Bimbo',
    tagline: 'La tua scuola a portata di mano',
    // Griglia: Dimensione Bimbo NON usa la colonna "Pane" (Girogirotondo sì).
    hidePaneGriglia: true,
    footer: '© 2026 Dimensione Bimbo soc.coop.soc. — P.IVA 04323410821 — Conforme GDPR e normative EU. Realizzato da Omnia',
    logo: DB_LOGO,
    favicon: DB_LOGO,
    manifest: {
      name: 'Dimensione Bimbo - Gestione Asilo',
      shortName: 'Dimensione Bimbo',
      description:
        "Piattaforma digitale per genitori e maestre della scuola dell'infanzia Dimensione Bimbo.",
      title: "Dimensione Bimbo - Scuola dell'Infanzia",
    },
    colors: {
      primary: '#FB6A00',
      bg: '#FFE3C2',
      babyBlue: '#FACC15',
      babyPink: '#FFC9A3',
      babyGreen: '#FCD9A0',
      accentPink: '#EC4899',
      accentGreen: '#F59E0B',
      tintBlue: '#FFF3E0',
      tintGreen: '#FEF3C7',
      tintPink: '#FCE7F3',
    },
    // Sedi reali di Dimensione Bimbo (coerenti con il tenant DB nel backend/app).
    sedi: [
      { id: 'db-centrale',   label: 'Sede Centrale', color: '#FB6A00', logo: DB_LOGO },
      { id: 'db-nido',       label: 'Nido',          color: '#F59E0B', logo: DB_LOGO },
      { id: 'db-succursale', label: 'Succursale',    color: '#EC4899', logo: DB_LOGO },
      { id: 'db-micronido',  label: 'Micronido',     color: '#FACC15', logo: DB_LOGO },
    ],
    // Telefoni reali delle sedi Dimensione Bimbo (Palermo). email: null → riga nascosta
    // finché non viene fornita l'email ufficiale della scuola.
    contacts: {
      email: 'info@dimensionebimbo.it',
      phoneBySede: {
        'db-centrale':   '091 424631',
        'db-nido':       '091 594416',
        'db-micronido':  '091 8435272',
        'db-succursale': '091 485846',
      },
      phoneDefault: '091 424631',
    },
    // Dati legali reali (da dimensionebimbo.it) per privacy/footer.
    legal: {
      ragioneSociale: 'Dimensione Bimbo soc.coop.soc.',
      piva: '04323410821',
      indirizzo: 'Via G. Pollaci, 30 - 90135 Palermo',
      email: 'info@dimensionebimbo.it',
    },
  },

  // ── Linea prodotto FISM (scuole paritarie) ──
  // Build dedicato: NON tocca gli altri tenant. `features.rette` accende le sezioni
  // Rette/Pagamenti (gestionale amministrativo) solo qui. Il branding della singola
  // scuola arriva a runtime dalla sede (sede.color); qui c'è il default della scuola demo.
  fism: {
    appName: 'Santa Teresa',
    tagline: 'La scuola in un touch',
    footer:
      '© 2026 Santa Teresa — in collaborazione con FISM — Realizzato da Omnia. Conforme GDPR e normative EU',
    logo: '/logo-fism.png',
    favicon: '/logo-fism.png',
    // Abilita il modulo amministrativo (voci menu Rette/Pagamenti). Assente sugli altri
    // tenant → per loro le voci restano nascoste.
    features: { rette: true },
    manifest: {
      name: 'Santa Teresa - La scuola in un touch',
      shortName: 'Santa Teresa',
      description:
        "La scuola dell'infanzia in un'app: comunicazioni, presenze, mensa, rette e pagamenti — per famiglie e maestre.",
      title: "Santa Teresa - La scuola in un touch",
    },
    colors: {
      primary: '#7A5CFF',
      bg: '#F6F4FF',
      babyBlue: '#A9C9FF',
      babyPink: '#FFC2E2',
      babyGreen: '#B7F0D8',
      accentPink: '#FF6FB5',
      accentGreen: '#34D399',
      tintBlue: '#EEF1FF',
      tintGreen: '#ECFDF5',
      tintPink: '#FDF0F8',
    },
    sedi: [
      { id: 'santa-teresa', label: 'Santa Teresa', color: '#7A5CFF', logo: '/logo-fism.png' },
    ],
    contacts: {
      email: null,
      phoneBySede: {},
      phoneDefault: '',
    },
    legal: {
      ragioneSociale: "Scuola dell'Infanzia Santa Teresa",
      piva: '',
      indirizzo: 'Palermo',
      email: '',
    },
  },
};

const activeKey = process.env.REACT_APP_TENANT || 'girogirotondo';

export const tenant = TENANTS[activeKey] || TENANTS.girogirotondo;

// Palette brand attiva — importata come `C` dai componenti/pagine.
export const C = tenant.colors;

// Elenco sedi del tenant (usato da AuthContext e AppLayout per lo switch sede).
export const SEDI = tenant.sedi;

export default tenant;

