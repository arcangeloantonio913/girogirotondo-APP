import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Altre importazioni...
import type { Metadata, Viewport } from "next";

// Configurazione dei Metadati (Solo la parte metadata da aggiornare)
export const metadata: Metadata = {
  title: "Girogirotondo - Gestione Asilo",
  description: "L'app professionale per asili e scuole dell'infanzia.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Girogirotondo",
  },
  icons: {
    apple: "/icon-192x192.png", // <--- RIFERIMENTO ALLA TUA NUOVA ICONA REALE
  },
};

// ...resto del file RootLayout (viewport, etc.)

// Configurazione del Viewport (Fondamentale per il punteggio PWA)
export const viewport: Viewport = {
  themeColor: "#FFB6C1", // Il rosa pastello del tuo brand
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <head>
        {/* Link aggiuntivo per sicurezza PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        <main className="min-h-screen bg-background">
          {children}
        </main>
      </body>
    </html>
  );
}