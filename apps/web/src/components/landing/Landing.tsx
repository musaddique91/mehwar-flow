'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import {
  ArrowRight,
  CalendarDays,
  Globe,
  LockKeyhole,
  Sparkles,
  TrendingUp,
  WandSparkles,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { PLATFORMS, PLATFORM_RULES } from '@mehwar/shared';
import { PostPreview } from '@/components/composer/PostPreview';
import {
  EASE_OUT,
  FadeIn,
  GradientBlobs,
  Marquee,
  Stagger,
  StaggerItem,
} from '@/components/motion';
import { Logo } from '@/components/ui/Logo';
import { Wordmark } from '@/components/ui/Wordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PlatformIcon } from '@/lib/platforms';

const SAMPLE = {
  name: 'Sara Ahmed',
  handle: 'sara.creates',
};

function Nav() {
  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
      className="sticky top-4 z-40 mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5 glass"
    >
      <Logo />
      <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
        <a href="#features" className="transition hover:text-fg">
          Features
        </a>
        <a href="#how" className="transition hover:text-fg">
          How it works
        </a>
        <a href="#networks" className="transition hover:text-fg">
          Networks
        </a>
      </nav>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/login"
          className="hidden rounded-full px-4 py-2 text-sm font-semibold text-muted transition hover:text-fg sm:block"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="brand-gradient rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-105"
        >
          Start free
        </Link>
      </div>
    </motion.header>
  );
}

function FloatingCard({
  children,
  className,
  delay,
  floatY = 14,
  rotate = 0,
}: {
  children: React.ReactNode;
  className: string;
  delay: number;
  floatY?: number;
  rotate?: number;
}) {
  return (
    <motion.div
      className={`absolute ${className}`}
      initial={{ opacity: 0, y: 60, rotate: rotate * 2, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, rotate, scale: 1 }}
      transition={{ duration: 0.9, delay, ease: EASE_OUT }}
    >
      <motion.div
        animate={{ y: [0, -floatY, 0] }}
        transition={{ duration: 6 + delay * 2, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ scale: 1.04, rotate: 0, zIndex: 10 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-16 lg:grid-cols-[1.1fr_1fr] lg:pt-24"
    >
      <motion.div style={{ y, opacity }}>
        <FadeIn>
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5 text-fuchsia-400" />7 networks · one composer
          </span>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h1 className="mt-6 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Post once.
            <br />
            <span className="brand-text">Be everywhere.</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="mt-6 max-w-lg text-lg text-muted">
            Write your story once, see exactly how it lands on X, Instagram, TikTok, YouTube and
            more, then schedule it to go live at the perfect moment. No API headaches.
          </p>
        </FadeIn>
        <FadeIn delay={0.3} className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/register"
            className="brand-gradient group inline-flex h-14 items-center gap-2 rounded-full px-7 font-semibold text-white shadow-[0_12px_40px_-10px_rgb(217_70_239/0.8)] transition hover:-translate-y-0.5"
          >
            Create your free account
            <ArrowRight className="size-4 transition group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className="glass inline-flex h-14 items-center rounded-full px-7 font-semibold transition hover:-translate-y-0.5"
          >
            I have an account
          </Link>
        </FadeIn>
        <FadeIn delay={0.45} className="mt-10 flex items-center gap-3 text-muted">
          {PLATFORMS.map((p, i) => (
            <motion.span
              key={p}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55 + i * 0.06, type: 'spring', stiffness: 400, damping: 15 }}
              whileHover={{ y: -4, scale: 1.2 }}
              className="glass flex size-10 items-center justify-center rounded-full"
              title={PLATFORM_RULES[p].label}
            >
              <PlatformIcon platform={p} className="size-4" />
            </motion.span>
          ))}
        </FadeIn>
      </motion.div>

      <div className="relative hidden h-[560px] lg:block" aria-hidden>
        <FloatingCard className="left-0 top-6 w-72" delay={0.2} rotate={-4}>
          <PostPreview
            platform="x"
            text="Launching our summer drop today 🌴 Everything 20% off until Sunday. #SummerSale"
            {...SAMPLE}
          />
        </FloatingCard>
        <FloatingCard className="right-0 top-0 w-60" delay={0.35} rotate={5} floatY={18}>
          <PostPreview
            platform="instagram"
            text="Golden hour never misses ✨ #weekend"
            {...SAMPLE}
          />
        </FloatingCard>
        <FloatingCard className="bottom-0 left-16 w-48" delay={0.5} rotate={-2} floatY={10}>
          <PostPreview
            platform="tiktok"
            text="POV: you scheduled a week of posts in 5 minutes"
            {...SAMPLE}
          />
        </FloatingCard>
        <FloatingCard className="bottom-10 right-4 w-64" delay={0.65} rotate={3}>
          <div className="glass flex items-center gap-3 rounded-2xl p-4 shadow-xl">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <TrendingUp className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Published to 5 networks</p>
              <p className="text-xs text-muted">Today at 9:00 · your time zone</p>
            </div>
          </div>
        </FloatingCard>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: WandSparkles,
    title: 'One composer, every network',
    text: 'Type once. Per-network tabs show exactly how your post renders, with live limits for each platform.',
  },
  {
    icon: CalendarDays,
    title: 'Schedule in your time zone',
    text: 'Pick a time the way you think about it. We handle UTC, daylight saving and the rest.',
  },
  {
    icon: Zap,
    title: 'Publishing that just works',
    text: 'Chunked uploads, retries and platform quirks are handled for you, so posts go out on time.',
  },
  {
    icon: LockKeyhole,
    title: 'Bank-grade token vault',
    text: 'Your account connections are encrypted with AES-256 and isolated per account.',
  },
  {
    icon: Globe,
    title: 'Threads & carousels',
    text: 'Long update? It splits into a connected thread automatically. Multiple photos become a carousel.',
  },
  {
    icon: Sparkles,
    title: 'AI caption helper',
    text: 'Rewrite for each network’s tone, suggest hashtags and write alt text. Coming soon.',
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-24">
      <FadeIn inView className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
          Everything you need to <span className="brand-text">grow</span>
        </h2>
        <p className="mt-4 text-lg text-muted">
          Built for creators and brands who’d rather create than copy-paste.
        </p>
      </FadeIn>
      <Stagger inView className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <StaggerItem key={f.title}>
            <motion.div
              whileHover={{ y: -6 }}
              className="glass group h-full rounded-3xl p-6 transition-shadow hover:shadow-[0_20px_60px_-20px_rgb(217_70_239/0.45)]"
            >
              <span className="brand-gradient flex size-12 items-center justify-center rounded-2xl text-white shadow-lg shadow-fuchsia-500/30 transition-transform group-hover:rotate-6 group-hover:scale-110">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
            </motion.div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ['Connect', 'Link your accounts in a couple of clicks with secure sign-in.'],
    ['Create', 'Write once, attach media, and fine-tune each network’s version.'],
    ['Schedule', 'Pick the moment. We publish it everywhere, right on time.'],
  ];
  return (
    <section id="how" className="mx-auto max-w-5xl px-4 py-16">
      <Stagger inView className="grid gap-6 md:grid-cols-3">
        {steps.map(([title, text], i) => (
          <StaggerItem key={title} className="relative text-center">
            <motion.span
              whileHover={{ scale: 1.1, rotate: -6 }}
              className="brand-text mx-auto block text-7xl font-black"
            >
              0{i + 1}
            </motion.span>
            <h3 className="mt-2 text-xl font-bold">{title}</h3>
            <p className="mt-2 text-sm text-muted">{text}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function Networks() {
  return (
    <section id="networks" className="py-16">
      <FadeIn
        inView
        className="mb-8 text-center text-sm font-semibold uppercase tracking-[0.25em] text-muted"
      >
        Publish to all the places your audience lives
      </FadeIn>
      <Marquee>
        {PLATFORMS.map((p) => (
          <span
            key={p}
            className="flex items-center gap-3 text-2xl font-bold text-muted transition hover:text-fg"
          >
            <PlatformIcon platform={p} className="size-7" />
            {PLATFORM_RULES[p].label}
          </span>
        ))}
      </Marquee>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-24">
      <FadeIn inView>
        <div className="brand-gradient relative overflow-hidden rounded-[2.5rem] p-10 text-center text-white shadow-[0_30px_80px_-20px_rgb(217_70_239/0.6)] sm:p-16">
          <motion.div
            aria-hidden
            className="absolute -right-20 -top-20 size-72 rounded-full bg-white/20 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
          <h2 className="relative text-4xl font-black tracking-tight sm:text-5xl">
            Your audience is waiting.
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-white/85">
            Set up in under a minute. Free while we’re in early access.
          </p>
          <Link
            href="/register"
            className="relative mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-white px-8 font-semibold text-fuchsia-600 transition hover:scale-105"
          >
            Get started <ArrowRight className="size-4" />
          </Link>
        </div>
      </FadeIn>
    </section>
  );
}

export function Landing() {
  return (
    <div className="relative overflow-x-clip px-3 pt-2">
      <GradientBlobs />
      <Nav />
      <Hero />
      <Networks />
      <Features />
      <HowItWorks />
      <FinalCta />
      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-line px-4 py-8 text-sm text-muted sm:flex-row">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Logo />
          <span className="hidden text-line sm:inline">•</span>
          <span className="text-xs">© {new Date().getFullYear()} Mehwar Flow</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs">
          <span className="text-muted">A product of</span>
          <Wordmark height={22} />
        </div>
      </footer>
    </div>
  );
}
