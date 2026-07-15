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
          buildNumber: '1',            // prima build DB (app store distinta da Giro).
          infoPlist: {
            ...base.ios.infoPlist,
            // TODO: NSPrivacyDescription per Dimensione Bimbo — ora l'URL punta a
            //       girogirotondowebapp.it (dominio DB non ancora esistente).
          },
        },

        android: {
          ...base.android,
          package: 'it.dimensionebimbo.app',
          versionCode: 5,              // build DB (Giro resta a 4, non toccato).
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
