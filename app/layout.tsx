import type { Metadata, Viewport } from 'next';
import { BottomNav } from '@/components/BottomNav';
import './globals.css';

// Les polices passent par un <link>, pas par next/font/google, et c'est
// volontaire : next/font telecharge les fichiers AU BUILD. Un build sans acces
// a fonts.googleapis.com echoue alors completement, ce qui casse le deploiement
// pour une raison purement cosmetique. Ici, si les polices ne chargent pas,
// on retombe sur la pile systeme et l'app reste utilisable.
const FONTS =
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Instrument+Sans:wght@400;600&display=swap';

export const metadata: Metadata = {
  title: 'VGPC',
  description: 'Scanne un jeu, sors le bon prix, publie l’annonce.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'VGPC' },
};

export const viewport: Viewport = {
  themeColor: '#0A0B0F',
  width: 'device-width',
  initialScale: 1,
  // Le raccourci iPhone doit se comporter comme une app, pas comme une page web.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <div className="mx-auto min-h-dvh w-full max-w-[430px]">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
