'use client';

import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Platform } from '@mehwar/shared';
import { PostPreview } from '@/components/composer/PostPreview';
import { EASE_OUT, FadeIn, GradientBlobs } from '@/components/motion';
import { Button, Card, Input } from '@/components/ui';
import { Logo } from '@/components/ui/Logo';
import { Wordmark } from '@/components/ui/Wordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';

const SHOWCASE: { platform: Platform; text: string }[] = [
  { platform: 'instagram', text: 'New collection just dropped 🔥 Link in bio. #newin' },
  { platform: 'x', text: 'We shipped 3 features this week. Here’s what’s new 🧵 #buildinpublic' },
  {
    platform: 'facebook',
    text: 'Thank you for 10,000 followers! 🎉 To celebrate, we’re giving away 3 gift cards this Friday.',
  },
  {
    platform: 'threads',
    text: 'Hot take: consistency beats virality. Posting 3x a week for a year changed everything for us.',
  },
];

function Showcase() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SHOWCASE.length), 3200);
    return () => clearInterval(id);
  }, []);
  const item = SHOWCASE[index]!;

  return (
    <div className="relative hidden flex-1 items-center justify-center p-10 lg:flex">
      <div className="relative w-full max-w-xs">
        <div className="absolute -inset-10 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative h-[500px]">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 80, rotate: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, y: -80, rotate: -6, scale: 0.9 }}
              transition={{ duration: 0.7, ease: EASE_OUT }}
              className="absolute inset-x-0 top-0"
            >
              <PostPreview
                platform={item.platform}
                text={item.text}
                name="Mehwar Studio"
                handle="mehwar.studio"
              />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-2 flex justify-center gap-2">
          {SHOWCASE.map((_, i) => (
            <motion.span
              key={i}
              animate={{ width: i === index ? 28 : 8, opacity: i === index ? 1 : 0.4 }}
              className="h-2 rounded-full brand-gradient"
            />
          ))}
        </div>
        <p className="mt-6 text-center text-lg font-semibold">
          One post. <span className="brand-text">Every feed.</span>
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-1.5 opacity-80 transition hover:opacity-100">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">A product of</span>
          <Wordmark height={22} />
        </div>
      </div>
    </div>
  );
}

function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

const STRENGTH = [
  { label: 'Too short', color: 'bg-red-500' },
  { label: 'Weak', color: 'bg-orange-500' },
  { label: 'Okay', color: 'bg-amber-400' },
  { label: 'Strong', color: 'bg-lime-400' },
  { label: 'Excellent', color: 'bg-emerald-400' },
];

function StrengthMeter({ password }: { password: string }) {
  const score = password.length < 10 ? 0 : passwordScore(password);
  if (!password) return null;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="space-y-1.5"
    >
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <motion.div
              className={cn('h-full rounded-full', STRENGTH[score]!.color)}
              initial={false}
              animate={{ width: score >= n ? '100%' : '0%' }}
              transition={{ duration: 0.35 }}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">{STRENGTH[score]!.label}</p>
    </motion.div>
  );
}

function celebrate() {
  const colors = ['#8b5cf6', '#d946ef', '#f97316', '#facc15'];
  confetti({
    particleCount: 90,
    spread: 75,
    origin: { y: 0.7 },
    colors,
    disableForReducedMotion: true,
  });
  setTimeout(
    () =>
      confetti({
        particleCount: 60,
        spread: 110,
        origin: { y: 0.6 },
        colors,
        disableForReducedMotion: true,
      }),
    250,
  );
}

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();
  const isRegister = mode === 'register';
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState(isRegister ? '' : 'musajs91@gmail.com');
  const [password, setPassword] = useState(isRegister ? '' : 'Redhat7676');

  useEffect(() => {
    if (!loading && user && !busy) router.replace('/dashboard');
  }, [loading, user, busy, router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    try {
      const email = String(form.get('email'));
      if (isRegister) {
        await register({
          email,
          password,
          name: String(form.get('name')),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });
        celebrate();
        toast.success('Welcome aboard! 🎉', { description: 'Your account is ready.' });
      } else {
        await login({ email, password });
        toast.success('Welcome back 👋');
      }
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.errors?.length) {
        setErrors(Object.fromEntries(err.errors.map((x) => [x.path, x.message])));
      } else if (err instanceof ApiError && err.status === 401) {
        setErrors({ password: 'Invalid email or password' });
      } else if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: err.message });
      } else {
        toast.error('Something went wrong', {
          description: err instanceof Error ? err.message : 'Please try again.',
        });
      }
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh">
      <GradientBlobs />
      <div className="flex w-full flex-col lg:w-[520px] lg:shrink-0">
        <div className="flex items-center justify-between p-5">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-10">
          <Card
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="w-full max-w-md bg-card-strong p-7 shadow-2xl sm:p-8"
          >
            <FadeIn delay={0.1}>
              <h1 className="text-3xl font-black tracking-tight">
                {isRegister ? (
                  <>
                    Join the <span className="brand-text">flow</span>
                  </>
                ) : (
                  <>
                    Welcome <span className="brand-text">back</span>
                  </>
                )}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {isRegister
                  ? 'Create your account and start posting everywhere.'
                  : 'Log in to see what’s scheduled today.'}
              </p>
            </FadeIn>

            <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
              {isRegister && (
                <Input
                  label="Your name"
                  name="name"
                  autoComplete="name"
                  placeholder="Sara Ahmed"
                  icon={<User className="size-4" />}
                  error={errors.name}
                  required
                />
              )}
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                icon={<Mail className="size-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                required
              />
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder={isRegister ? 'At least 10 characters' : '••••••••••'}
                icon={<Lock className="size-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                required
              />
              {isRegister && <StrengthMeter password={password} />}
              <Button type="submit" size="lg" loading={busy} className="group mt-2 w-full">
                {isRegister ? 'Create account' : 'Log in'}
                {!busy && <ArrowRight className="size-4 transition group-hover:translate-x-1" />}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              {isRegister ? 'Already have an account? ' : 'New here? '}
              <Link
                href={isRegister ? '/login' : '/register'}
                className="font-semibold text-fuchsia-500 underline-offset-4 hover:underline dark:text-fuchsia-300"
              >
                {isRegister ? 'Log in' : 'Create an account'}
              </Link>
            </p>
          </Card>
        </div>
      </div>
      <Showcase />
    </div>
  );
}
