import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Atori · Operação de leads', description: 'Gestão privada de prospecção de clínicas.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
