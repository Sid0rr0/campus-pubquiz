import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import { SiteHeader } from '@/app/components/site-header';
import { AuthProvider } from '@/app/lib/use-auth';
import './globals.css';

const technika = localFont({
  src: [
    {
      path: './fonts/Technika-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/Technika-Italic.ttf',
      weight: '400',
      style: 'italic',
    },
  ],
  variable: '--font-technika',
});

export const metadata: Metadata = {
  title: 'Campus Pub Quiz',
  description: 'Live pub quiz for campus events',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${technika.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">
        <AuthProvider>
          <SiteHeader />
          {children}
        </AuthProvider>
        <Toaster
          position="top-right"
          richColors
          toastOptions={{ classNames: { toast: 'font-bold' } }}
          style={
            {
              '--border-radius': '1rem',
              '--success-bg': '#fff',
              '--success-border': '#7ac143',
              '--success-text': '#7ac143',
              '--error-bg': '#fff',
              '--error-border': '#ec008c',
              '--error-text': '#ec008c',
            } as React.CSSProperties
          }
        />
      </body>
    </html>
  );
}
