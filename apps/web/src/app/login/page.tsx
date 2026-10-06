import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/AuthScreen';

export const metadata: Metadata = {
  title: 'Log in',
  description:
    'Sign in to Mehwar (Maverick Social Hub) to manage, schedule, and publish content across all your social channels.',
  alternates: {
    canonical: '/login',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LoginPage() {
  return <AuthScreen mode="login" />;
}
