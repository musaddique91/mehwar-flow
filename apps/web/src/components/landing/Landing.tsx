'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Images,
  LockKeyhole,
  MessageCircle,
  PenLine,
  Send,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type ComponentType, type ReactNode } from 'react';
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
import { cn } from '@/lib/cn';
import { PLATFORM_BRAND, PlatformIcon } from '@/lib/platforms';
import { CalendarMini, CommunityMock, CreateMock, InsightsMock, PublishMock } from './mocks';

const NETWORK_LIST = PLATFORMS.map((p) => PLATFORM_RULES[p].label);
const NETWORK_SENTENCE = `${NETWORK_LIST.slice(0, -1).join(', ')} and ${NETWORK_LIST.at(-1)}`;

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
        <a href="#channels" className="transition hover:text-fg">
          Channels
        </a>
        <a href="#pricing" className="transition hover:text-fg">
          Pricing
        </a>
        <a href="#faq" className="transition hover:text-fg">
          FAQ
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
          Get started
        </Link>
      </div>
    </motion.header>
  );
}

const SAMPLE = {
  name: 'Sara Ahmed',
  handle: 'sara.creates',
};

function FloatingCard({
  children,
  className,
  delay,
  floatY = 14,
  rotate = 0,
}: {
  children: ReactNode;
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
            <Sparkles className="size-3.5 text-fuchsia-400" />
            Free during early access
          </span>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h1 className="mt-6 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Your social media
            <br />
            <span className="brand-text">workspace.</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="mt-6 max-w-lg text-lg text-muted">
            Plan, create and publish to every network from one place. Reply to comments, see
            what’s working and grow, without the copy-paste.
          </p>
        </FadeIn>
        <FadeIn delay={0.3} className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/register"
            className="brand-gradient group inline-flex h-14 items-center gap-2 rounded-full px-7 font-semibold text-white shadow-[0_12px_40px_-10px_rgb(217_70_239/0.8)] transition hover:-translate-y-0.5"
          >
            Get started for free
            <ArrowRight className="size-4 transition group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className="glass inline-flex h-14 items-center rounded-full px-7 font-semibold transition hover:-translate-y-0.5"
          >
            I have an account
          </Link>
        </FadeIn>
        <FadeIn delay={0.4}>
          <p className="mt-4 text-sm text-muted">No credit card needed · Every feature included</p>
        </FadeIn>
        <FadeIn delay={0.45} className="mt-8 flex flex-wrap items-center gap-3 text-muted">
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
          <PostPreview platform="instagram" text="Golden hour never misses ✨ #weekend" {...SAMPLE} />
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

function Networks() {
  return (
    <section className="py-16">
      <FadeIn
        inView
        className="mb-8 text-center text-sm font-semibold uppercase tracking-[0.25em] text-muted"
      >
        Works with every platform you post to
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

interface CoreFeature {
  eyebrow: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
  points: string[];
  mock: ReactNode;
}

const CORE: CoreFeature[] = [
  {
    eyebrow: 'Publish',
    icon: Send,
    title: 'Every network you post to, in one queue',
    text: `Schedule your content to ${NETWORK_SENTENCE}, in your own time zone.`,
    points: [
      'Threads and carousels built automatically',
      'Chunked uploads and retries handled for you',
      'A visual calendar of everything going out',
    ],
    mock: <PublishMock />,
  },
  {
    eyebrow: 'Create',
    icon: PenLine,
    title: 'Turn any idea into the perfect post',
    text: 'Write once and see exactly how it lands on each network, with live character limits. The AI Assistant rewrites your caption for every platform’s tone.',
    points: [
      'Per-network previews and tweaks',
      'AI captions, hashtags and ideas',
      'A shared media library for your assets',
    ],
    mock: <CreateMock />,
  },
  {
    eyebrow: 'Community',
    icon: MessageCircle,
    title: 'Reply to comments in a flash',
    text: 'Comments from all your channels land in one inbox, so you can triage and respond without hopping between apps.',
    points: [
      'One inbox for every channel',
      'Reply in place, in seconds',
      'Never miss a question from a customer',
    ],
    mock: <CommunityMock />,
  },
  {
    eyebrow: 'Insights',
    icon: BarChart3,
    title: 'Answers, not just analytics',
    text: 'See your reach, engagement and follower growth across every network, and learn which posts and times work best.',
    points: [
      'Cross-network performance at a glance',
      'Top posts and best times to post',
      'Track growth week over week',
    ],
    mock: <InsightsMock />,
  },
];

function CoreFeatures() {
  return (
    <section id="features" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-20">
      <FadeIn inView className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted">
          Core features
        </p>
        <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Everything you need to <span className="brand-text">grow</span>
        </h2>
      </FadeIn>

      <div className="mt-16 space-y-24 lg:space-y-32">
        {CORE.map((f, i) => (
          <div key={f.eyebrow} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <FadeIn inView className={cn(i % 2 === 1 && 'lg:order-2')}>
              <span className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-fuchsia-600 dark:text-fuchsia-300">
                <f.icon className="size-3.5" />
                {f.eyebrow}
              </span>
              <h3 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{f.title}</h3>
              <p className="mt-4 text-lg leading-relaxed text-muted">{f.text}</p>
              <ul className="mt-6 space-y-2.5">
                {f.points.map((p) => (
                  <li key={p} className="flex items-center gap-2.5 text-sm font-medium">
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="group mt-8 inline-flex items-center gap-1.5 font-semibold text-fuchsia-600 dark:text-fuchsia-300"
              >
                Try it free
                <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </Link>
            </FadeIn>
            <FadeIn inView delay={0.1} className="relative">
              <div
                aria-hidden
                className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-orange-400/15 blur-2xl"
              />
              {f.mock}
            </FadeIn>
          </div>
        ))}
      </div>
    </section>
  );
}

const MORE = [
  {
    icon: CalendarDays,
    title: 'Content calendar',
    text: 'See your whole month at a glance and drag posts to the perfect slot.',
    extra: <CalendarMini />,
  },
  {
    icon: Images,
    title: 'Media library',
    text: 'Keep every image and video in one place, ready to reuse in any post.',
  },
  {
    icon: Users,
    title: 'Team workspace',
    text: 'Invite teammates and manage who can create, schedule and publish.',
  },
  {
    icon: UsersRound,
    title: 'Customers & WhatsApp',
    text: 'Organise customers into groups and share your posts with them on WhatsApp.',
  },
  {
    icon: Smartphone,
    title: 'Mobile app',
    text: 'Create, schedule and reply from your phone, wherever you are.',
  },
  {
    icon: LockKeyhole,
    title: 'Bank-grade security',
    text: 'Account connections are encrypted with AES-256 and isolated per workspace.',
  },
];

function MoreFeatures() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <FadeIn inView className="text-center">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">…and so much more</h2>
      </FadeIn>
      <Stagger inView className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MORE.map((f, i) => (
          <StaggerItem key={f.title} className={cn(i === 0 && 'lg:row-span-2')}>
            <motion.div
              whileHover={{ y: -6 }}
              className="glass group flex h-full flex-col rounded-3xl p-6 transition-shadow hover:shadow-[0_20px_60px_-20px_rgb(217_70_239/0.45)]"
            >
              <span className="brand-gradient flex size-12 items-center justify-center rounded-2xl text-white shadow-lg shadow-fuchsia-500/30 transition-transform group-hover:rotate-6 group-hover:scale-110">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              {f.extra && <div className="mt-auto pt-6">{f.extra}</div>}
            </motion.div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function Channels() {
  return (
    <section id="channels" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-20">
      <FadeIn inView className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
          Connect your favourite accounts
        </h2>
        <p className="mt-4 text-lg text-muted">
          Secure sign-in in a couple of clicks. Publish to all the places your audience lives.
        </p>
      </FadeIn>
      <Stagger inView className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PLATFORMS.map((p) => (
          <StaggerItem key={p}>
            <motion.div
              whileHover={{ y: -4 }}
              className="glass flex items-center gap-3 rounded-2xl p-4"
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ background: PLATFORM_BRAND[p].gradient }}
              >
                <PlatformIcon platform={p} className="size-5" />
              </span>
              <span className="min-w-0 text-sm font-semibold">
                <span className="block text-xs font-medium text-muted">Mehwar Flow ×</span>
                {PLATFORM_RULES[p].label}
              </span>
            </motion.div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

const PLAN_FEATURES = [
  `All ${PLATFORMS.length} networks`,
  'Unlimited channels',
  'Unlimited scheduled posts',
  'AI Assistant',
  'Comments inbox',
  'Analytics & insights',
  'Content calendar',
  'Media library',
  'Team members',
  'Customers & WhatsApp sharing',
];

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-20">
      <FadeIn inView className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted">Pricing</p>
        <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Completely <span className="brand-text">free</span>.
        </h2>
        <p className="mt-4 text-lg text-muted">
          While we’re in early access, every feature is free for everyone. No trials, no limits,
          no credit card.
        </p>
      </FadeIn>
      <FadeIn inView delay={0.1} className="mx-auto mt-12 max-w-3xl">
        <div className="relative rounded-[2rem] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 p-[2px] shadow-[0_30px_80px_-30px_rgb(217_70_239/0.6)]">
          <div className="grid gap-8 rounded-[calc(2rem-2px)] bg-card-strong p-8 sm:p-10 md:grid-cols-[1fr_1.2fr]">
            <div>
              <span className="brand-gradient inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                Early access
              </span>
              <h3 className="mt-4 text-2xl font-bold">Everything plan</h3>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-6xl font-black tracking-tight">$0</span>
                <span className="text-muted">/ month</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                Free for every user while we’re in early access.
              </p>
              <Link
                href="/register"
                className="brand-gradient group mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold text-white transition hover:-translate-y-0.5"
              >
                Get started for free
                <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </Link>
            </div>
            <ul className="grid content-start gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

const FAQ = [
  {
    q: 'Is Mehwar Flow really free?',
    a: 'Yes. During early access every feature is free with no limits and no credit card. If we introduce paid plans later, we’ll let you know well in advance.',
  },
  {
    q: 'Which networks can I post to?',
    a: `${NETWORK_SENTENCE}. You can connect as many accounts as you like.`,
  },
  {
    q: 'Do I need to give you my passwords?',
    a: 'Never. You connect each account through the network’s own secure sign-in, and we store the resulting tokens encrypted with AES-256.',
  },
  {
    q: 'Can my team use it too?',
    a: 'Yes. Invite teammates to your workspace and plan, create and publish together.',
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-24 mx-auto max-w-3xl px-4 py-20">
      <FadeIn inView className="text-center">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Questions, answered</h2>
      </FadeIn>
      <div className="mt-10 space-y-3">
        {FAQ.map((item, i) => (
          <div key={item.q} className="glass overflow-hidden rounded-2xl">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold"
            >
              {item.q}
              <ChevronDown
                className={cn('size-4 shrink-0 transition-transform', open === i && 'rotate-180')}
              />
            </button>
            <motion.div
              initial={false}
              animate={{ height: open === i ? 'auto' : 0, opacity: open === i ? 1 : 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.a}</p>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20">
      <FadeIn inView>
        <div className="brand-gradient relative overflow-hidden rounded-[2.5rem] p-10 text-center text-white shadow-[0_30px_80px_-20px_rgb(217_70_239/0.6)] sm:p-16">
          <motion.div
            aria-hidden
            className="absolute -right-20 -top-20 size-72 rounded-full bg-white/20 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
          <h2 className="relative text-4xl font-black tracking-tight sm:text-5xl">
            Grow your social presence with confidence
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-white/85">
            Set up in under a minute. No credit card needed.
          </p>
          <Link
            href="/register"
            className="relative mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-white px-8 font-semibold text-fuchsia-600 transition hover:scale-105"
          >
            Get started for free <ArrowRight className="size-4" />
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
      <CoreFeatures />
      <MoreFeatures />
      <Channels />
      <Pricing />
      <Faq />
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
