/**
 * Informativa sulla Privacy — Girogirotondo / Il Magico Mondo
 * Conforme a: GDPR (Reg. UE 2016/679), D.Lgs. 196/2003 (Codice Privacy)
 * Trattamento dati di minori ai sensi dell'art. 8 GDPR e art. 2-quinquies D.Lgs. 196/2003
 */
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. Titolare del Trattamento',
    content: `Il Titolare del trattamento dei dati personali è la Scuola dell'Infanzia Girogirotondo, gestita da Omnia Studio, con sede in Napoli.

Indirizzo e-mail: scuolagirogirotondo@libero.it

Per qualsiasi questione relativa al trattamento dei tuoi dati personali, puoi contattare il Titolare all'indirizzo sopra indicato.`,
  },
  {
    title: '2. Categorie di Dati Trattati',
    content: `Nell'ambito dei servizi forniti tramite questa piattaforma, trattiamo le seguenti categorie di dati:

**Dati dei bambini (minori):**
- Dati anagrafici: nome, cognome, data di nascita
- Immagini e video ripresi durante le attività scolastiche
- Dati relativi all'alimentazione e allergie/intolleranze alimentari (dati sulla salute)
- Informazioni sulle attività giornaliere (griglia pasti, diario scolastico)

**Dati dei genitori/tutori:**
- Dati anagrafici: nome, cognome
- Indirizzo e-mail e credenziali di accesso alla piattaforma
- Comunicazioni con il personale scolastico

**Dati del personale scolastico:**
- Dati anagrafici: nome, cognome
- Indirizzo e-mail e credenziali di accesso`,
  },
  {
    title: '3. Finalità e Base Giuridica del Trattamento',
    content: `I dati vengono trattati per le seguenti finalità:

**a) Gestione del rapporto educativo (art. 6.1.b GDPR — esecuzione del contratto)**
- Gestione delle presenze e delle attività didattiche
- Comunicazione scuola-famiglia tramite la piattaforma
- Condivisione del diario scolastico e delle attività quotidiane

**b) Tutela della salute (art. 9.2.c GDPR — interessi vitali)**
- Gestione delle allergie e intolleranze alimentari dei bambini

**c) Consenso esplicito (art. 6.1.a GDPR)**
- Pubblicazione di immagini e video dei bambini nella gallery
- Invio di comunicazioni promozionali (ove previsto)

**Trattamento dei dati dei minori:**
Il trattamento dei dati personali dei minori avviene esclusivamente con il consenso espresso e documentato dei genitori o tutori legali, ai sensi dell'art. 8 GDPR e dell'art. 2-quinquies del D.Lgs. 196/2003.`,
  },
  {
    title: '4. Periodo di Conservazione dei Dati',
    content: `I dati personali vengono conservati per il tempo strettamente necessario agli scopi per cui sono stati raccolti:

- **Dati del rapporto scolastico:** per tutta la durata del rapporto educativo con la scuola
- **Immagini e video:** fino alla revoca del consenso da parte del genitore/tutore
- **Dati di accesso alla piattaforma:** per tutta la durata dell'iscrizione e successivamente per 12 mesi
- **Dati contabili e amministrativi:** 10 anni (obblighi di legge)

Al termine del periodo di conservazione, i dati vengono cancellati in modo sicuro e irreversibile.`,
  },
  {
    title: '5. Destinatari dei Dati',
    content: `I dati personali non vengono venduti né ceduti a terzi per finalità commerciali. Possono essere comunicati a:

- **Personale scolastico autorizzato:** maestre e personale amministrativo della struttura
- **Fornitori di servizi tecnici** (Responsabili del trattamento ai sensi dell'art. 28 GDPR):
  - MongoDB Atlas (archiviazione dati) — USA, con garanzie adeguate (SCCs)
  - Vercel Inc. (hosting frontend) — USA, con garanzie adeguate
  - Railway (hosting backend) — USA, con garanzie adeguate
  - Resend Inc. (invio email) — USA, con garanzie adeguate
  - Firebase/Google (autenticazione e storage) — USA, con garanzie adeguate (Privacy Shield/SCCs)
- **Autorità pubbliche:** su specifica richiesta di legge

Tutti i fornitori sono vincolati da accordi di protezione dei dati conformi al GDPR.`,
  },
  {
    title: '6. Sicurezza dei Dati',
    content: `Adottiamo misure tecniche e organizzative adeguate per proteggere i dati personali, tra cui:

- Trasmissione dei dati cifrata tramite protocollo HTTPS/TLS
- Autenticazione sicura con hashing delle password (bcrypt)
- Token JWT con scadenza temporale per le sessioni
- Accesso ai dati limitato al personale autorizzato (controllo degli accessi basato sui ruoli)
- Backup periodici dei dati
- Monitoraggio e logging degli accessi

In caso di violazione dei dati (data breach) che possa comportare rischi per i diritti e le libertà degli interessati, il Titolare notificherà l'Autorità Garante entro 72 ore e, ove necessario, gli interessati senza ingiustificato ritardo.`,
  },
  {
    title: '7. Diritti degli Interessati',
    content: `In qualità di interessati (o come genitori/tutori legali nell'esercizio dei diritti per conto dei minori), avete il diritto di:

- **Accesso (art. 15 GDPR):** ottenere conferma del trattamento e copia dei dati
- **Rettifica (art. 16 GDPR):** correggere dati inesatti o incompleti
- **Cancellazione (art. 17 GDPR - "diritto all'oblio"):** richiedere la cancellazione dei dati
- **Limitazione (art. 18 GDPR):** limitare il trattamento in determinate circostanze
- **Portabilità (art. 20 GDPR):** ricevere i dati in formato strutturato e leggibile
- **Opposizione (art. 21 GDPR):** opporsi al trattamento basato su legittimo interesse
- **Revoca del consenso:** in qualsiasi momento, senza pregiudicare la liceità del trattamento precedente

Per esercitare questi diritti, contatta il Titolare all'indirizzo: scuolagirogirotondo@libero.it

Hai inoltre il diritto di proporre reclamo al Garante per la Protezione dei Dati Personali (www.garanteprivacy.it).`,
  },
  {
    title: '8. Protezione Speciale dei Minori',
    content: `La scuola riconosce la particolare vulnerabilità dei minori e adotta misure specifiche per la loro protezione:

- I dati dei bambini sono accessibili esclusivamente al personale scolastico autorizzato e ai rispettivi genitori/tutori
- Nessun dato di minori viene condiviso pubblicamente o con terze parti non autorizzate
- Le immagini e i video dei bambini sono visibili solo agli account della stessa classe
- Il consenso per il trattamento dei dati dei minori è sempre richiesto ai genitori o tutori legali
- I genitori possono in qualsiasi momento richiedere la cancellazione delle immagini del proprio figlio
- Sono implementati controlli tecnici per garantire che ogni genitore veda solo i dati del proprio figlio

Ai sensi dell'art. 2-quinquies del D.Lgs. 196/2003, il consenso al trattamento dei dati dei minori di 14 anni deve essere prestato da chi esercita la responsabilità genitoriale.`,
  },
  {
    title: '9. Cookie e Tecnologie Simili',
    content: `La piattaforma utilizza:

- **Cookie tecnici essenziali:** per il funzionamento dell'autenticazione e della sessione utente. Questi cookie non richiedono consenso.
- **localStorage:** per mantenere la sessione di accesso e le preferenze dell'utente (es. sede selezionata). I dati vengono eliminati al logout.
- **Service Worker:** per le funzionalità PWA (installazione come app, notifiche push). Richiede esplicita autorizzazione dell'utente.

Non utilizziamo cookie di profilazione o di terze parti per finalità pubblicitarie.`,
  },
  {
    title: '10. Aggiornamenti della Presente Informativa',
    content: `La presente Informativa può essere aggiornata per riflettere modifiche normative o ai servizi offerti. Gli utenti registrati saranno informati di eventuali modifiche significative tramite e-mail o notifica nella piattaforma.

La versione più aggiornata è sempre disponibile al seguente indirizzo: girogirotondowebapp.it/privacy

**Ultima revisione:** Aprile 2026`,
  },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFDD0' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 h-14 max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: '#4169E1' }} />
            <h1 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Nunito' }}>
              Informativa sulla Privacy
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-12">
        {/* Intro */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: '#4169E1' }} />
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: 'Nunito' }}>
                Girogirotondo — Piattaforma Gestionale per la Scuola dell'Infanzia
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Questa Informativa descrive come raccogliamo, utilizziamo e proteggiamo i dati personali
                degli utenti della piattaforma Girogirotondo, con particolare attenzione alla tutela
                dei dati personali dei <strong>minori</strong>, in conformità al Regolamento UE 2016/679
                (GDPR) e al D.Lgs. 196/2003.
              </p>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {SECTIONS.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-3" style={{ fontFamily: 'Nunito', color: '#4169E1' }}>
                {s.title}
              </h3>
              <div className="text-sm text-gray-600 leading-relaxed space-y-2">
                {s.content.split('\n\n').map((para, j) => (
                  <p key={j} className="text-sm text-gray-600 leading-relaxed">
                    {para.split('\n').map((line, k) => {
                      // Bold text between **
                      const parts = line.split(/\*\*([^*]+)\*\*/g);
                      return (
                        <span key={k}>
                          {parts.map((part, l) => l % 2 === 1
                            ? <strong key={l} className="text-gray-800">{part}</strong>
                            : part
                          )}
                          {k < para.split('\n').length - 1 && <br />}
                        </span>
                      );
                    })}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer legal */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400 leading-relaxed">
            © 2026 Girogirotondo — Scuola dell'Infanzia<br />
            Informativa redatta in conformità al GDPR (Reg. UE 2016/679) e al D.Lgs. 196/2003<br />
            Garante per la Protezione dei Dati Personali: <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-blue-500">garanteprivacy.it</a>
          </p>
        </div>
      </main>
    </div>
  );
}
