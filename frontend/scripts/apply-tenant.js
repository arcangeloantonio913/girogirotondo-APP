/* eslint-disable */
/**
 * Prebuild: rigenera public/manifest.json in base al tenant attivo (REACT_APP_TENANT).
 * Il PWA manifest è statico e non può leggere env a runtime, quindi lo scriviamo qui,
 * una volta per build. Per girogirotondo (default) produce lo stesso manifest di sempre.
 *
 * Il resto del branding (titolo tab, theme-color, favicon) è impostato a runtime da App.js.
 */
const fs = require('fs');
const path = require('path');

const TENANTS = {
  girogirotondo: {
    name: 'Girogirotondo - Gestione Asilo',
    short_name: 'Girogirotondo',
    description:
      "Piattaforma digitale per genitori e maestre della scuola dell'infanzia Girogirotondo.",
    theme_color: '#4169E1',
    background_color: '#FFFDD0',
  },
  'dimensione-bimbo': {
    name: 'Dimensione Bimbo - Gestione Asilo',
    short_name: 'Dimensione Bimbo',
    description:
      "Piattaforma digitale per genitori e maestre della scuola dell'infanzia Dimensione Bimbo.",
    theme_color: '#FB6A00',
    background_color: '#FFE3C2',
  },
};

const key = process.env.REACT_APP_TENANT || 'girogirotondo';
const t = TENANTS[key] || TENANTS.girogirotondo;

const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.warn('[apply-tenant] manifest.json non leggibile, ne creo uno nuovo');
}

manifest.name = t.name;
manifest.short_name = t.short_name;
manifest.description = t.description;
manifest.theme_color = t.theme_color;
manifest.background_color = t.background_color;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`[apply-tenant] manifest aggiornato per tenant "${key}" (${t.short_name})`);
