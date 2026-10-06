import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mehwar.io';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Mehwar · Maverick Social Hub | Social Media Management & Scheduling',
    template: '%s · Mehwar · Maverick Social Hub',
  },
  description:
    'Mehwar (Maverick Social Hub) is your all-in-one social media command center. Write once, preview everywhere, schedule posts, and publish across Instagram, TikTok, Facebook, YouTube, LinkedIn, X, and WhatsApp with integrated customer CRM and actionable analytics.',
  applicationName: 'Mehwar Flow - Maverick Social Hub',
  keywords: [
    'Mehwar',
    'Mehwar Flow',
    'Maverick',
    'Maverick Social Hub',
    'social media',
    'social media dentee',
    'social media hub',
    'social media management',
    'social media scheduler',
    'social media marketing',
    'multi-channel publishing',
    'Instagram scheduler',
    'TikTok scheduler',
    'WhatsApp business CRM',
    'YouTube shorts scheduler',
    'LinkedIn post scheduler',
    'social media automation',
    'social media analytics',
    'social post composer',
    'cross-platform social media',
  ],
  authors: [{ name: 'Mehwar & Maverick Team', url: SITE_URL }],
  creator: 'Mehwar & Maverick',
  publisher: 'Mehwar Flow',
  category: 'Social Media Management',
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
  openGraph: {
    title: 'Mehwar · Maverick Social Hub | Next-Gen Social Media Management',
    description:
      'Manage all your social networks in one unified hub. Compose, preview, schedule, and publish posts to Instagram, TikTok, Facebook, YouTube, LinkedIn, X, and WhatsApp.',
    url: SITE_URL,
    siteName: 'Mehwar · Maverick Social Hub',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/brand/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Mehwar · Maverick Social Hub - Unified Social Media Management',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mehwar · Maverick Social Hub',
    description:
      'Write once, preview everywhere, and publish across all social channels with Mehwar (Maverick Social Hub).',
    site: '@mehwar',
    creator: '@mehwar',
    images: ['/brand/og-image.jpg'],
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#07070f' },
    { media: '(prefers-color-scheme: light)', color: '#f6f5fb' },
  ],
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Mehwar · Maverick Social Hub',
      url: SITE_URL,
      logo: `${SITE_URL}/brand/maverick-pwa-512.png`,
      sameAs: [
        'https://twitter.com/mehwar',
        'https://www.linkedin.com/company/mehwar',
        'https://www.instagram.com/mehwar',
      ],
      description:
        'Mehwar (Maverick Social Hub) provides automated multi-channel social media publishing, scheduling, and analytics for creators and enterprises.',
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Mehwar · Maverick Social Hub',
      publisher: {
        '@id': `${SITE_URL}/#organization`,
      },
      description:
        'All-in-one social media command center to compose, preview, schedule, and publish posts across every major social platform.',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#software`,
      name: 'Mehwar Flow (Maverick Social Hub)',
      applicationCategory: 'BusinessApplication, SocialNetworkingApplication',
      operatingSystem: 'All',
      url: SITE_URL,
      description:
        'Unified social media management platform supporting Instagram, TikTok, Facebook, YouTube, LinkedIn, X, and WhatsApp with calendar scheduling, customer CRM, and live analytics.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: [
        'Multi-channel social post composition',
        'Realistic live platform previews',
        'Visual drag-and-drop content calendar',
        'Smart post scheduling and automated publishing',
        'WhatsApp CRM and customer broadcasting',
        'Cross-platform performance analytics',
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-dvh" suppressHydrationWarning>
        {/* Google Analytics (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-SQ8GGHHM9P"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-SQ8GGHHM9P');
          `}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
