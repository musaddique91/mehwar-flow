import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/AuthScreen';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return <AuthScreen mode="register" />;
}
