/* eslint-disable */
/**
 * Prebuild: applica al tenant attivo (REACT_APP_TENANT) i metadati STATICI che i bot di
 * anteprima link (iMessage/WhatsApp/Facebook) e i motori leggono dall'HTML grezzo:
 *   - public/manifest.json (PWA)
 *   - public/index.html: <title>, description, theme-color, Open Graph (og:title/description/
 *     image/url), apple-touch-icon, apple-mobile-web-app-title
 * NB: le modifiche a runtime in App.js NON bastano per le anteprime (i crawler non eseguono JS).
 * Per girogirotondo (default) rigenera gli stessi valori storici → nessun cambiamento.
 */
const fs = require('fs');
const path = require('path');

const TENANTS = {
  girogirotondo: {
    name: 'Girogirotondo - Gestione Asilo',
    short_name: 'Girogirotondo',
    appleTitle: 'Girogiro',
    description:
      "La piattaforma digitale della scuola dell'infanzia: comunicazioni, foto, presenze e menù della mensa — sempre a portata di mano per genitori e maestre.",
    title: "Girogirotondo - Scuola dell'Infanzia",
    ogTitle: 'Girogirotondo — Il Magico Mondo',
    theme_color: '#4169E1',
    background_color: '#FFFDD0',
    icon: '/logo-girogirotondo.png',
    // URL con www: il dominio senza www fa un 307 redirect e WhatsApp/Telegram NON seguono
    // i redirect per og:image -> l'anteprima restava senza immagine. Con www risponde 200 diretto.
    ogUrl: 'https://www.girogirotondowebapp.it',
    ogImage: 'https://www.girogirotondowebapp.it/logo-girogirotondo.png',
  },
  'dimensione-bimbo': {
    name: 'Dimensione Bimbo - Gestione Asilo',
    short_name: 'Dimensione Bimbo',
    appleTitle: 'Dimensione Bimbo',
    description:
      "Piattaforma digitale per genitori e maestre della scuola dell'infanzia Dimensione Bimbo.",
    title: "Dimensione Bimbo - Scuola dell'Infanzia",
    ogTitle: 'Dimensione Bimbo — Scuola dell\'Infanzia',
    theme_color: '#FB6A00',
    background_color: '#FFE3C2',
    icon: '/logo-dimensione-bimbo.jpg',
    ogUrl: 'https://dimensionebimbowebapp.vercel.app',
    ogImage: 'https://dimensionebimbowebapp.vercel.app/logo-dimensione-bimbo.jpg',
  },
};

const key = process.env.REACT_APP_TENANT || 'girogirotondo';
const t = TENANTS[key] || TENANTS.girogirotondo;
const pub = path.join(__dirname, '..', 'public');

// ── manifest.json ────────────────────────────────────────────────────────────
const manifestPath = path.join(pub, 'manifest.json');
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) {}
manifest.name = t.name;
manifest.short_name = t.short_name;
manifest.description = t.description;
manifest.theme_color = t.theme_color;
manifest.background_color = t.background_color;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// ── index.html (title, description, theme-color, OG, icone) ───────────────────
const indexPath = path.join(pub, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Gli attributi usano doppi apici: match del content fino al doppio apice di chiusura
// (gli apostrofi come in "dell'infanzia" sono ammessi dentro). I valori non contengono ".
const esc = (s) => String(s).replace(/"/g, '&quot;');

// helper: sostituisce il content di un <meta name|property="X" ...>
function setMeta(attr, name, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${name}"[^>]*content=")[^"]*(")`, 'i');
  if (re.test(html)) html = html.replace(re, `$1${esc(value)}$2`);
}
// <title>
html = html.replace(/<title>[^<]*<\/title>/i, `<title>${t.title}</title>`);
setMeta('name', 'description', t.description);
setMeta('name', 'theme-color', t.theme_color);
setMeta('name', 'apple-mobile-web-app-title', t.appleTitle);
setMeta('property', 'og:title', t.ogTitle);
setMeta('property', 'og:description', t.description);
// apple-touch-icon href
html = html.replace(
  /(<link\s+rel="apple-touch-icon"[^>]*href=")[^"]*(")/i,
  `$1${t.icon}$2`
);

// og:image / og:url: sostituisci se presenti, altrimenti inietta dopo og:type
function ensureOg(prop, value) {
  const re = new RegExp(`(<meta\\s+property="${prop}"[^>]*content=")[^"]*(")`, 'i');
  if (re.test(html)) {
    html = html.replace(re, `$1${esc(value)}$2`);
  } else {
    html = html.replace(
      /(<meta\s+property="og:type"[^>]*>)/i,
      `$1\n        <meta property="${prop}" content="${esc(value)}" />`
    );
  }
}
ensureOg('og:image', t.ogImage);
ensureOg('og:url', t.ogUrl);

fs.writeFileSync(indexPath, html);

console.log(`[apply-tenant] tenant "${key}" applicato a manifest.json + index.html (${t.short_name})`);
