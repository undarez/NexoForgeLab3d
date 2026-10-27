import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'NexoForgeLab3D — Créations 3D personnalisées',
  description: 'Configurez votre création personnalisée et demandez un devis NexoForgeLab3D.',
  applicationName: 'NexoForgeLab3D',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
