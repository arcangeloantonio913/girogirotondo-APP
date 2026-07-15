import { ImageSourcePropType } from 'react-native';

// ─────────────────────────────────────────────────────────────
// Branding per-tenant.
// Il tenant attivo è scelto a build-time via EXPO_PUBLIC_TENANT
// (default 'girogirotondo'). I require() dei logo sono statici
// (stringa letterale) perché Metro li risolve a build-time.
// ─────────────────────────────────────────────────────────────

export type TenantSede = {
  id: string;
  name: string;
  logo?: ImageSourcePropType;
};

// Segmento colorato del wordmark (per il titolo multi-colore di Giro).
export type WordmarkSegment = { text: string; color: string };

export type TenantColors = {
  bg: string;
  white: string;
  primary: string;
  babyBlue: string;
  babyPink: string;
  babyGreen: string;
  text: string;
  muted: string;
  gray: string;
  red: string;
  redBg: string;
  border: string;
  divider: string;      // hairline chiaro usato dalle schermate interne (neutro)
  accentPink: string;   // rosa acceso (accento), distinto dal pastello babyPink
  accentGreen: string;  // verde acceso (accento), distinto dal pastello babyGreen
  accentOrange: string; // arancione accento (icone presenze/modulistica)
  tintBlue: string;     // bg tint icone (utenti/classi/appuntamenti/profilo)
  tintOrange: string;   // bg tint icone (presenze/modulistica)
  tintGreen: string;    // bg tint icone (mensa)
  tintPink: string;     // bg tint icone (avvisi)
};

export type Tenant = {
  appName: string;
  wordmark?: WordmarkSegment[];   // opzionale: se assente si usa appName in un solo colore
  tagline: string;
  footer: string;
  colors: TenantColors;
  logo: ImageSourcePropType | null;
  sedi: TenantSede[];
  // true se il tenant ha un portale web dove atterra il link di reset password.
  // false per i tenant con sola landing (es. Dimensione Bimbo): "Password
  // dimenticata?" non naviga, mostra un alert (il reset si gestisce con la scuola).
  passwordResetEnabled: boolean;
};

const TENANTS: Record<string, Tenant> = {
  // ── Cliente 1: Girogirotondo (build identica a quella attuale) ──
  girogirotondo: {
    appName: 'Girogirotondo',
    wordmark: [
      { text: 'Giro',  color: '#4169E1' },
      { text: 'giro',  color: '#FF69B4' },
      { text: 'tondo', color: '#32CD32' },
    ],
    tagline: 'La tua scuola a portata di mano',
    footer:
      '© 2026 Piattaforma Istituzionale Girogirotondo — Conforme GDPR e normative EU.\n' +
      'Realizzato da Omnia',
    colors: {
      bg: '#FFFDD0', white: '#FFFFFF', primary: '#4169E1',
      babyBlue: '#A7C7E7', babyPink: '#F4C2C2', babyGreen: '#98FB98',
      text: '#1A202C', muted: '#9CA3AF', gray: '#6B7280',
      red: '#EF4444', redBg: '#FEF2F2', border: '#E5E7EB',
      divider: '#F3F4F6', accentPink: '#FF69B4', accentGreen: '#32CD32',
      accentOrange: '#FF9500',
      tintBlue: '#EBF0FF', tintOrange: '#FFF7E6', tintGreen: '#F0FFF0', tintPink: '#FFF0F7',
    },
    logo: require('../../assets/logo-girogirotondo.png'),
    sedi: [
      { id: 'girogirotondo',   name: 'Girogirotondo',   logo: require('../../assets/logo-girogirotondo.png') },
      { id: 'il-magico-mondo', name: 'Il Magico Mondo', logo: require('../../assets/logo-magico-mondo.png') },
    ],
    passwordResetEnabled: true,
  },

  // ── Cliente 2: Dimensione Bimbo (branding NON ancora definito) ──
  // I colori sono placeholder volutamente visibili: vanno sostituiti
  // dal designer prima del rilascio di questo tenant.
  'dimensione-bimbo': {
    appName: 'Dimensione Bimbo',
    tagline: 'La tua scuola a portata di mano',
    footer: '© 2026 Dimensione Bimbo — Realizzato da Omnia',
    colors: {
      bg: '#FFE3C2', white: '#FFFFFF', primary: '#FB6A00',
      babyBlue: '#FACC15', babyPink: '#FFC9A3', babyGreen: '#FCD9A0',
      text: '#1A202C', muted: '#9CA3AF', gray: '#6B7280',
      red: '#EF4444', redBg: '#FEF2F2', border: '#E5E7EB',
      divider: '#F3F4F6', accentPink: '#EC4899', accentGreen: '#F59E0B',
      accentOrange: '#FB6A00',
      tintBlue: '#FFF3E0', tintOrange: '#FFEAD2', tintGreen: '#FEF3C7', tintPink: '#FCE7F3',
    },
    logo: null,
    sedi: [
      { id: 'db-centrale',   name: 'Sede Centrale' },
      { id: 'db-nido',       name: 'Nido' },
      { id: 'db-succursale', name: 'Succursale' },
      { id: 'db-micronido',  name: 'Micronido' },
    ],
    passwordResetEnabled: false,   // solo landing, nessun portale web di reset
  },
};

const activeKey = process.env.EXPO_PUBLIC_TENANT || 'girogirotondo';

export const tenant: Tenant = TENANTS[activeKey] ?? TENANTS.girogirotondo;
