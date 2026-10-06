import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mehwar · Maverick Social Hub',
    short_name: 'Mehwar Flow',
    description:
      'All-in-one social media management, post scheduling, and multi-channel publishing hub for modern creators and brands.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07070f',
    theme_color: '#07070f',
    icons: [
      {
        src: '/brand/maverick-pwa-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/brand/maverick-pwa-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/brand/maverick-pwa-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
