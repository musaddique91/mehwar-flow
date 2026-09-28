'use client';

import { MotionConfig } from 'motion/react';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <MotionConfig
        reducedMotion="user"
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="bottom-center"
          richColors
          closeButton
          theme="system"
          toastOptions={{ className: 'font-sans' }}
        />
      </MotionConfig>
    </ThemeProvider>
  );
}
