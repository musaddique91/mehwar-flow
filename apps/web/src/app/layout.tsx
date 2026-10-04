import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Mehwar Flow', template: '%s · Mehwar Flow' },
  description:
    'Write once, preview everywhere, and publish to all your social channels from one place.',
  icons: {
    icon: [
      { url: '/brand/maverick-pwa-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/maverick-pwa-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/brand/maverick-pwa-192.png',
    apple: [
      { url: '/brand/maverick-pwa-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#07070f' },
    { media: '(prefers-color-scheme: light)', color: '#f6f5fb' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-dvh" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
