// app.config.js — configurazione Expo white-label multi-tenant.
//
// Il tenant è scelto a build-time da EXPO_PUBLIC_TENANT (default 'girogirotondo').
// Expo dà precedenza ad app.config.js su app.json, quindi qui REPLICHIAMO app.json.
//
// SICUREZZA build Giro (app IN PRODUZIONE): per 'girogirotondo' — o QUALSIASI valore
// non riconosciuto — l'output è ESATTAMENTE app.json, per costruzione (`return { expo: base }`
// senza trasformazioni). app.json resta la fonte di verità: lo importiamo e per gli altri
// tenant applichiamo SOLO override mirati con spread profondo (nessun campo base va perso).

const base = require('./app.json').expo;

module.exports = () => {
  const tenant = process.env.EXPO_PUBLIC_TENANT || 'girogirotondo';

  if (tenant === 'dimensione-bimbo') {
    return {
      expo: {
        ...base,
        name: 'Dimensione Bimbo',
        slug: 'dimensionebimbo-app',
        scheme: 'dimensionebimbo',
        description: 'Piattaforma gestionale per la Scuola dell\'Infanzia Dimensione Bimbo.',

        // ICONE Dimensione Bimbo (asset dedicati in ./assets/). backgroundColor di
        // splash/adaptiveIcon già overridato più sotto — NON toccarlo qui.
        icon: './assets/dimensione-bimbo-icon.png',
        splash: {
          ...base.splash,
          image: './assets/dimensione-bimbo-splash.png',
          backgroundColor: '#FFE3C2',
        },

        ios: {
          ...base.ios,
          bundleIdentifier: 'it.dimensionebimbo.app',
          // NB: la config dinamica re-impone questo valore nel binario ad ogni build
          // (autoIncrement non persiste con app.config.js). Va alzato A MANO se il numero
          // è già stato caricato su App Store Connect. Usati finora per 1.0.1: 1, 6, 11.
          buildNumber: '12',
          infoPlist: {
            ...base.ios.infoPlist,
            // TODO: NSPrivacyDescription per Dimensione Bimbo — ora l'URL punta a
            //       girogirotondowebapp.it (dominio DB non ancora esistente).
          },
        },

        android: {
          ...base.android,
          package: 'it.dimensionebimbo.app',
          // NB: la config dinamica re-impone questo valore ad ogni build → va alzato A MANO
          // quando il versionCode è già stato caricato su Play. Usati finora: 5, 6, 11.
          versionCode: 12,
          // permissions / intentFilters invariati (ereditati da base.android).
          adaptiveIcon: {
            ...base.android.adaptiveIcon,
            foregroundImage: './assets/dimensione-bimbo-adaptive-icon.png',
            backgroundColor: '#FFE3C2',
          },
        },

        extra: {
          ...base.extra,
          // projectId del 2° progetto EAS (@antoarca/dimensionebimbo-app). NON fare spread di
          // base.extra.eas: erediterebbe il projectId di Giro e collegherebbe DB al progetto sbagliato.
          eas: { projectId: '1f2f0ec6-39de-410e-8e86-3c32b110fcce' },
          // privacyPolicyUrl / supportUrl restano su girogirotondowebapp.it.
          // TODO: URL privacy/support Dimensione Bimbo.
        },

        // OTA EAS Update: base.updates.url punta al progetto di Giro. DB ha un progetto EAS
        // proprio, quindi l'URL DEVE combaciare con extra.eas.projectId qui sopra, altrimenti
        // il build fallisce (projectId mismatch) o l'OTA raggiunge il progetto sbagliato.
        // runtimeVersion (policy appVersion) è ereditato da base: risolve la versione di DB.
        updates: {
          ...base.updates,
          url: 'https://u.expo.dev/1f2f0ec6-39de-410e-8e86-3c32b110fcce',
        },

        web: {
          ...base.web,
          name: 'Dimensione Bimbo',
          shortName: 'DB',
          themeColor: '#FB6A00',
          backgroundColor: '#FFE3C2',
        },
      },
    };
  }

  // 'girogirotondo' o qualsiasi valore non riconosciuto → IDENTICO ad app.json.
  return { expo: base };
};
