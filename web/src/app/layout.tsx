import type { Metadata } from 'next';
import { AuthProvider } from '@/hooks/use-auth';
import { ToastProvider } from '@/hooks/use-toast';
// Self-hosted fonts (no external network dependency at build or runtime).
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/fraunces/latin-500.css';
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/fraunces/latin-700.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Sambet — Grassroots Project Registry',
    template: '%s · Sambet',
  },
  description:
    'Manage the Sambet Grassroots Project member registry: organizations, contacts, projects and imports.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
