import type { Metadata } from 'next';
import localFont from 'next/font/local';
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
      </body>
    </html>
  );
}
