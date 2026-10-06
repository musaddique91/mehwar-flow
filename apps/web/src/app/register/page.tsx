import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/AuthScreen';

export const metadata: Metadata = {
  title: 'Create Account',
  description:
    'Join Mehwar (Maverick Social Hub). Create your account to start previewing, scheduling, and publishing across your social media channels.',
  alternates: {
    canonical: '/register',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RegisterPage() {
  return <AuthScreen mode="register" />;
}
