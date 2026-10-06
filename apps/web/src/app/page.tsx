import type { Metadata } from 'next';
import { Landing } from '@/components/landing/Landing';

export const metadata: Metadata = {
  title: 'Mehwar · Maverick Social Hub | Multi-Platform Social Media Management',
  description:
    'Write once, preview everywhere, and publish across all social channels with Mehwar (Maverick Social Hub). Schedule and automate posts on Instagram, TikTok, Facebook, YouTube, LinkedIn, X, and WhatsApp.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Mehwar · Maverick Social Hub | Next-Gen Social Media Management',
    description:
      'The modern social media command center. Write once, preview across all networks, schedule effortlessly, and manage customer communications.',
    url: '/',
    images: [
      {
        url: '/brand/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Mehwar · Maverick Social Hub',
      },
    ],
  },
};

export default function Home() {
  return <Landing />;
}
