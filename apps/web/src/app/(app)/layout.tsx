'use client';

import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/lib/auth';

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        <Logo />
      </motion.div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return <Splash />;
  return <AppShell>{children}</AppShell>;
}
